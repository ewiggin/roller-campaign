import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Region } from './entities/region.entity';
import { User } from '../users/entities/user.entity';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionResponseDto } from './dto/region-response.dto';
import { RegionStatsDto } from './dto/region-stats.dto';
import {
  ImportRegionCommitDto,
  ImportRegionCommitResponseDto,
  ImportRegionParseResponseDto,
  ImportRegionRowDto,
} from './dto/import-region.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region)
    private readonly regionsRepository: Repository<Region>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreateRegionDto): Promise<RegionResponseDto> {
    const exists = await this.regionsRepository.findOne({
      where: { name: dto.name },
    });
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
    const key = `regions:${currentUser.sub}`;
    const cached = await this.cache.get<RegionResponseDto[]>(key);
    if (cached) return cached;

    let result: RegionResponseDto[];

    if (currentUser.role === 'superadmin') {
      const regions = await this.regionsRepository.find({
        relations: { coordinators: true },
      });
      result = regions.map(this.toDto);
    } else {
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
      result = regions.map(this.toDto);
    }

    await this.cache.set(key, result, 300_000);
    return result;
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
    await this.cache.clear();
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const region = await this.regionsRepository.findOne({ where: { id } });
    if (!region) throw new NotFoundException('Región no encontrada');
    await this.regionsRepository.remove(region);
    await this.cache.clear();
  }

  async addCoordinator(id: string, userId: string): Promise<RegionResponseDto> {
    const region = await this.regionsRepository.findOne({
      where: { id },
      relations: { coordinators: true },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== 'region_admin')
      throw new BadRequestException(
        'Only users with role region_admin can be assigned as coordinators',
      );

    const alreadyCoordinator = region.coordinators.some((c) => c.id === userId);
    if (!alreadyCoordinator) {
      region.coordinators.push(user);
      await this.regionsRepository.save(region);
      await this.cache.clear();
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
    await this.cache.clear();
    return this.toDto(region);
  }

  private assertAccess(region: Region, currentUser: JwtPayload): void {
    if (currentUser.role === 'superadmin') return;
    const isCoordinator = (region.coordinators ?? []).some(
      (c) => c.id === currentUser.sub,
    );
    if (!isCoordinator) throw new ForbiddenException();
  }

  async getStats(currentUser: JwtPayload): Promise<RegionStatsDto[]> {
    const key = `stats:${currentUser.sub}`;
    const cached = await this.cache.get<RegionStatsDto[]>(key);
    if (cached) return cached;

    // Resolve which regions the user can see
    let regionIds: string[] | null = null;
    if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      regionIds = (user?.regions ?? []).map((r) => r.id);
      if (regionIds.length === 0) return [];
    }

    const regions = regionIds
      ? await this.regionsRepository.find({ where: { id: In(regionIds) } })
      : await this.regionsRepository.find();

    if (regions.length === 0) return [];

    const ids = regions.map((r) => r.id);
    const isPostgres = this.dataSource.options.type === 'postgres';
    const placeholders = ids
      .map((_, i) => (isPostgres ? `$${i + 1}` : '?'))
      .join(', ');

    // Single query: counts per region using CTEs
    const rows = await this.dataSource.query<
      Array<{
        region_id: string;
        guest_count: string;
        volunteer_count: string;
        activity_count: string;
        covered_activities: string;
      }>
    >(
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

    const result = regions
      .map((r) => {
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
      })
      .sort((a, b) => a.region_name.localeCompare(b.region_name));

    await this.cache.set(key, result, 60_000);
    return result;
  }

  async exportExcel(currentUser: JwtPayload): Promise<Buffer> {
    const regions = await this.findAll(currentUser);

    const headers = [
      'name',
      'event_start_date',
      'event_end_date',
      'coordinators',
    ];
    const rows = regions.map((r) => [
      r.name,
      r.event_start_date ?? '',
      r.event_end_date ?? '',
      (r.coordinators ?? []).map((c) => c.email).join(', '),
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Regions');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  downloadTemplate(): Buffer {
    const ws = XLSX.utils.aoa_to_sheet([
      ['name', 'event_start_date', 'event_end_date'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Regions');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async parseImport(buffer: Buffer): Promise<ImportRegionParseResponseDto> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });

    const existing = await this.regionsRepository.find({ select: ['name'] });
    const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));

    const valid: ImportRegionRowDto[] = [];
    const duplicateRows: ImportRegionRowDto[] = [];
    const errors: { row: number; name: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const name = String(raw['name'] ?? '').trim();
      const rowNum = i + 2;

      if (!name) {
        errors.push({ row: rowNum, name: '', reason: 'Name is required' });
        continue;
      }

      const rowDto: ImportRegionRowDto = {
        name,
        event_start_date: String(raw['event_start_date'] ?? '').trim() || null,
        event_end_date: String(raw['event_end_date'] ?? '').trim() || null,
      };

      if (existingNames.has(name.toLowerCase())) {
        duplicateRows.push(rowDto);
      } else {
        valid.push(rowDto);
      }
    }

    return {
      valid,
      duplicateRows,
      errors,
      summary: {
        total: rows.length,
        valid: valid.length,
        duplicates: duplicateRows.length,
        errors: errors.length,
      },
    };
  }

  async commitImport(
    dto: ImportRegionCommitDto,
  ): Promise<ImportRegionCommitResponseDto> {
    let created = 0;
    let updated = 0;

    for (const row of dto.rows) {
      const exists = await this.regionsRepository.findOne({
        where: { name: row.name },
      });
      if (exists) continue;
      await this.regionsRepository.save(
        this.regionsRepository.create({
          name: row.name,
          event_start_date: row.event_start_date ?? null,
          event_end_date: row.event_end_date ?? null,
        }),
      );
      created++;
    }

    for (const row of dto.updateRows ?? []) {
      const existing = await this.regionsRepository
        .createQueryBuilder('r')
        .where('LOWER(r.name) = LOWER(:name)', { name: row.name })
        .getOne();
      if (!existing) continue;
      existing.event_start_date = row.event_start_date ?? null;
      existing.event_end_date = row.event_end_date ?? null;
      await this.regionsRepository.save(existing);
      updated++;
    }

    await this.cache.clear();
    return {
      created,
      updated,
      total: dto.rows.length + (dto.updateRows?.length ?? 0),
    };
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
