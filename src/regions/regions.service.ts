import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Region } from './entities/region.entity';
import { User } from '../users/entities/user.entity';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionResponseDto } from './dto/region-response.dto';
import { RegionStatsDto } from './dto/region-stats.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region)
    private readonly regionsRepository: Repository<Region>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateRegionDto): Promise<RegionResponseDto> {
    const exists = await this.regionsRepository.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('El nombre de región ya existe');

    const region = this.regionsRepository.create({
      name: dto.name,
      event_start_date: dto.event_start_date ?? null,
      event_end_date: dto.event_end_date ?? null,
    });
    const saved = await this.regionsRepository.save(region);
    saved.coordinators = [];
    return this.toDto(saved);
  }

  async findAll(currentUser: JwtPayload): Promise<RegionResponseDto[]> {
    if (currentUser.role === 'superadmin') {
      const regions = await this.regionsRepository.find({
        relations: { coordinators: true },
      });
      return regions.map(this.toDto);
    }

    if (currentUser.role === 'region_admin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const ids = (user?.regions ?? []).map((r) => r.id);
      if (ids.length === 0) return [];
      const regions = await this.regionsRepository.find({
        where: { id: In(ids) },
        relations: { coordinators: true },
      });
      return regions.map(this.toDto);
    }

    throw new ForbiddenException();
  }

  async findOne(
    id: string,
    currentUser: JwtPayload,
  ): Promise<RegionResponseDto> {
    const region = await this.regionsRepository.findOne({
      where: { id },
      relations: { coordinators: true },
    });
    if (!region) throw new NotFoundException('Región no encontrada');
    this.assertAccess(region, currentUser);
    return this.toDto(region);
  }

  async update(
    id: string,
    dto: UpdateRegionDto,
    currentUser: JwtPayload,
  ): Promise<RegionResponseDto> {
    const region = await this.regionsRepository.findOne({
      where: { id },
      relations: { coordinators: true },
    });
    if (!region) throw new NotFoundException('Región no encontrada');
    this.assertAccess(region, currentUser);
    Object.assign(region, dto);
    const saved = await this.regionsRepository.save(region);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const region = await this.regionsRepository.findOne({ where: { id } });
    if (!region) throw new NotFoundException('Región no encontrada');
    await this.regionsRepository.remove(region);
  }

  async addCoordinator(id: string, userId: string): Promise<RegionResponseDto> {
    const region = await this.regionsRepository.findOne({
      where: { id },
      relations: { coordinators: true },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== 'region_admin') {
      throw new BadRequestException(
        'Solo usuarios con rol region_admin pueden ser coordinadores',
      );
    }

    const alreadyCoordinator = region.coordinators.some((c) => c.id === userId);
    if (!alreadyCoordinator) {
      region.coordinators.push(user);
      await this.regionsRepository.save(region);
    }

    return this.toDto(region);
  }

  async removeCoordinator(
    id: string,
    userId: string,
  ): Promise<RegionResponseDto> {
    const region = await this.regionsRepository.findOne({
      where: { id },
      relations: { coordinators: true },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    region.coordinators = region.coordinators.filter((c) => c.id !== userId);
    await this.regionsRepository.save(region);
    return this.toDto(region);
  }

  private assertAccess(region: Region, currentUser: JwtPayload): void {
    if (currentUser.role === 'superadmin') return;
    if (currentUser.role === 'region_admin') {
      const isCoordinator = (region.coordinators ?? []).some(
        (c) => c.id === currentUser.sub,
      );
      if (!isCoordinator) throw new ForbiddenException();
      return;
    }
    throw new ForbiddenException();
  }

  async getStats(currentUser: JwtPayload): Promise<RegionStatsDto[]> {
    // Resolve which regions the user can see
    let regionIds: string[] | null = null;
    if (currentUser.role === 'region_admin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      regionIds = (user?.regions ?? []).map((r) => r.id);
      if (regionIds.length === 0) return [];
    } else if (currentUser.role !== 'superadmin') {
      return [];
    }

    const regions = regionIds
      ? await this.regionsRepository.find({ where: { id: In(regionIds) } })
      : await this.regionsRepository.find();

    if (regions.length === 0) return [];

    const ids = regions.map((r) => r.id);
    const isPostgres = this.dataSource.options.type === 'postgres';
    const placeholders = ids.map((_, i) => isPostgres ? `$${i + 1}` : '?').join(', ');

    // Single query: counts per region using CTEs
    const rows = await this.dataSource.query<Array<{
      region_id: string;
      guest_count: string;
      volunteer_count: string;
      activity_count: string;
      covered_activities: string;
    }>>(
      `SELECT
        r.id AS region_id,
        COUNT(DISTINCT g.id) AS guest_count,
        COUNT(DISTINCT vr."volunteersId") AS volunteer_count,
        COUNT(DISTINCT a.id) AS activity_count,
        COUNT(DISTINCT CASE WHEN av."activitiesId" IS NOT NULL THEN a.id END) AS covered_activities
      FROM regions r
      LEFT JOIN guests g ON g.region_id = r.id
      LEFT JOIN volunteer_regions vr ON vr."regionsId" = r.id
      LEFT JOIN activities a ON a.region_id = r.id
      LEFT JOIN activity_volunteers av ON av."activitiesId" = a.id
      WHERE r.id IN (${placeholders})
      GROUP BY r.id`,
      ids,
    );

    const statsMap = new Map(rows.map((row) => [row.region_id, row]));

    return regions.map((r) => {
      const s = statsMap.get(r.id);
      const dto = new RegionStatsDto();
      dto.region_id = r.id;
      dto.region_name = r.name;
      dto.event_start_date = r.event_start_date;
      dto.event_end_date = r.event_end_date;
      dto.guest_count = parseInt(s?.guest_count ?? '0', 10);
      dto.volunteer_count = parseInt(s?.volunteer_count ?? '0', 10);
      dto.activity_count = parseInt(s?.activity_count ?? '0', 10);
      dto.covered_activities = parseInt(s?.covered_activities ?? '0', 10);
      return dto;
    }).sort((a, b) => a.region_name.localeCompare(b.region_name));
  }

  private toDto(region: Region): RegionResponseDto {
    const dto = new RegionResponseDto();
    dto.id = region.id;
    dto.name = region.name;
    dto.event_start_date = region.event_start_date;
    dto.event_end_date = region.event_end_date;
    dto.coordinators = (region.coordinators ?? []).map((c) => ({
      id: c.id,
      email: c.email,
      role: c.role,
    }));
    dto.created_at = region.created_at;
    dto.updated_at = region.updated_at;
    return dto;
  }
}
