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
import { CreateTurnDto } from './dto/create-turn.dto';
import { TurnListQueryDto } from './dto/turn-list-query.dto';
import { TurnResponseDto } from './dto/turn-response.dto';
import { UpdateTurnDto } from './dto/update-turn.dto';
import { Turn } from './entities/turn.entity';

@Injectable()
export class TurnsService {
  constructor(
    @InjectRepository(Turn) private readonly turnsRepo: Repository<Turn>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepo: Repository<Volunteer>,
    @InjectRepository(Region) private readonly regionsRepo: Repository<Region>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  async create(
    dto: CreateTurnDto,
    currentUser: JwtPayload,
  ): Promise<TurnResponseDto> {
    await this.assertRegionAccess(dto.region_id, currentUser);
    const region = await this.regionsRepo.findOne({
      where: { id: dto.region_id },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    const turn = this.turnsRepo.create({
      region_id: dto.region_id,
      date: dto.date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      description: dto.description ?? null,
      volunteers: [],
    });
    const saved = await this.turnsRepo.save(turn);
    return this.toDto(saved);
  }

  async findAll(
    query: TurnListQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    data: TurnResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (
      !['superadmin', 'region_admin', 'volunteer'].includes(currentUser.role)
    ) {
      throw new ForbiddenException();
    }
    const { regionId, date, volunteerId, page = 1, limit = 50 } = query;

    const qb = this.turnsRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.volunteers', 'volunteers');

    if (currentUser.role === 'volunteer') {
      const v = await this.volunteersRepo.findOne({
        where: { user_id: currentUser.sub },
      });
      if (!v) return { data: [], total: 0, page, limit };
      qb.innerJoin('t.volunteers', 'myVol', 'myVol.id = :myVolId', {
        myVolId: v.id,
      });
      if (date) qb.andWhere('t.date = :date', { date });
      const total = await qb.getCount();
      const turns = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('t.date', 'ASC')
        .getMany();
      return { data: turns.map(this.toDto), total, page, limit };
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
        qb.where('t.region_id = :regionId', { regionId });
      } else {
        qb.where('t.region_id IN (:...adminIds)', { adminIds });
      }
    } else if (regionId) {
      qb.where('t.region_id = :regionId', { regionId });
    }

    if (date) qb.andWhere('t.date = :date', { date });
    if (volunteerId)
      qb.andWhere('volunteers.id = :volunteerId', { volunteerId });

    const total = await qb.getCount();
    const turns = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('t.date', 'ASC')
      .addOrderBy('t.start_time', 'ASC')
      .getMany();

    return { data: turns.map(this.toDto), total, page, limit };
  }

  async findOne(id: string, currentUser: JwtPayload): Promise<TurnResponseDto> {
    const turn = await this.turnsRepo.findOne({
      where: { id },
      relations: { volunteers: true },
    });
    if (!turn) throw new NotFoundException('Turno no encontrado');
    await this.assertRegionAccess(turn.region_id, currentUser);
    return this.toDto(turn);
  }

  async update(
    id: string,
    dto: UpdateTurnDto,
    currentUser: JwtPayload,
  ): Promise<TurnResponseDto> {
    const turn = await this.turnsRepo.findOne({
      where: { id },
      relations: { volunteers: true },
    });
    if (!turn) throw new NotFoundException('Turno no encontrado');
    await this.assertRegionAccess(turn.region_id, currentUser);

    if (dto.region_id && dto.region_id !== turn.region_id) {
      await this.assertRegionAccess(dto.region_id, currentUser);
    }

    Object.assign(turn, dto);
    const saved = await this.turnsRepo.save(turn);
    return this.toDto(saved);
  }

  async remove(id: string, currentUser: JwtPayload): Promise<void> {
    const turn = await this.turnsRepo.findOne({ where: { id } });
    if (!turn) throw new NotFoundException('Turno no encontrado');
    await this.assertRegionAccess(turn.region_id, currentUser);
    await this.turnsRepo.remove(turn);
  }

  async assignVolunteer(
    id: string,
    volunteerId: string,
    currentUser: JwtPayload,
  ): Promise<TurnResponseDto> {
    const turn = await this.turnsRepo.findOne({
      where: { id },
      relations: { volunteers: true },
    });
    if (!turn) throw new NotFoundException('Turno no encontrado');
    await this.assertRegionAccess(turn.region_id, currentUser);

    const volunteer = await this.volunteersRepo.findOne({
      where: { id: volunteerId },
      relations: { regions: true },
    });
    if (!volunteer) throw new NotFoundException('Voluntario no encontrado');

    const inRegion = volunteer.regions.some((r) => r.id === turn.region_id);
    if (!inRegion)
      throw new BadRequestException(
        'El voluntario no pertenece a la región de este turno',
      );

    const already = turn.volunteers.some((v) => v.id === volunteerId);
    if (!already) {
      turn.volunteers.push(volunteer);
      await this.turnsRepo.save(turn);
    }
    return this.toDto(turn);
  }

  async unassignVolunteer(
    id: string,
    volunteerId: string,
    currentUser: JwtPayload,
  ): Promise<TurnResponseDto> {
    const turn = await this.turnsRepo.findOne({
      where: { id },
      relations: { volunteers: true },
    });
    if (!turn) throw new NotFoundException('Turno no encontrado');
    await this.assertRegionAccess(turn.region_id, currentUser);

    turn.volunteers = turn.volunteers.filter((v) => v.id !== volunteerId);
    await this.turnsRepo.save(turn);
    return this.toDto(turn);
  }

  private async assertRegionAccess(
    regionId: string,
    currentUser: JwtPayload,
  ): Promise<void> {
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

  private toDto = (turn: Turn): TurnResponseDto => ({
    id: turn.id,
    region_id: turn.region_id,
    date: turn.date,
    start_time: turn.start_time,
    end_time: turn.end_time,
    description: turn.description,
    volunteers: (turn.volunteers ?? []).map((v) => ({
      id: v.id,
      volunteer_code: v.volunteer_code,
      full_name: v.full_name,
    })),
    volunteer_count: (turn.volunteers ?? []).length,
    created_at: turn.created_at,
    updated_at: turn.updated_at,
  });
}
