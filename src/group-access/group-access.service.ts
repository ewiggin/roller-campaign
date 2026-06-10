import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityPreachingGroup } from '../activities/entities/activity-preaching-group.entity';
import { Activity } from '../activities/entities/activity.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Guest } from '../guests/entities/guest.entity';
import { Region } from '../regions/entities/region.entity';
import { CaptainActivityResponseDto } from './dto/captain-activity-response.dto';
import { GroupLookupResponseDto } from './dto/group-lookup-response.dto';
import { GroupActivityRequest } from './entities/group-activity-request.entity';

@Injectable()
export class GroupAccessService {
  constructor(
    @InjectRepository(GuestGroup)
    private readonly groupsRepo: Repository<GuestGroup>,
    @InjectRepository(Guest)
    private readonly guestsRepo: Repository<Guest>,
    @InjectRepository(Activity)
    private readonly activitiesRepo: Repository<Activity>,
    @InjectRepository(Region)
    private readonly regionsRepo: Repository<Region>,
    @InjectRepository(GroupActivityRequest)
    private readonly requestsRepo: Repository<GroupActivityRequest>,
    @InjectRepository(ActivityPreachingGroup)
    private readonly preachingGroupsRepo: Repository<ActivityPreachingGroup>,
  ) {}

  async lookup(code: string): Promise<GroupLookupResponseDto> {
    const group = await this.groupsRepo.findOne({
      where: { group_code: code },
    });
    if (!group) throw new NotFoundException('Código de grupo no encontrado');

    const region = await this.regionsRepo.findOne({
      where: { id: group.region_id },
    });

    return {
      group_code: group.group_code,
      group_id: group.id,
      region_id: group.region_id,
      region_name: region?.name ?? '',
    };
  }

  async getActivities(code: string): Promise<CaptainActivityResponseDto[]> {
    const group = await this.groupsRepo.findOne({
      where: { group_code: code },
    });
    if (!group) throw new NotFoundException('Código de grupo no encontrado');

    const shiftGroups = await this.preachingGroupsRepo.find({
      where: { guestGroups: { id: group.id } },
      relations: { activity: true, guestGroups: true },
    });
    const busySlots = shiftGroups.map((sg) => ({
      date: sg.activity.date,
      start: sg.activity.start_time,
      end: sg.activity.end_time,
    }));
    const conflictsWithShift = (act: Activity) =>
      busySlots.some(
        (s) =>
          s.date === act.date &&
          s.start < act.end_time &&
          s.end > act.start_time,
      );

    const activities = await this.activitiesRepo.find({
      where: {
        region_id: group.region_id,
        request_attendance: true,
        status: 'published',
      },
      relations: ['guestGroups'],
      order: { date: 'ASC', start_time: 'ASC' },
    });

    if (activities.length === 0) return [];

    const allGroupIds = [
      ...new Set(
        activities.flatMap((a) => (a.guestGroups ?? []).map((g) => g.id)),
      ),
    ];
    const groupCounts = await this.getGroupGuestCounts(allGroupIds);

    const activityIds = activities.map((a) => a.id);
    const existingRequests = activityIds.length
      ? await this.requestsRepo
          .createQueryBuilder('r')
          .where('r.group_id = :groupId', { groupId: group.id })
          .andWhere('r.activity_id IN (:...activityIds)', { activityIds })
          .getMany()
      : [];
    const requestByActivity = new Map(
      existingRequests.map((r) => [r.activity_id, r]),
    );

    return activities
      .filter((a) => {
        if (conflictsWithShift(a)) return false;
        if (a.max_guests === null) return true;
        const enrolledCount = (a.guestGroups ?? []).reduce(
          (sum, g) => sum + (groupCounts.get(g.id) ?? 0),
          0,
        );
        return enrolledCount < a.max_guests;
      })
      .map((a) => {
        const req = requestByActivity.get(a.id);
        return {
          id: a.id,
          name: a.name,
          icon: a.icon,
          description: a.description,
          date: a.date,
          start_time: a.start_time,
          end_time: a.end_time,
          activity_locations: a.activity_locations ?? null,
          is_requested: req !== undefined,
          preference: req?.preference ?? null,
          is_assigned: (a.guestGroups ?? []).some((g) => g.id === group.id),
        };
      });
  }

  async enroll(
    code: string,
    activityId: string,
    preference: number,
  ): Promise<void> {
    const group = await this.groupsRepo.findOne({
      where: { group_code: code },
    });
    if (!group) throw new NotFoundException('Código de grupo no encontrado');

    const activity = await this.activitiesRepo.findOne({
      where: { id: activityId },
      relations: ['guestGroups'],
    });
    if (
      !activity ||
      !activity.request_attendance ||
      activity.status !== 'published'
    ) {
      throw new NotFoundException('Actividad no disponible');
    }

    if (activity.max_guests !== null) {
      const allGroupIds = (activity.guestGroups ?? []).map((g) => g.id);
      const counts = await this.getGroupGuestCounts(allGroupIds);
      const currentTotal = allGroupIds.reduce(
        (sum, id) => sum + (counts.get(id) ?? 0),
        0,
      );
      const groupSizeCounts = await this.getGroupGuestCounts([group.id]);
      const groupSize = groupSizeCounts.get(group.id) ?? 0;
      if (currentTotal + groupSize > activity.max_guests) {
        const remaining = activity.max_guests - currentTotal;
        throw new ConflictException(
          `Tu grupo tiene ${groupSize} ${groupSize === 1 ? 'persona' : 'personas'} y solo quedan ${remaining} ${remaining === 1 ? 'plaza disponible' : 'plazas disponibles'} en esta actividad`,
        );
      }
    }

    const existing = await this.requestsRepo.findOne({
      where: { group_id: group.id, activity_id: activityId },
    });

    if (existing) {
      await this.requestsRepo.update(existing.id, { preference });
    } else {
      await this.requestsRepo.save(
        this.requestsRepo.create({
          group_id: group.id,
          activity_id: activityId,
          preference,
        }),
      );
    }
  }

  async unenroll(code: string, activityId: string): Promise<void> {
    const group = await this.groupsRepo.findOne({
      where: { group_code: code },
    });
    if (!group) throw new NotFoundException('Código de grupo no encontrado');

    await this.requestsRepo.delete({
      group_id: group.id,
      activity_id: activityId,
    });
  }

  async deleteRequest(requestId: string): Promise<void> {
    await this.requestsRepo.delete({ id: requestId });
  }

  async getRequestsForActivity(
    activityId: string,
  ): Promise<
    {
      request_id: string;
      group_id: string;
      group_code: string;
      guest_count: number;
      preference: number;
    }[]
  > {
    const requests = await this.requestsRepo.find({
      where: { activity_id: activityId },
      relations: ['group'],
      order: { preference: 'ASC', created_at: 'ASC' },
    });

    if (requests.length === 0) return [];

    const groupIds = requests.map((r) => r.group_id);
    const counts = await this.getGroupGuestCounts(groupIds);

    return requests.map((r) => ({
      request_id: r.id,
      group_id: r.group_id,
      group_code: r.group?.group_code ?? '',
      guest_count: counts.get(r.group_id) ?? 0,
      preference: r.preference,
    }));
  }

  private async getGroupGuestCounts(
    groupIds: string[],
  ): Promise<Map<string, number>> {
    if (groupIds.length === 0) return new Map();
    const rows = await this.guestsRepo
      .createQueryBuilder('g')
      .select('g.group_id', 'group_id')
      .addSelect('COUNT(g.id)', 'count')
      .where('g.group_id IN (:...groupIds)', { groupIds })
      .groupBy('g.group_id')
      .getRawMany<{ group_id: string; count: string }>();
    return new Map(rows.map((r) => [r.group_id, parseInt(r.count, 10)]));
  }
}
