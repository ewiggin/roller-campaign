import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Guest } from '../guests/entities/guest.entity';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import { Volunteer } from '../volunteers/entities/volunteer.entity';
import { ActivityListQueryDto } from './dto/activity-list-query.dto';
import {
  ActivityResponseDto,
  AvailableGroupForActivityDto,
  AvailableVolunteerForActivityDto,
} from './dto/activity-response.dto';
import {
  CreateActivityBatchDto,
  RepetitionDto,
} from './dto/create-activity-batch.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { Activity } from './entities/activity.entity';

const ACTIVITY_RELATIONS = { volunteers: true, guestGroups: true, host: true };

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activitiesRepo: Repository<Activity>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepo: Repository<Volunteer>,
    @InjectRepository(GuestGroup)
    private readonly groupsRepo: Repository<GuestGroup>,
    @InjectRepository(Guest) private readonly guestsRepo: Repository<Guest>,
    @InjectRepository(Region) private readonly regionsRepo: Repository<Region>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  async create(
    dto: CreateActivityDto,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    await this.assertRegionAccess(dto.region_id, currentUser);
    const region = await this.regionsRepo.findOne({
      where: { id: dto.region_id },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    const activity = this.activitiesRepo.create({
      region_id: dto.region_id,
      name: dto.name,
      icon: dto.icon ?? null,
      description: dto.description ?? null,
      host_id: dto.host_id ?? null,
      date: dto.date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      activity_address: dto.activity_address ?? null,
      activity_lat: dto.activity_lat ?? null,
      activity_lng: dto.activity_lng ?? null,
      departure_address: dto.departure_address ?? null,
      departure_lat: dto.departure_lat ?? null,
      departure_lng: dto.departure_lng ?? null,
      status: 'draft',
      volunteers: [],
      guestGroups: [],
    });
    const saved = await this.activitiesRepo.save(activity);
    return this.toDto(saved);
  }

  async createBatch(
    dto: CreateActivityBatchDto,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto[]> {
    await this.assertRegionAccess(dto.region_id, currentUser);
    const region = await this.regionsRepo.findOne({
      where: { id: dto.region_id },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    const dates = this.generateDates(dto.date, dto.repetition);
    const seriesId = crypto.randomUUID();
    const saved = await Promise.all(
      dates.map((date) =>
        this.activitiesRepo.save(
          this.activitiesRepo.create({
            series_id: seriesId,
            region_id: dto.region_id,
            name: dto.name,
            icon: dto.icon ?? null,
            description: dto.description ?? null,
            host_id: dto.host_id ?? null,
            date,
            start_time: dto.start_time,
            end_time: dto.end_time,
            activity_address: dto.activity_address ?? null,
            activity_lat: dto.activity_lat ?? null,
            activity_lng: dto.activity_lng ?? null,
            departure_address: dto.departure_address ?? null,
            departure_lat: dto.departure_lat ?? null,
            departure_lng: dto.departure_lng ?? null,
            status: 'draft',
            volunteers: [],
            guestGroups: [],
          }),
        ),
      ),
    );
    return saved.map((a) => this.toDto(a));
  }

  private generateDates(base: string, rep: RepetitionDto): string[] {
    const [y, m, d] = base.split('-').map(Number);
    const pad = (n: number) => String(n).padStart(2, '0');
    return Array.from({ length: rep.count }, (_, i) => {
      const cur = new Date(y, m - 1, d);
      if (rep.type === 'daily') cur.setDate(d + i);
      else if (rep.type === 'weekly') cur.setDate(d + i * 7);
      // same_day: date unchanged
      return `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
    });
  }

  async findAll(
    query: ActivityListQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    data: ActivityResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      regionId,
      date,
      dateFrom,
      dateTo,
      hostId,
      volunteerId,
      page = 1,
      limit = 50,
    } = query;

    const qb = this.activitiesRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.volunteers', 'volunteers')
      .leftJoinAndSelect('a.guestGroups', 'guestGroups');

    if (currentUser.role === 'volunteer') {
      const v = await this.volunteersRepo.findOne({
        where: { user_id: currentUser.sub },
      });
      if (!v) return { data: [], total: 0, page, limit };
      qb.innerJoin('a.volunteers', 'myVol', 'myVol.id = :myVolId', {
        myVolId: v.id,
      });
      if (date) qb.andWhere('a.date = :date', { date });
      const total = await qb.getCount();
      const activities = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('a.date', 'ASC')
        .getMany();
      const groupCounts = await this.getGroupGuestCounts([
        ...new Set(
          activities.flatMap((a) => (a.guestGroups ?? []).map((g) => g.id)),
        ),
      ]);
      return {
        data: activities.map((a) => this.toDto(a, groupCounts)),
        total,
        page,
        limit,
      };
    }

    if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const adminIds = (user?.regions ?? []).map((r) => r.id);
      if (adminIds.length === 0) return { data: [], total: 0, page, limit };

      if (regionId && adminIds.includes(regionId)) {
        qb.where('a.region_id = :regionId', { regionId });
      } else {
        qb.where('a.region_id IN (:...adminIds)', { adminIds });
      }
    } else if (regionId) {
      qb.where('a.region_id = :regionId', { regionId });
    }

    if (date) qb.andWhere('a.date = :date', { date });
    if (dateFrom) qb.andWhere('a.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('a.date <= :dateTo', { dateTo });
    if (hostId) qb.andWhere('a.host_id = :hostId', { hostId });
    if (volunteerId)
      qb.andWhere('volunteers.id = :volunteerId', { volunteerId });

    const total = await qb.getCount();
    const activities = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('a.date', 'ASC')
      .addOrderBy('a.start_time', 'ASC')
      .getMany();

    const groupCounts = await this.getGroupGuestCounts([
      ...new Set(
        activities.flatMap((a) => (a.guestGroups ?? []).map((g) => g.id)),
      ),
    ]);
    return {
      data: activities.map((a) => this.toDto(a, groupCounts)),
      total,
      page,
      limit,
    };
  }

  async findOne(
    id: string,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);
    return this.toDtoWithCounts(activity);
  }

  async update(
    id: string,
    dto: UpdateActivityDto,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    if (dto.region_id && dto.region_id !== activity.region_id) {
      await this.assertRegionAccess(dto.region_id, currentUser);
    }

    const { detach_from_series, ...fields } = dto;
    if (detach_from_series) activity.series_id = null;
    Object.assign(activity, fields);
    const saved = await this.activitiesRepo.save(activity);
    return this.toDtoWithCounts(saved);
  }

  async updateSeriesFromDate(
    id: string,
    dto: UpdateActivityDto,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    // Fields that propagate to all future activities (date and region stay per-activity)
    const {
      date: _d,
      region_id: _r,
      detach_from_series: _s,
      ...sharedFields
    } = dto;

    if (!activity.series_id) {
      Object.assign(activity, sharedFields);
      const saved = await this.activitiesRepo.save(activity);
      return this.toDtoWithCounts(saved);
    }

    const futureActivities = await this.activitiesRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.volunteers', 'volunteers')
      .leftJoinAndSelect('a.guestGroups', 'guestGroups')
      .leftJoinAndSelect('a.host', 'host')
      .where('a.series_id = :seriesId', { seriesId: activity.series_id })
      .andWhere('a.date >= :date', { date: activity.date })
      .getMany();

    await Promise.all(
      futureActivities.map((a) => {
        Object.assign(a, sharedFields);
        return this.activitiesRepo.save(a);
      }),
    );

    const refreshed = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    return this.toDtoWithCounts(refreshed!);
  }

  async remove(id: string, currentUser: JwtPayload): Promise<void> {
    const activity = await this.activitiesRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);
    if (activity.status === 'published')
      throw new BadRequestException('Published activities cannot be deleted');
    await this.activitiesRepo.remove(activity);
  }

  async removeSeriesFromDate(
    id: string,
    currentUser: JwtPayload,
  ): Promise<void> {
    const activity = await this.activitiesRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);
    if (activity.status === 'published')
      throw new BadRequestException('Published activities cannot be deleted');

    if (!activity.series_id) {
      await this.activitiesRepo.remove(activity);
      return;
    }

    await this.activitiesRepo
      .createQueryBuilder()
      .delete()
      .from(Activity)
      .where('series_id = :seriesId AND date >= :date', {
        seriesId: activity.series_id,
        date: activity.date,
      })
      .execute();
  }

  async assignVolunteer(
    id: string,
    volunteerId: string,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    const volunteer = await this.volunteersRepo.findOne({
      where: { id: volunteerId },
      relations: { regions: true },
    });
    if (!volunteer) throw new NotFoundException('Voluntario no encontrado');

    if (!volunteer.regions.some((r) => r.id === activity.region_id)) {
      throw new BadRequestException(
        'El voluntario no pertenece a la región de esta actividad',
      );
    }

    if (!activity.volunteers.some((v) => v.id === volunteerId)) {
      activity.volunteers.push(volunteer);
      await this.activitiesRepo.save(activity);
    }
    return this.toDtoWithCounts(activity);
  }

  async unassignVolunteer(
    id: string,
    volunteerId: string,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    activity.volunteers = activity.volunteers.filter(
      (v) => v.id !== volunteerId,
    );
    await this.activitiesRepo.save(activity);
    return this.toDtoWithCounts(activity);
  }

  async assignGuestGroup(
    id: string,
    groupId: string,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    const group = await this.groupsRepo.findOne({
      where: { id: groupId },
      relations: ['host'],
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    if (group.region_id !== activity.region_id) {
      throw new BadRequestException(
        'El grupo no pertenece a la región de esta actividad',
      );
    }

    if (group.available_from && activity.date < group.available_from) {
      throw new BadRequestException(
        'La fecha de la actividad es anterior al inicio de disponibilidad del grupo',
      );
    }
    if (group.available_to && activity.date > group.available_to) {
      throw new BadRequestException(
        'La fecha de la actividad es posterior al fin de disponibilidad del grupo',
      );
    }

    if (
      this.hasHostScheduleConflict(
        activity.date,
        activity.start_time,
        activity.end_time,
        (group as any).host ?? null,
      )
    ) {
      throw new BadRequestException(
        'La actividad coincide con el horario de reunión del anfitrión del grupo',
      );
    }

    // Check time conflict: group already assigned to another activity overlapping in date+time
    const conflict = await this.activitiesRepo
      .createQueryBuilder('a')
      .innerJoin('a.guestGroups', 'g')
      .where('g.id = :groupId', { groupId })
      .andWhere('a.id != :actId', { actId: activity.id })
      .andWhere('a.date = :date', { date: activity.date })
      .andWhere('a.start_time < :endTime', { endTime: activity.end_time })
      .andWhere('a.end_time > :startTime', { startTime: activity.start_time })
      .getCount();
    if (conflict > 0) {
      throw new BadRequestException(
        'El grupo ya está asignado a otra actividad que se solapa en fecha y hora',
      );
    }

    if (!activity.guestGroups.some((g) => g.id === groupId)) {
      activity.guestGroups.push(group);
      await this.activitiesRepo.save(activity);
    }
    return this.toDtoWithCounts(activity);
  }

  async unassignGuestGroup(
    id: string,
    groupId: string,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    activity.guestGroups = activity.guestGroups.filter((g) => g.id !== groupId);
    await this.activitiesRepo.save(activity);
    return this.toDtoWithCounts(activity);
  }

  async publish(
    id: string,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    activity.status = 'published';
    await this.activitiesRepo.save(activity);
    return this.toDtoWithCounts(activity);
  }

  async unpublish(
    id: string,
    currentUser: JwtPayload,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ACTIVITY_RELATIONS,
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    activity.status = 'draft';
    await this.activitiesRepo.save(activity);
    return this.toDtoWithCounts(activity);
  }

  async getAvailableVolunteers(
    id: string,
    currentUser: JwtPayload,
  ): Promise<AvailableVolunteerForActivityDto[]> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: { volunteers: true },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    const assignedToThis = new Set(activity.volunteers.map((v) => v.id));

    const conflictRows = await this.activitiesRepo
      .createQueryBuilder('a')
      .innerJoin('a.volunteers', 'v')
      .select('v.id', 'volunteerId')
      .where('a.region_id = :regionId', { regionId: activity.region_id })
      .andWhere('a.id != :actId', { actId: activity.id })
      .andWhere('a.date = :date', { date: activity.date })
      .andWhere('a.start_time < :endTime', { endTime: activity.end_time })
      .andWhere('a.end_time > :startTime', { startTime: activity.start_time })
      .getRawMany<{ volunteerId: string }>();
    const conflictingIds = new Set(conflictRows.map((r) => r.volunteerId));

    const region = await this.regionsRepo.findOne({
      where: { id: activity.region_id },
    });
    const dayLabel = this.getAvailabilityDayLabel(
      activity.date,
      region?.event_start_date ?? null,
      region?.event_end_date ?? null,
    );
    const hasMorning = activity.start_time < '13:30';
    const hasAfternoon = activity.end_time > '13:30';
    const shiftCondition =
      hasMorning && !hasAfternoon
        ? `v.${dayLabel}_morning = true`
        : !hasMorning && hasAfternoon
          ? `v.${dayLabel}_afternoon = true`
          : `(v.${dayLabel}_morning = true OR v.${dayLabel}_afternoon = true)`;

    const volunteers = await this.volunteersRepo
      .createQueryBuilder('v')
      .innerJoin('v.regions', 'r', 'r.id = :regionId', {
        regionId: activity.region_id,
      })
      .leftJoinAndSelect('v.roles', 'roles')
      .where('v.is_active = true')
      .andWhere(
        `(NOT EXISTS (
          SELECT 1 FROM volunteer_availability _va
          WHERE _va.volunteer_id = v.id AND _va.region_id = :avRegion
        ) OR EXISTS (
          SELECT 1 FROM volunteer_availability _va2
          WHERE _va2.volunteer_id = v.id AND _va2.region_id = :avRegion AND _va2.date = :avDate
        ))`,
        { avRegion: activity.region_id, avDate: activity.date },
      )
      .andWhere(shiftCondition)
      .orderBy('v.full_name', 'ASC')
      .getMany();

    return volunteers
      .filter((v) => !assignedToThis.has(v.id))
      .map((v) => ({
        id: v.id,
        volunteer_code: v.volunteer_code,
        full_name: v.full_name,
        roles: (v.roles ?? []).map((role) => ({
          id: role.id,
          name: role.name,
        })),
        already_in_activity: conflictingIds.has(v.id),
      }));
  }

  private getAvailabilityDayLabel(
    date: string,
    eventStartDate: string | null,
    eventEndDate: string | null,
  ): string {
    if (eventStartDate) {
      const startJsDay = new Date(eventStartDate + 'T00:00:00').getDay();
      const daysBack = (startJsDay - 6 + 7) % 7 || 7;
      const satPrev = this.shiftDays(eventStartDate, -daysBack);
      const sunPrev = this.shiftDays(eventStartDate, -daysBack + 1);
      if (date === satPrev) return 'saturday_prev';
      if (date === sunPrev) return 'sunday_prev';
    }
    if (eventEndDate) {
      const endJsDay = new Date(eventEndDate + 'T00:00:00').getDay();
      const daysForward = (8 - endJsDay) % 7 || 7;
      const monNext = this.shiftDays(eventEndDate, daysForward);
      if (date === monNext) return 'monday_next';
    }
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days[new Date(date + 'T00:00:00').getDay()];
  }

  private shiftDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async getAvailableGroups(
    id: string,
    currentUser: JwtPayload,
  ): Promise<AvailableGroupForActivityDto[]> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: { guestGroups: true },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    const assignedIds = new Set(activity.guestGroups.map((g) => g.id));

    // Groups already assigned to other activities overlapping in date+time
    const conflictRows = await this.activitiesRepo
      .createQueryBuilder('a')
      .innerJoin('a.guestGroups', 'g')
      .select('g.id', 'groupId')
      .where('a.region_id = :regionId', { regionId: activity.region_id })
      .andWhere('a.id != :actId', { actId: activity.id })
      .andWhere('a.date = :date', { date: activity.date })
      .andWhere('a.start_time < :endTime', { endTime: activity.end_time })
      .andWhere('a.end_time > :startTime', { startTime: activity.start_time })
      .getRawMany<{ groupId: string }>();
    const conflictingGroupIds = new Set(conflictRows.map((r) => r.groupId));

    const [groups, guests] = await Promise.all([
      this.groupsRepo.find({
        where: { region_id: activity.region_id },
        relations: ['host'],
      }),
      this.guestsRepo.find({
        where: { region_id: activity.region_id },
        select: {
          id: true,
          group_id: true,
          available_from: true,
          available_to: true,
        },
      }),
    ]);

    const guestsByGroup = new Map<
      string,
      { available_from: string | null; available_to: string | null }[]
    >();
    for (const g of guests) {
      if (!guestsByGroup.has(g.group_id)) guestsByGroup.set(g.group_id, []);
      guestsByGroup.get(g.group_id)!.push({
        available_from: g.available_from,
        available_to: g.available_to,
      });
    }

    const result: AvailableGroupForActivityDto[] = [];

    for (const group of groups) {
      if (assignedIds.has(group.id)) continue;

      // Filter by the group's own availability window
      if (group.available_from && activity.date < group.available_from)
        continue;
      if (group.available_to && activity.date > group.available_to) continue;

      const groupGuests = guestsByGroup.get(group.id) ?? [];
      if (groupGuests.length > 0 && activity.date) {
        const hasAvailabilityData = groupGuests.some(
          (g) => g.available_from || g.available_to,
        );
        if (hasAvailabilityData) {
          const anyAvailable = groupGuests.some((g) => {
            if (g.available_from && activity.date > g.available_from === false)
              return false;
            if (g.available_from && activity.date < g.available_from)
              return false;
            if (g.available_to && activity.date > g.available_to) return false;
            return true;
          });
          if (!anyAvailable) continue;
        }
      }

      const host = (group as any).host as {
        lat: number | null;
        lng: number | null;
        name: string;
        weekday_meeting_day: number | null;
        weekday_meeting_time: string | null;
        weekend_meeting_day: number | null;
        weekend_meeting_time: string | null;
      } | null;
      const distance_km =
        activity.activity_lat && activity.activity_lng && host?.lat && host?.lng
          ? this.haversineKm(
              activity.activity_lat,
              activity.activity_lng,
              host.lat,
              host.lng,
            )
          : null;

      result.push({
        id: group.id,
        group_code: group.group_code,
        host_id: group.host_id,
        host_name: host?.name ?? null,
        host_lat: host?.lat ?? null,
        host_lng: host?.lng ?? null,
        distance_km:
          distance_km !== null ? Math.round(distance_km * 10) / 10 : null,
        guest_count: groupGuests.length,
        already_in_activity: conflictingGroupIds.has(group.id),
        host_schedule_conflict: this.hasHostScheduleConflict(
          activity.date,
          activity.start_time,
          activity.end_time,
          host,
        ),
      });
    }

    return result.sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return 0;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });
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

  private async toDtoWithCounts(
    activity: Activity,
  ): Promise<ActivityResponseDto> {
    const groupIds = (activity.guestGroups ?? []).map((g) => g.id);
    const counts = await this.getGroupGuestCounts(groupIds);
    return this.toDto(activity, counts);
  }

  private hasHostScheduleConflict(
    activityDate: string,
    startTime: string,
    endTime: string,
    host: {
      weekday_meeting_day: number | null;
      weekday_meeting_time: string | null;
      weekend_meeting_day: number | null;
      weekend_meeting_time: string | null;
    } | null,
  ): boolean {
    if (!host) return false;

    const jsDay = new Date(activityDate + 'T00:00:00').getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay; // convert JS 0=Sun to 1=Mon…7=Sun

    const inRange = (t: string) => t >= startTime && t < endTime;

    if (
      host.weekday_meeting_day === dayOfWeek &&
      host.weekday_meeting_time !== null &&
      inRange(host.weekday_meeting_time)
    )
      return true;

    if (
      host.weekend_meeting_day === dayOfWeek &&
      host.weekend_meeting_time !== null &&
      inRange(host.weekend_meeting_time)
    )
      return true;

    return false;
  }

  private haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async assertRegionAccess(
    regionId: string,
    currentUser: JwtPayload,
  ): Promise<void> {
    if (currentUser.role === 'superadmin') return;
    const user = await this.usersRepo.findOne({
      where: { id: currentUser.sub },
      relations: { regions: true },
    });
    if ((user?.regions ?? []).some((r) => r.id === regionId)) return;
    throw new ForbiddenException();
  }

  private toDto = (
    activity: Activity,
    groupCounts: Map<string, number> = new Map(),
  ): ActivityResponseDto => ({
    id: activity.id,
    region_id: activity.region_id,
    series_id: activity.series_id,
    name: activity.name,
    icon: activity.icon,
    description: activity.description,
    status: activity.status,
    host_id: activity.host_id,
    host_name: activity.host?.name ?? null,
    date: activity.date,
    start_time: activity.start_time,
    end_time: activity.end_time,
    activity_address: activity.activity_address,
    activity_lat: activity.activity_lat,
    activity_lng: activity.activity_lng,
    departure_address: activity.departure_address,
    departure_lat: activity.departure_lat,
    departure_lng: activity.departure_lng,
    volunteers: (activity.volunteers ?? []).map((v) => ({
      id: v.id,
      volunteer_code: v.volunteer_code,
      full_name: v.full_name,
    })),
    volunteer_count: (activity.volunteers ?? []).length,
    guest_groups: (activity.guestGroups ?? []).map((g) => ({
      id: g.id,
      group_code: g.group_code,
      guest_count: groupCounts.get(g.id) ?? 0,
    })),
    total_guests_assigned: (activity.guestGroups ?? []).reduce(
      (sum, g) => sum + (groupCounts.get(g.id) ?? 0),
      0,
    ),
    created_at: activity.created_at,
    updated_at: activity.updated_at,
  });
}
