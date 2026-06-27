import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Guest } from '../guests/entities/guest.entity';
import { Host } from '../hosts/entities/host.entity';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import {
  computeGroupAggregates,
  GroupAggregates,
  GuestAggregateInput,
} from './aggregates';
import { CommitGroupImportDto } from './dto/commit-group-import.dto';
import { CreateGuestGroupDto } from './dto/create-guest-group.dto';
import { GuestGroupResponseDto } from './dto/guest-group-response.dto';
import { ImportGroupResponseDto } from './dto/import-group-response.dto';
import { ImportGroupRowDto } from './dto/import-group-row.dto';
import { ParseGroupResponseDto } from './dto/parse-group-response.dto';
import { RecomputeAggregatesResponseDto } from './dto/recompute-aggregates-response.dto';
import { UpdateGuestGroupDto } from './dto/update-guest-group.dto';
import { GuestGroup } from './entities/guest-group.entity';

const IMPORT_COLUMN_MAP: Record<string, string> = {
  group_code: 'group_code',
  region_name: 'region_name',
  host_name: 'host_name',
  available_from: 'available_from',
  start_date: 'available_from',
  available_to: 'available_to',
  end_date: 'available_to',
  composition: 'composition',
  group_type: 'composition',
  car_count: 'car_count',
};

@Injectable()
export class GuestGroupsService {
  constructor(
    @InjectRepository(GuestGroup)
    private readonly groupsRepository: Repository<GuestGroup>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Region)
    private readonly regionsRepository: Repository<Region>,
    @InjectRepository(Guest)
    private readonly guestsRepository: Repository<Guest>,
    @InjectRepository(Host)
    private readonly hostsRepository: Repository<Host>,
  ) {}

  async create(
    dto: CreateGuestGroupDto,
    currentUser: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    await this.assertRegionAccess(dto.region_id, currentUser);

    const region = await this.regionsRepository.findOne({
      where: { id: dto.region_id },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    const exists = await this.groupsRepository.findOne({
      where: { group_code: dto.group_code },
    });
    if (exists) throw new ConflictException('El código de grupo ya existe');

    const group = this.groupsRepository.create({
      group_code: dto.group_code,
      region_id: dto.region_id,
    });
    const saved = await this.groupsRepository.save(group);
    return this.toDto(saved, 0);
  }

  async findAll(
    regionId: string | undefined,
    currentUser: JwtPayload,
    page = 1,
    limit = 50,
    search?: string,
    minCarSeats?: number,
    languages: string[] = [],
    compositions: string[] = [],
    hasCars?: boolean,
    hostId?: string,
    noHost?: boolean,
  ): Promise<{
    data: GuestGroupResponseDto[];
    total: number;
    page: number;
    limit: number;
    available_languages: string[];
  }> {
    const query = this.groupsRepository
      .createQueryBuilder('gg')
      .loadRelationCountAndMap('gg.guest_count', 'gg.guests')
      .orderBy('gg.group_code', 'ASC');

    // Track region constraints for the available_languages query
    let accessibleIds: string[] | null = null;

    if (regionId) {
      await this.assertRegionAccess(regionId, currentUser);
      query.where('gg.region_id = :regionId', { regionId });
    } else if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const ids = (user?.regions ?? []).map((r) => r.id);
      if (ids.length === 0)
        return { data: [], total: 0, page, limit, available_languages: [] };
      query.where('gg.region_id IN (:...ids)', { ids });
      accessibleIds = ids;
    }

    if (search) {
      query.andWhere('gg.group_code LIKE :search', { search: `%${search}%` });
    }

    if (compositions.length > 0) {
      query.andWhere('gg.composition IN (:...compositions)', { compositions });
    }

    // Fetch available languages in parallel, before language filter narrows the main query
    const availableLanguagesPromise = this.fetchAvailableLanguages(
      regionId,
      accessibleIds,
      search,
      compositions,
    );

    if (languages.length > 0) {
      const orParts = languages
        .map(
          (_, i) =>
            `(g_l.native_language = :lang${i} OR (',' || COALESCE(g_l.other_languages, '') || ',') LIKE :langPat${i})`,
        )
        .join(' OR ');
      const params: Record<string, string> = {};
      languages.forEach((lang, i) => {
        params[`lang${i}`] = lang;
        params[`langPat${i}`] = `%,${lang},%`;
      });
      query.andWhere(
        `EXISTS (SELECT 1 FROM guests g_l WHERE g_l.group_id = gg.id AND (${orParts}))`,
        params,
      );
    }

    if (minCarSeats && minCarSeats > 0) {
      query.andWhere(
        `(SELECT COALESCE(SUM(g_cs.car_seats), 0) FROM guests g_cs WHERE g_cs.group_id = gg.id) >= :minCarSeats`,
        { minCarSeats },
      );
    }

    if (hasCars === true) {
      query.andWhere('gg.car_count IS NOT NULL AND gg.car_count > 0');
    } else if (hasCars === false) {
      query.andWhere('(gg.car_count IS NULL OR gg.car_count = 0)');
    }

    if (noHost) {
      query.andWhere('gg.host_id IS NULL');
    } else if (hostId) {
      query.andWhere('gg.host_id = :hostId', { hostId });
    }

    const [total, availableLanguages] = await Promise.all([
      query.getCount(),
      availableLanguagesPromise,
    ]);

    const groups = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const stats = await this.fetchGroupStats(groups.map((g) => g.id));

    return {
      data: groups.map((g) =>
        this.toDto(
          g,
          (g as GuestGroup & { guest_count?: number }).guest_count ?? 0,
          undefined,
          stats.get(g.id),
        ),
      ),
      total,
      page,
      limit,
      available_languages: availableLanguages,
    };
  }

  private async fetchAvailableLanguages(
    regionId: string | undefined,
    accessibleIds: string[] | null,
    search?: string,
    compositions?: string[],
  ): Promise<string[]> {
    const query = this.guestsRepository
      .createQueryBuilder('g')
      .innerJoin('guest_groups', 'gg', 'gg.id = g.group_id')
      .select('g.native_language', 'native_language')
      .addSelect('g.other_languages', 'other_languages')
      .where(
        "(g.native_language IS NOT NULL OR (g.other_languages IS NOT NULL AND g.other_languages != ''))",
      );

    if (regionId) {
      query.andWhere('gg.region_id = :regionId', { regionId });
    } else if (accessibleIds !== null) {
      if (accessibleIds.length === 0) return [];
      query.andWhere('gg.region_id IN (:...ids)', { ids: accessibleIds });
    }

    if (search) {
      query.andWhere('gg.group_code LIKE :search', { search: `%${search}%` });
    }

    if (compositions && compositions.length > 0) {
      query.andWhere('gg.composition IN (:...compositions)', { compositions });
    }

    const rows = await query.getRawMany<{
      native_language: string | null;
      other_languages: string | null;
    }>();

    const langs = new Set<string>();
    for (const row of rows) {
      if (row.native_language?.trim()) langs.add(row.native_language.trim());
      if (row.other_languages) {
        for (const lang of row.other_languages.split(',')) {
          const l = lang.trim();
          if (l) langs.add(l);
        }
      }
    }
    return [...langs].sort();
  }

  async findOne(
    id: string,
    currentUser: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertRegionAccess(group.region_id, currentUser);

    const [guestCount, stats] = await Promise.all([
      this.guestsRepository.count({ where: { group_id: id } }),
      this.fetchGroupStats([id]),
    ]);
    return this.toDto(group, guestCount, undefined, stats.get(id));
  }

  async update(
    id: string,
    dto: UpdateGuestGroupDto,
    currentUser: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertRegionAccess(group.region_id, currentUser);

    if (dto.group_code && dto.group_code !== group.group_code) {
      const exists = await this.groupsRepository.findOne({
        where: { group_code: dto.group_code },
      });
      if (exists) throw new ConflictException('El código de grupo ya existe');
    }

    if (dto.region_id && dto.region_id !== group.region_id) {
      await this.assertRegionAccess(dto.region_id, currentUser);
    }

    Object.assign(group, dto);
    const saved = await this.groupsRepository.save(group);
    const [guestCount, stats] = await Promise.all([
      this.guestsRepository.count({ where: { group_id: id } }),
      this.fetchGroupStats([id]),
    ]);
    return this.toDto(saved, guestCount, undefined, stats.get(id));
  }

  async remove(id: string): Promise<void> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const guestCount = await this.guestsRepository.count({
      where: { group_id: id },
    });
    if (guestCount > 0)
      throw new BadRequestException(
        'No se puede eliminar un grupo con invitados',
      );

    await this.groupsRepository.remove(group);
  }

  async setContact(
    id: string,
    guestId: string,
    currentUser: JwtPayload,
  ): Promise<void> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertRegionAccess(group.region_id, currentUser);

    const guest = await this.guestsRepository.findOne({
      where: { id: guestId },
    });
    if (!guest) throw new NotFoundException('Invitado no encontrado');
    if (guest.group_id !== id)
      throw new BadRequestException('El invitado no pertenece a este grupo');

    await this.guestsRepository.update(
      { group_id: id, is_group_contact: true },
      { is_group_contact: false },
    );
    await this.guestsRepository.update(
      { id: guestId },
      { is_group_contact: true },
    );
  }

  async parseImport(buffer: Buffer): Promise<ParseGroupResponseDto> {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const sheetHeaders = (XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
    })[0] ?? []) as string[];

    const seenCanonical = new Set<string>();
    const columns: string[] = [];
    for (const h of sheetHeaders) {
      const canonical = IMPORT_COLUMN_MAP[h];
      if (canonical && !seenCanonical.has(canonical)) {
        seenCanonical.add(canonical);
        columns.push(canonical);
      }
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
    });

    const valid: ImportGroupRowDto[] = [];
    const errors: { row: number; group_code: string; reason: string }[] = [];
    const seenCodes = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const code = this.parseGroupCode(row);

      if (!code) {
        errors.push({
          row: rowNum,
          group_code: '',
          reason: 'group_code es obligatorio',
        });
        continue;
      }
      if (seenCodes.has(code)) {
        errors.push({
          row: rowNum,
          group_code: code,
          reason: 'group_code duplicado en el archivo',
        });
        continue;
      }
      seenCodes.add(code);

      const avail = this.parseAvailability(row);
      const rawHostName = row['host_name'];
      const hostName =
        typeof rawHostName === 'string' ? rawHostName.trim() : null;
      const rawRegionName = row['region_name'];
      const regionName =
        typeof rawRegionName === 'string' ? rawRegionName.trim() : null;

      valid.push({
        group_code: code,
        region_name: regionName || null,
        host_name: hostName || null,
        available_from: avail.available_from ?? null,
        available_to: avail.available_to ?? null,
        composition: avail.composition ?? null,
        car_count: avail.car_count ?? null,
      });
    }

    const validCodes = valid.map((r) => r.group_code);
    const existing =
      validCodes.length > 0
        ? await this.groupsRepository.find({
            where: { group_code: In(validCodes) },
            select: { group_code: true },
          })
        : [];
    const existingCodes = new Set(existing.map((g) => g.group_code));

    const duplicateRows = valid.filter((r) => existingCodes.has(r.group_code));
    const newRows = valid.filter((r) => !existingCodes.has(r.group_code));
    const duplicates = duplicateRows.map((r) => r.group_code);

    const allDbGroups = await this.groupsRepository.find({
      select: { group_code: true },
    });
    const excelCodes = new Set(valid.map((r) => r.group_code));
    const toDelete = allDbGroups
      .filter((g) => !excelCodes.has(g.group_code))
      .map((g) => g.group_code);

    return {
      valid: newRows,
      errors,
      duplicates,
      duplicateRows,
      toDelete,
      summary: {
        total: rows.length,
        valid: newRows.length,
        errors: errors.length,
        duplicates: duplicates.length,
        to_delete: toDelete.length,
      },
      columns,
    };
  }

  async commitGroupImport(
    dto: CommitGroupImportDto,
    currentUser: JwtPayload,
  ): Promise<ImportGroupResponseDto> {
    const rows = dto.rows ?? [];
    const updateRows = dto.updateRows ?? [];

    if (rows.length > 0) {
      const hasRegionCol =
        (dto.fileColumns ?? []).includes('region_name') ||
        rows.some((r) => r.region_name != null);
      if (!hasRegionCol && !dto.regionId) {
        throw new BadRequestException(
          'regionId is required when the file has no region_name column',
        );
      }
    }

    const allRegions = await this.regionsRepository.find({
      select: ['id', 'name'],
    });
    const regionMap = new Map(
      allRegions.map((r) => [r.name.toLowerCase(), r.id]),
    );

    let accessibleIds: Set<string> | 'all';
    if (currentUser.role === 'superadmin') {
      accessibleIds = 'all';
    } else {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      accessibleIds = new Set((user?.regions ?? []).map((r) => r.id));
    }

    if (dto.regionId) {
      await this.assertRegionAccess(dto.regionId, currentUser);
    }

    // Host lookup cache: key = `${regionId}:${hostNameLower}`
    const hostCache = new Map<string, string | null>();
    const resolveHostId = async (
      regionId: string,
      hostName: string | null | undefined,
    ): Promise<string | null> => {
      if (!hostName) return null;
      const cacheKey = `${regionId}:${hostName.toLowerCase()}`;
      if (hostCache.has(cacheKey)) return hostCache.get(cacheKey)!;
      const host = await this.hostsRepository.findOne({
        where: { region_id: regionId, name: hostName },
        select: { id: true },
      });
      const id = host?.id ?? null;
      hostCache.set(cacheKey, id);
      return id;
    };

    let created = 0;
    let updated = 0;
    let regions_not_found = 0;
    let hosts_not_found = 0;

    const resolveRegionId = (row: ImportGroupRowDto): string | null => {
      if (dto.regionId) return dto.regionId;
      if (!row.region_name) return null;
      return regionMap.get(row.region_name.toLowerCase()) ?? null;
    };

    const isAccessible = (regionId: string): boolean =>
      accessibleIds === 'all' || accessibleIds.has(regionId);

    // ── Create new rows ───────────────────────────────────────────────────
    for (const row of rows) {
      const regionId = resolveRegionId(row);
      if (!regionId) {
        regions_not_found++;
        continue;
      }
      if (!isAccessible(regionId)) {
        regions_not_found++;
        continue;
      }

      const exists = await this.groupsRepository.findOne({
        where: { group_code: row.group_code },
      });
      if (exists) continue;

      const hostId = await resolveHostId(regionId, row.host_name);
      if (row.host_name && hostId === null) hosts_not_found++;

      await this.groupsRepository.save(
        this.groupsRepository.create({
          group_code: row.group_code,
          region_id: regionId,
          host_id: hostId ?? null,
          available_from: row.available_from ?? null,
          available_to: row.available_to ?? null,
          composition: (row.composition as GuestGroup['composition']) ?? null,
          car_count: row.car_count ?? null,
        }),
      );
      created++;
    }

    // ── Update existing rows ──────────────────────────────────────────────
    const updateColumns =
      dto.partialUpdate && dto.columns ? new Set(dto.columns) : null;

    for (const row of updateRows) {
      const group = await this.groupsRepository.findOne({
        where: { group_code: row.group_code },
      });
      if (!group) continue;
      if (!isAccessible(group.region_id)) continue;

      const applyAll = !updateColumns;
      const apply = (col: string) => applyAll || updateColumns!.has(col);

      const patch: Partial<GuestGroup> = {};
      if (apply('available_from'))
        patch.available_from = row.available_from ?? null;
      if (apply('available_to')) patch.available_to = row.available_to ?? null;
      if (apply('composition'))
        patch.composition =
          (row.composition as GuestGroup['composition']) ?? null;
      if (apply('car_count')) patch.car_count = row.car_count ?? null;

      if (apply('host_name')) {
        const hostId = await resolveHostId(group.region_id, row.host_name);
        if (row.host_name && hostId === null) hosts_not_found++;
        patch.host_id = hostId ?? null;
      }

      if (apply('region_name') && row.region_name) {
        const newRegionId = regionMap.get(row.region_name.toLowerCase());
        if (newRegionId && isAccessible(newRegionId))
          patch.region_id = newRegionId;
      }

      Object.assign(group, patch);
      await this.groupsRepository.save(group);
      updated++;
    }

    // ── Delete absent ─────────────────────────────────────────────────────
    let deleted = 0;
    if (dto.deleteAbsent && (dto.toDeleteCodes ?? []).length > 0) {
      const codesToDelete = dto.toDeleteCodes!;
      const absentGroups = await this.groupsRepository.find({
        where: { group_code: In(codesToDelete) },
        select: { id: true },
      });
      const absentIds = absentGroups.map((g) => g.id);
      for (let i = 0; i < absentIds.length; i += 200) {
        await this.guestsRepository.delete({
          group_id: In(absentIds.slice(i, i + 200)),
        });
      }
      for (let i = 0; i < absentIds.length; i += 200) {
        await this.groupsRepository.delete({
          id: In(absentIds.slice(i, i + 200)),
        });
      }
      deleted = absentIds.length;
    }

    return {
      created,
      updated,
      total: rows.length + updateRows.length,
      ...(regions_not_found > 0 ? { regions_not_found } : {}),
      ...(hosts_not_found > 0 ? { hosts_not_found } : {}),
      ...(deleted > 0 ? { deleted } : {}),
    };
  }

  async importFromExcel(
    buffer: Buffer,
    regionId: string | undefined,
    currentUser: JwtPayload,
    deleteAbsent = false,
  ): Promise<ImportGroupResponseDto> {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
    });

    const hasRegionCol = rows.length > 0 && 'region_name' in rows[0];

    if (!hasRegionCol && !regionId) {
      throw new BadRequestException(
        'regionId is required when the file has no region_name column',
      );
    }

    let created = 0;
    let updated = 0;
    let regions_not_found = 0;
    const excelGroupCodes = new Set<string>();

    if (!hasRegionCol) {
      // ── Single-region mode ────────────────────────────────────────────────
      await this.assertRegionAccess(regionId!, currentUser);
      const region = await this.regionsRepository.findOne({
        where: { id: regionId },
      });
      if (!region) throw new NotFoundException('Región no encontrada');

      for (const row of rows) {
        const code = this.parseGroupCode(row);
        if (!code) continue;
        excelGroupCodes.add(code);
        const exists = await this.groupsRepository.findOne({
          where: { group_code: code },
        });
        if (exists) {
          Object.assign(exists, this.parseAvailability(row));
          await this.groupsRepository.save(exists);
          updated++;
          continue;
        }
        await this.groupsRepository.save(
          this.groupsRepository.create({
            group_code: code,
            region_id: regionId!,
            ...this.parseAvailability(row),
          }),
        );
        created++;
      }
    } else {
      // ── Multi-region mode ─────────────────────────────────────────────────
      const allRegions = await this.regionsRepository.find({
        select: ['id', 'name'],
      });
      const regionMap = new Map(
        allRegions.map((r) => [r.name.toLowerCase(), r.id]),
      );

      let accessibleIds: Set<string> | 'all';
      if (currentUser.role === 'superadmin') {
        accessibleIds = 'all';
      } else {
        const user = await this.usersRepository.findOne({
          where: { id: currentUser.sub },
          relations: { regions: true },
        });
        accessibleIds = new Set((user?.regions ?? []).map((r) => r.id));
      }

      for (const row of rows) {
        const code = this.parseGroupCode(row);
        if (!code) continue;

        const rawRegion = String(row['region_name'] ?? '').trim();
        const resolvedRegionId = regionMap.get(rawRegion.toLowerCase());

        if (!resolvedRegionId) {
          regions_not_found++;
          continue;
        }
        if (accessibleIds !== 'all' && !accessibleIds.has(resolvedRegionId)) {
          regions_not_found++;
          continue;
        }

        excelGroupCodes.add(code);
        const exists = await this.groupsRepository.findOne({
          where: { group_code: code },
        });
        if (exists) {
          Object.assign(exists, this.parseAvailability(row));
          await this.groupsRepository.save(exists);
          updated++;
          continue;
        }
        await this.groupsRepository.save(
          this.groupsRepository.create({
            group_code: code,
            region_id: resolvedRegionId,
            ...this.parseAvailability(row),
          }),
        );
        created++;
      }
    }

    // ── Delete absent (global) ────────────────────────────────────────────
    let deleted = 0;
    if (deleteAbsent) {
      const allDbGroups = await this.groupsRepository.find({
        select: { id: true, group_code: true },
      });
      const absentGroups = allDbGroups.filter(
        (g) => !excelGroupCodes.has(g.group_code),
      );
      if (absentGroups.length > 0) {
        const absentIds = absentGroups.map((g) => g.id);
        // Delete guests first (FK_guests_group is RESTRICT), in chunks for SQLite
        for (let i = 0; i < absentIds.length; i += 200) {
          await this.guestsRepository.delete({
            group_id: In(absentIds.slice(i, i + 200)),
          });
        }
        for (let i = 0; i < absentIds.length; i += 200) {
          await this.groupsRepository.delete({
            id: In(absentIds.slice(i, i + 200)),
          });
        }
        deleted = absentGroups.length;
      }
    }

    return {
      created,
      updated,
      total: rows.length,
      ...(hasRegionCol && regions_not_found > 0 ? { regions_not_found } : {}),
      ...(deleted > 0 ? { deleted } : {}),
    };
  }

  private parseDate(v: unknown): string | null {
    if (!v) return null;
    let d: Date;
    if (v instanceof Date) {
      d = v;
    } else if (typeof v === 'string' && v.trim()) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
      d = new Date(v);
      if (isNaN(d.getTime())) return null;
    } else {
      return null;
    }
    // Add 12 h to absorb timezone offsets (handles UTC±12)
    return new Date(d.getTime() + 12 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  private parseAvailability(
    row: Record<string, unknown>,
  ): Partial<
    Pick<
      GuestGroup,
      'available_from' | 'available_to' | 'composition' | 'car_count'
    >
  > {
    const validCompositions = ['men_only', 'mixed', 'women_only'];
    const result: Partial<
      Pick<
        GuestGroup,
        'available_from' | 'available_to' | 'composition' | 'car_count'
      >
    > = {};

    const fromKey =
      'available_from' in row
        ? 'available_from'
        : 'start_date' in row
          ? 'start_date'
          : null;
    if (fromKey) result.available_from = this.parseDate(row[fromKey]);

    const toKey =
      'available_to' in row
        ? 'available_to'
        : 'end_date' in row
          ? 'end_date'
          : null;
    if (toKey) result.available_to = this.parseDate(row[toKey]);

    const compKey =
      'composition' in row
        ? 'composition'
        : 'group_type' in row
          ? 'group_type'
          : null;
    if (compKey) {
      const comp =
        typeof row[compKey] === 'string' ? (row[compKey] as string).trim() : '';
      result.composition = validCompositions.includes(comp)
        ? (comp as 'men_only' | 'mixed' | 'women_only')
        : null;
    }

    if ('car_count' in row) {
      const raw = row['car_count'];
      const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
      result.car_count = isNaN(n) || n < 0 ? null : n;
    }

    return result;
  }

  private parseGroupCode(row: Record<string, unknown>): string | null {
    const raw =
      row['group_code'] ??
      row['Group Code'] ??
      row['Código de Grupo'] ??
      Object.values(row)[0];
    if (typeof raw !== 'string') return null;
    const code = raw.trim();
    if (!code) return null;
    return code.includes('-') ? code : code.match(/.{1,4}/g)!.join('-');
  }

  async exportAll(
    regionId: string | undefined,
    currentUser: JwtPayload,
  ): Promise<Buffer> {
    const query = this.groupsRepository
      .createQueryBuilder('gg')
      .loadRelationCountAndMap('gg.guest_count', 'gg.guests')
      .orderBy('gg.group_code', 'ASC');

    if (regionId) {
      await this.assertRegionAccess(regionId, currentUser);
      query.where('gg.region_id = :regionId', { regionId });
    } else if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const ids = (user?.regions ?? []).map((r) => r.id);
      if (ids.length === 0) return this.buildGroupsExcel([]);
      query.where('gg.region_id IN (:...ids)', { ids });
    }

    const groups = await query.getMany();

    const regions = await this.regionsRepository.find({
      select: ['id', 'name'],
    });
    const regionMap = new Map(regions.map((r) => [r.id, r.name]));

    const hostIds = [
      ...new Set(groups.map((g) => g.host_id).filter(Boolean)),
    ] as string[];
    const hosts = hostIds.length
      ? await this.hostsRepository.find({
          where: { id: In(hostIds) },
          select: ['id', 'name'],
        })
      : [];
    const hostMap = new Map(hosts.map((h) => [h.id, h.name]));

    const stats = await this.fetchGroupStats(groups.map((g) => g.id));

    return this.buildGroupsExcel(groups, regionMap, hostMap, stats);
  }

  private buildGroupsExcel(
    groups: (GuestGroup & { guest_count?: number })[],
    regionMap = new Map<string, string>(),
    hostMap = new Map<string, string>(),
    statsMap = new Map<
      string,
      { languages: string[]; total_car_seats: number; live: GroupAggregates }
    >(),
  ): Buffer {
    const headers = [
      'group_code',
      'region_name',
      'host_name',
      'guest_count',
      'languages',
      'total_car_seats',
      'car_count',
      'available_from',
      'available_to',
      'composition',
      'agg_guest_count',
      'agg_minor_count',
      'agg_status_counts',
      'agg_avg_lat',
      'agg_avg_lng',
      'agg_languages',
      'agg_speaks_english',
      'agg_car_seats',
      'agg_computed_at',
      'created_at',
      'updated_at',
    ];
    const rows = groups.map((g) => {
      const stats = statsMap.get(g.id);
      return [
        g.group_code,
        regionMap.get(g.region_id) ?? '',
        g.host_id ? (hostMap.get(g.host_id) ?? '') : '',
        g.guest_count ?? 0,
        (stats?.languages ?? []).join(', '),
        stats?.total_car_seats ?? 0,
        g.car_count ?? '',
        g.available_from ?? '',
        g.available_to ?? '',
        g.composition ?? '',
        g.agg_guest_count ?? '',
        g.agg_minor_count ?? '',
        g.agg_status_counts
          ? Object.entries(g.agg_status_counts)
              .map(([status, count]) => `${status}: ${count}`)
              .join(', ')
          : '',
        g.agg_avg_lat ?? '',
        g.agg_avg_lng ?? '',
        (g.agg_languages ?? []).join(', '),
        g.agg_speaks_english === null ? '' : g.agg_speaks_english ? 'Sí' : 'No',
        g.agg_car_seats ?? '',
        g.agg_computed_at ?? '',
        g.created_at instanceof Date
          ? g.created_at.toISOString()
          : g.created_at,
        g.updated_at instanceof Date
          ? g.updated_at.toISOString()
          : g.updated_at,
      ];
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Grupos');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  generateTemplate(): Buffer {
    const headers = [
      'group_code',
      'region_name',
      'car_count',
      'available_from',
      'available_to',
      'composition',
    ];
    const examples = [
      ['GRP-001', 'Madrid', 2, '2024-06-14', '2024-06-21', 'mixed'],
      ['GRP-002', 'Barcelona', 1, '', '', 'men_only'],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    ws['!cols'] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Groups');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  private async assertRegionAccess(
    regionId: string,
    currentUser: JwtPayload,
  ): Promise<void> {
    if (currentUser.role === 'superadmin') return;
    const user = await this.usersRepository.findOne({
      where: { id: currentUser.sub },
      relations: { regions: true },
    });
    const hasAccess = (user?.regions ?? []).some((r) => r.id === regionId);
    if (!hasAccess) throw new ForbiddenException();
  }

  async truncate(): Promise<{
    deleted_guests: number;
    deleted_groups: number;
  }> {
    const guestResult = await this.guestsRepository
      .createQueryBuilder()
      .delete()
      .execute();
    const groupResult = await this.groupsRepository
      .createQueryBuilder()
      .delete()
      .execute();
    return {
      deleted_guests: guestResult.affected ?? 0,
      deleted_groups: groupResult.affected ?? 0,
    };
  }

  async deleteFiltered(
    regionId?: string,
    search?: string,
    hostId?: string,
    noHost?: boolean,
  ): Promise<{ deleted_guests: number; deleted_groups: number }> {
    const qb = this.groupsRepository
      .createQueryBuilder('gg')
      .select('gg.id', 'id');

    if (regionId) qb.where('gg.region_id = :regionId', { regionId });
    if (search)
      qb.andWhere('gg.group_code LIKE :search', { search: `%${search}%` });
    if (noHost) qb.andWhere('gg.host_id IS NULL');
    else if (hostId) qb.andWhere('gg.host_id = :hostId', { hostId });

    const groups = await qb.getRawMany<{ id: string }>();
    const ids = groups.map((g) => g.id);

    if (ids.length === 0) return { deleted_guests: 0, deleted_groups: 0 };

    const guestResult = await this.guestsRepository
      .createQueryBuilder()
      .delete()
      .where('group_id IN (:...ids)', { ids })
      .execute();

    const groupResult = await this.groupsRepository
      .createQueryBuilder()
      .delete()
      .where('id IN (:...ids)', { ids })
      .execute();

    return {
      deleted_guests: guestResult.affected ?? 0,
      deleted_groups: groupResult.affected ?? 0,
    };
  }

  async assignHost(
    id: string,
    hostId: string | null,
    currentUser: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertRegionAccess(group.region_id, currentUser);

    if (hostId !== null) {
      const host = await this.hostsRepository.findOne({
        where: { id: hostId },
      });
      if (!host) throw new NotFoundException('Congregación no encontrada');
      if (host.region_id !== group.region_id) {
        throw new BadRequestException(
          'La congregación no pertenece a la misma región que el grupo',
        );
      }
    }

    group.host_id = hostId;
    const saved = await this.groupsRepository.save(group);
    const [guestCount, stats, hostEntity] = await Promise.all([
      this.guestsRepository.count({ where: { group_id: id } }),
      this.fetchGroupStats([id]),
      hostId
        ? this.hostsRepository.findOne({ where: { id: hostId } })
        : Promise.resolve(null),
    ]);
    return this.toDto(
      saved,
      guestCount,
      hostEntity?.name ?? null,
      stats.get(id),
    );
  }

  async recomputeAggregates(): Promise<RecomputeAggregatesResponseDto> {
    const [groups, guests] = await Promise.all([
      this.groupsRepository.find({ select: { id: true } }),
      this.guestsRepository.find({
        select: {
          group_id: true,
          status: true,
          is_minor: true,
          lat: true,
          lng: true,
          native_language: true,
          other_languages: true,
          speaks_english: true,
          car_seats: true,
        },
      }),
    ]);

    const guestsByGroup = new Map<string, Guest[]>();
    for (const guest of guests) {
      const list = guestsByGroup.get(guest.group_id) ?? [];
      list.push(guest);
      guestsByGroup.set(guest.group_id, list);
    }

    const computedAt = new Date().toISOString();
    for (const group of groups) {
      const agg = computeGroupAggregates(
        (guestsByGroup.get(group.id) ?? []).map((g) =>
          this.toAggregateInput(g),
        ),
      );
      await this.groupsRepository.update(group.id, {
        agg_guest_count: agg.agg_guest_count,
        agg_minor_count: agg.agg_minor_count,
        agg_status_counts: agg.agg_status_counts,
        agg_avg_lat: agg.agg_avg_lat,
        agg_avg_lng: agg.agg_avg_lng,
        agg_languages: agg.agg_languages.length > 0 ? agg.agg_languages : null,
        agg_speaks_english: agg.agg_speaks_english,
        agg_car_seats: agg.agg_car_seats,
        agg_computed_at: computedAt,
      });
    }

    return { groups_updated: groups.length, computed_at: computedAt };
  }

  private toAggregateInput(guest: Guest): GuestAggregateInput {
    return {
      status: guest.status,
      is_minor: guest.is_minor,
      lat: guest.lat,
      lng: guest.lng,
      native_language: guest.native_language,
      other_languages: guest.other_languages?.join(',') ?? null,
      speaks_english: guest.speaks_english,
      car_seats: guest.car_seats,
    };
  }

  private async fetchGroupStats(
    groupIds: string[],
  ): Promise<
    Map<
      string,
      { languages: string[]; total_car_seats: number; live: GroupAggregates }
    >
  > {
    const result = new Map<
      string,
      { languages: string[]; total_car_seats: number; live: GroupAggregates }
    >();
    if (groupIds.length === 0) return result;

    const guests = await this.guestsRepository.find({
      select: {
        group_id: true,
        status: true,
        is_minor: true,
        lat: true,
        lng: true,
        native_language: true,
        other_languages: true,
        speaks_english: true,
        car_seats: true,
      },
      where: { group_id: In(groupIds) },
    });

    const guestsByGroup = new Map<string, Guest[]>();
    for (const guest of guests) {
      const list = guestsByGroup.get(guest.group_id) ?? [];
      list.push(guest);
      guestsByGroup.set(guest.group_id, list);
    }

    for (const id of groupIds) {
      const members = guestsByGroup.get(id) ?? [];
      // Display stats keep the historical semantics: every guest counts
      const languages = new Set<string>();
      let totalCarSeats = 0;
      for (const g of members) {
        if (g.native_language?.trim()) languages.add(g.native_language.trim());
        for (const lang of g.other_languages ?? []) {
          const l = lang.trim();
          if (l) languages.add(l);
        }
        totalCarSeats += g.car_seats ?? 0;
      }
      result.set(id, {
        languages: [...languages].sort(),
        total_car_seats: totalCarSeats,
        live: computeGroupAggregates(
          members.map((g) => this.toAggregateInput(g)),
        ),
      });
    }
    return result;
  }

  private isAggStale(group: GuestGroup, live: GroupAggregates): boolean {
    const closeEnough = (a: number | null, b: number | null) =>
      a === null || b === null ? a === b : Math.abs(a - b) < 1e-6;
    const normalizeCounts = (counts: Record<string, number> | null) =>
      JSON.stringify(
        Object.entries(counts ?? {}).sort(([a], [b]) => a.localeCompare(b)),
      );

    return !(
      group.agg_guest_count === live.agg_guest_count &&
      group.agg_minor_count === live.agg_minor_count &&
      group.agg_car_seats === live.agg_car_seats &&
      group.agg_speaks_english === live.agg_speaks_english &&
      (group.agg_languages ?? []).join(',') === live.agg_languages.join(',') &&
      normalizeCounts(group.agg_status_counts) ===
        normalizeCounts(live.agg_status_counts) &&
      closeEnough(group.agg_avg_lat, live.agg_avg_lat) &&
      closeEnough(group.agg_avg_lng, live.agg_avg_lng)
    );
  }

  toDto(
    group: GuestGroup,
    guestCount: number,
    hostName?: string | null,
    stats?: {
      languages: string[];
      total_car_seats: number;
      live?: GroupAggregates;
    },
  ): GuestGroupResponseDto {
    const dto = new GuestGroupResponseDto();
    dto.id = group.id;
    dto.group_code = group.group_code;
    dto.region_id = group.region_id;
    dto.host_id = group.host_id ?? null;
    dto.host_name = hostName ?? null;
    dto.guest_count = guestCount;
    dto.languages = stats?.languages ?? [];
    dto.total_car_seats = stats?.total_car_seats ?? 0;
    dto.available_from = group.available_from ?? null;
    dto.available_to = group.available_to ?? null;
    dto.composition = group.composition ?? null;
    dto.car_count = group.car_count ?? null;
    dto.agg_guest_count = group.agg_guest_count ?? null;
    dto.agg_minor_count = group.agg_minor_count ?? null;
    dto.agg_status_counts = group.agg_status_counts ?? null;
    dto.agg_avg_lat = group.agg_avg_lat ?? null;
    dto.agg_avg_lng = group.agg_avg_lng ?? null;
    dto.agg_languages = group.agg_languages ?? null;
    dto.agg_speaks_english = group.agg_speaks_english ?? null;
    dto.agg_car_seats = group.agg_car_seats ?? null;
    dto.agg_computed_at = group.agg_computed_at ?? null;
    dto.agg_stale =
      group.agg_computed_at && stats?.live
        ? this.isAggStale(group, stats.live)
        : null;
    dto.created_at = group.created_at;
    dto.updated_at = group.updated_at;
    return dto;
  }
}
