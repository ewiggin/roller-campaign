import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Guest } from '../guests/entities/guest.entity';
import { Region } from '../regions/entities/region.entity';
import { CaptainActivityResponseDto } from './dto/captain-activity-response.dto';
import { GroupLookupResponseDto } from './dto/group-lookup-response.dto';

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

    return activities
      .map((a) => {
        const enrolledCount = (a.guestGroups ?? []).reduce(
          (sum, g) => sum + (groupCounts.get(g.id) ?? 0),
          0,
        );
        const isEnrolled = (a.guestGroups ?? []).some((g) => g.id === group.id);
        return { activity: a, enrolledCount, isEnrolled };
      })
      .filter(
        ({ activity, enrolledCount }) =>
          activity.max_guests === null || enrolledCount < activity.max_guests,
      )
      .map(({ activity, enrolledCount, isEnrolled }) => ({
        id: activity.id,
        name: activity.name,
        icon: activity.icon,
        description: activity.description,
        date: activity.date,
        start_time: activity.start_time,
        end_time: activity.end_time,
        activity_locations: activity.activity_locations ?? null,
        max_guests: activity.max_guests,
        enrolled_count: enrolledCount,
        is_enrolled: isEnrolled,
      }));
  }

  async enroll(code: string, activityId: string): Promise<void> {
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

    const alreadyEnrolled = (activity.guestGroups ?? []).some(
      (g) => g.id === group.id,
    );
    if (alreadyEnrolled) return;

    if (activity.max_guests !== null) {
      const allGroupIds = (activity.guestGroups ?? []).map((g) => g.id);
      const counts = await this.getGroupGuestCounts(allGroupIds);
      const currentTotal = allGroupIds.reduce(
        (sum, id) => sum + (counts.get(id) ?? 0),
        0,
      );
      const groupSizeCounts = await this.getGroupGuestCounts([group.id]);
      const groupSize = groupSizeCounts.get(group.id) ?? 0;
      const newTotal = currentTotal + groupSize;
      if (newTotal > activity.max_guests) {
        const remaining = activity.max_guests - currentTotal;
        throw new ConflictException(
          `Tu grupo tiene ${groupSize} ${groupSize === 1 ? 'persona' : 'personas'} y solo quedan ${remaining} ${remaining === 1 ? 'plaza disponible' : 'plazas disponibles'} en esta actividad`,
        );
      }
    }

    activity.guestGroups = [...(activity.guestGroups ?? []), group];
    await this.activitiesRepo.save(activity);
  }

  async unenroll(code: string, activityId: string): Promise<void> {
    const group = await this.groupsRepo.findOne({
      where: { group_code: code },
    });
    if (!group) throw new NotFoundException('Código de grupo no encontrado');

    const activity = await this.activitiesRepo.findOne({
      where: { id: activityId },
      relations: ['guestGroups'],
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');

    activity.guestGroups = (activity.guestGroups ?? []).filter(
      (g) => g.id !== group.id,
    );
    await this.activitiesRepo.save(activity);
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
