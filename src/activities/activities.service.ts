import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import { Volunteer } from '../volunteers/entities/volunteer.entity';
import { Activity } from './entities/activity.entity';
import { ActivityResponseDto } from './dto/activity-response.dto';
import { ActivityListQueryDto } from './dto/activity-list-query.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity) private readonly activitiesRepo: Repository<Activity>,
    @InjectRepository(Volunteer) private readonly volunteersRepo: Repository<Volunteer>,
    @InjectRepository(Region) private readonly regionsRepo: Repository<Region>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  async create(dto: CreateActivityDto, currentUser: JwtPayload): Promise<ActivityResponseDto> {
    await this.assertRegionAccess(dto.region_id, currentUser);
    const region = await this.regionsRepo.findOne({ where: { id: dto.region_id } });
    if (!region) throw new NotFoundException('Región no encontrada');

    const activity = this.activitiesRepo.create({
      region_id: dto.region_id,
      date: dto.date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      description: dto.description ?? null,
      volunteers: [],
    });
    const saved = await this.activitiesRepo.save(activity);
    return this.toDto(saved);
  }

  async findAll(
    query: ActivityListQueryDto,
    currentUser: JwtPayload,
  ): Promise<{ data: ActivityResponseDto[]; total: number; page: number; limit: number }> {
    if (!['superadmin', 'region_admin', 'volunteer'].includes(currentUser.role)) {
      throw new ForbiddenException();
    }
    const { regionId, date, volunteerId, page = 1, limit = 50 } = query;

    const qb = this.activitiesRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.volunteers', 'volunteers');

    if (currentUser.role === 'volunteer') {
      const v = await this.volunteersRepo.findOne({ where: { user_id: currentUser.sub } });
      if (!v) return { data: [], total: 0, page, limit };
      qb.innerJoin('a.volunteers', 'myVol', 'myVol.id = :myVolId', { myVolId: v.id });
      if (date) qb.andWhere('a.date = :date', { date });
      const total = await qb.getCount();
      const activities = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('a.date', 'ASC')
        .getMany();
      return { data: activities.map(this.toDto), total, page, limit };
    }

    if (currentUser.role === 'region_admin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const adminIds = (user?.regions ?? []).map((r) => r.id);
      if (adminIds.length === 0) return { data: [], total: 0, page, limit };

      if (regionId) {
        if (!adminIds.includes(regionId)) throw new ForbiddenException();
        qb.where('a.region_id = :regionId', { regionId });
      } else {
        qb.where('a.region_id IN (:...adminIds)', { adminIds });
      }
    } else if (regionId) {
      qb.where('a.region_id = :regionId', { regionId });
    }

    if (date) qb.andWhere('a.date = :date', { date });
    if (volunteerId) qb.andWhere('volunteers.id = :volunteerId', { volunteerId });

    const total = await qb.getCount();
    const activities = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('a.date', 'ASC')
      .addOrderBy('a.start_time', 'ASC')
      .getMany();

    return { data: activities.map(this.toDto), total, page, limit };
  }

  async findOne(id: string, currentUser: JwtPayload): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({ where: { id }, relations: { volunteers: true } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);
    return this.toDto(activity);
  }

  async update(id: string, dto: UpdateActivityDto, currentUser: JwtPayload): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({ where: { id }, relations: { volunteers: true } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    if (dto.region_id && dto.region_id !== activity.region_id) {
      await this.assertRegionAccess(dto.region_id, currentUser);
    }

    Object.assign(activity, dto);
    const saved = await this.activitiesRepo.save(activity);
    return this.toDto(saved);
  }

  async remove(id: string, currentUser: JwtPayload): Promise<void> {
    const activity = await this.activitiesRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);
    await this.activitiesRepo.remove(activity);
  }

  async assignVolunteer(id: string, volunteerId: string, currentUser: JwtPayload): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({ where: { id }, relations: { volunteers: true } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    const volunteer = await this.volunteersRepo.findOne({
      where: { id: volunteerId },
      relations: { regions: true },
    });
    if (!volunteer) throw new NotFoundException('Voluntario no encontrado');

    const inRegion = volunteer.regions.some((r) => r.id === activity.region_id);
    if (!inRegion) throw new BadRequestException('El voluntario no pertenece a la región de esta actividad');

    const already = activity.volunteers.some((v) => v.id === volunteerId);
    if (!already) {
      activity.volunteers.push(volunteer);
      await this.activitiesRepo.save(activity);
    }
    return this.toDto(activity);
  }

  async unassignVolunteer(id: string, volunteerId: string, currentUser: JwtPayload): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepo.findOne({ where: { id }, relations: { volunteers: true } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.assertRegionAccess(activity.region_id, currentUser);

    activity.volunteers = activity.volunteers.filter((v) => v.id !== volunteerId);
    await this.activitiesRepo.save(activity);
    return this.toDto(activity);
  }

  private async assertRegionAccess(regionId: string, currentUser: JwtPayload): Promise<void> {
    if (currentUser.role === 'superadmin') return;
    if (currentUser.role === 'region_admin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      if ((user?.regions ?? []).some((r) => r.id === regionId)) return;
      throw new ForbiddenException();
    }
    throw new ForbiddenException();
  }

  private toDto = (activity: Activity): ActivityResponseDto => ({
    id: activity.id,
    region_id: activity.region_id,
    date: activity.date,
    start_time: activity.start_time,
    end_time: activity.end_time,
    description: activity.description,
    volunteers: (activity.volunteers ?? []).map((v) => ({
      id: v.id,
      volunteer_code: v.volunteer_code,
      full_name: v.full_name,
    })),
    volunteer_count: (activity.volunteers ?? []).length,
    created_at: activity.created_at,
    updated_at: activity.updated_at,
  });
}
