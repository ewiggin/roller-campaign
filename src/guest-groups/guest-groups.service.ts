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
import { CreateGuestGroupDto } from './dto/create-guest-group.dto';
import { GuestGroupResponseDto } from './dto/guest-group-response.dto';
import { ImportGroupResponseDto } from './dto/import-group-response.dto';
import { UpdateGuestGroupDto } from './dto/update-guest-group.dto';
import { GuestGroup } from './entities/guest-group.entity';

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
    Pick<GuestGroup, 'available_from' | 'available_to' | 'composition'>
  > {
    const validCompositions = ['men_only', 'mixed', 'women_only'];
    const result: Partial<
      Pick<GuestGroup, 'available_from' | 'available_to' | 'composition'>
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

    return this.buildGroupsExcel(groups, regionMap, hostMap);
  }

  private buildGroupsExcel(
    groups: (GuestGroup & { guest_count?: number })[],
    regionMap = new Map<string, string>(),
    hostMap = new Map<string, string>(),
  ): Buffer {
    const headers = [
      'group_code',
      'region_name',
      'host_name',
      'guest_count',
      'available_from',
      'available_to',
      'composition',
    ];
    const rows = groups.map((g) => [
      g.group_code,
      regionMap.get(g.region_id) ?? '',
      g.host_id ? (hostMap.get(g.host_id) ?? '') : '',
      g.guest_count ?? 0,
      g.available_from ?? '',
      g.available_to ?? '',
      g.composition ?? '',
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 28 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Grupos');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  generateTemplate(): Buffer {
    const headers = [
      'group_code',
      'region_name',
      'available_from',
      'available_to',
      'composition',
    ];
    const examples = [
      ['GRP-001', 'Madrid', '2024-06-14', '2024-06-21', 'mixed'],
      ['GRP-002', 'Barcelona', '', '', 'men_only'],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    ws['!cols'] = [
      { wch: 16 },
      { wch: 24 },
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

  private async fetchGroupStats(
    groupIds: string[],
  ): Promise<Map<string, { languages: string[]; total_car_seats: number }>> {
    const result = new Map<
      string,
      { languages: string[]; total_car_seats: number }
    >();
    if (groupIds.length === 0) return result;

    const [carRows, langRows] = await Promise.all([
      this.guestsRepository
        .createQueryBuilder('g')
        .select('g.group_id', 'group_id')
        .addSelect('SUM(g.car_seats)', 'total')
        .where('g.group_id IN (:...groupIds)', { groupIds })
        .andWhere('g.car_seats IS NOT NULL')
        .groupBy('g.group_id')
        .getRawMany<{ group_id: string; total: string }>(),
      this.guestsRepository
        .createQueryBuilder('g')
        .select('g.group_id', 'group_id')
        .addSelect('g.native_language', 'native_language')
        .addSelect('g.other_languages', 'other_languages')
        .where('g.group_id IN (:...groupIds)', { groupIds })
        .andWhere(
          '(g.native_language IS NOT NULL OR g.other_languages IS NOT NULL)',
        )
        .getRawMany<{
          group_id: string;
          native_language: string | null;
          other_languages: string | null;
        }>(),
    ]);

    const carMap = new Map(
      carRows.map((r) => [r.group_id, Math.round(parseFloat(r.total) || 0)]),
    );

    const langsByGroup = new Map<string, Set<string>>();
    for (const row of langRows) {
      if (!langsByGroup.has(row.group_id))
        langsByGroup.set(row.group_id, new Set());
      const set = langsByGroup.get(row.group_id)!;
      if (row.native_language?.trim()) set.add(row.native_language.trim());
      if (row.other_languages) {
        for (const lang of row.other_languages.split(',')) {
          const l = lang.trim();
          if (l) set.add(l);
        }
      }
    }

    for (const id of groupIds) {
      result.set(id, {
        languages: [...(langsByGroup.get(id) ?? [])].sort(),
        total_car_seats: carMap.get(id) ?? 0,
      });
    }
    return result;
  }

  toDto(
    group: GuestGroup,
    guestCount: number,
    hostName?: string | null,
    stats?: { languages: string[]; total_car_seats: number },
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
    dto.created_at = group.created_at;
    dto.updated_at = group.updated_at;
    return dto;
  }
}
