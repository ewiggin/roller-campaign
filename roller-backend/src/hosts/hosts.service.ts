import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Host } from './entities/host.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Guest } from '../guests/entities/guest.entity';
import { User } from '../users/entities/user.entity';
import { Region } from '../regions/entities/region.entity';
import {
  CreateHostDto,
  UpdateHostDto,
  HostResponseDto,
  GroupSuggestionDto,
  GroupSuggestionsResponseDto,
} from './dto/host.dto';
import {
  ImportHostCommitDto,
  ImportHostCommitResponseDto,
  ImportHostParseResponseDto,
  ImportHostRowDto,
} from './dto/import-host.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class HostsService {
  constructor(
    @InjectRepository(Host)
    private readonly hostsRepo: Repository<Host>,
    @InjectRepository(GuestGroup)
    private readonly groupsRepo: Repository<GuestGroup>,
    @InjectRepository(Guest)
    private readonly guestsRepo: Repository<Guest>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Region)
    private readonly regionsRepo: Repository<Region>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(
    dto: CreateHostDto,
    currentUser: JwtPayload,
  ): Promise<HostResponseDto> {
    await this.assertRegionAccess(dto.region_id, currentUser);
    const region = await this.regionsRepo.findOne({
      where: { id: dto.region_id },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    const host = this.hostsRepo.create({
      name: dto.name,
      region_id: dto.region_id,
      address: dto.address ?? null,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      weekday_meeting_day: dto.weekday_meeting_day ?? null,
      weekday_meeting_time: dto.weekday_meeting_time ?? null,
      weekend_meeting_day: dto.weekend_meeting_day ?? null,
      weekend_meeting_time: dto.weekend_meeting_time ?? null,
      capacity: dto.capacity ?? null,
      note: dto.note ?? null,
    });
    const saved = await this.hostsRepo.save(host);
    await this.cache.clear();
    return this.toDto(saved, 0);
  }

  async findAll(
    regionId: string | undefined,
    currentUser: JwtPayload,
  ): Promise<HostResponseDto[]> {
    const key = `hosts:${regionId ?? 'all'}:${currentUser.sub}`;
    const cached = await this.cache.get<HostResponseDto[]>(key);
    if (cached) return cached;

    const qb = this.hostsRepo
      .createQueryBuilder('h')
      .loadRelationCountAndMap('h.group_count', 'h.groups');

    if (regionId) {
      await this.assertRegionAccess(regionId, currentUser);
      qb.where('h.region_id = :regionId', { regionId });
    } else if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const ids = (user?.regions ?? []).map((r) => r.id);
      if (ids.length === 0) return [];
      qb.where('h.region_id IN (:...ids)', { ids });
    }

    const hosts = await qb.orderBy('h.name', 'ASC').getMany();
    const guestCounts = await this.guestCountsForHosts(hosts.map((h) => h.id));
    const result = hosts.map((h) =>
      this.toDto(
        h,
        (h as Host & { group_count?: number }).group_count ?? 0,
        guestCounts.get(h.id) ?? 0,
      ),
    );

    await this.cache.set(key, result, 300_000);
    return result;
  }

  async update(
    id: string,
    dto: UpdateHostDto,
    currentUser: JwtPayload,
  ): Promise<HostResponseDto> {
    const host = await this.hostsRepo.findOne({ where: { id } });
    if (!host) throw new NotFoundException('Congregación no encontrada');
    await this.assertRegionAccess(host.region_id, currentUser);

    Object.assign(host, dto);
    const saved = await this.hostsRepo.save(host);
    const groupCount = await this.groupsRepo.count({ where: { host_id: id } });
    const guestCount = await this.guestCountForHost(id);
    await this.cache.clear();
    return this.toDto(saved, groupCount, guestCount);
  }

  async remove(id: string): Promise<void> {
    const host = await this.hostsRepo.findOne({ where: { id } });
    if (!host) throw new NotFoundException('Congregación no encontrada');

    // Unassign groups before removing
    await this.groupsRepo.update({ host_id: id }, { host_id: null });
    await this.hostsRepo.remove(host);
    await this.cache.clear();
  }

  async getGroupSuggestions(
    hostId: string,
    currentUser: JwtPayload,
  ): Promise<GroupSuggestionsResponseDto> {
    const host = await this.hostsRepo.findOne({ where: { id: hostId } });
    if (!host) throw new NotFoundException('Congregación no encontrada');
    await this.assertRegionAccess(host.region_id, currentUser);

    const groups = await this.groupsRepo
      .createQueryBuilder('gg')
      .loadRelationCountAndMap('gg.guest_count', 'gg.guests')
      .where('gg.region_id = :regionId', { regionId: host.region_id })
      .getMany();

    // Centroid (avg lat/lng) per group — all guests with accommodation coords
    const groupIds = groups.map((g) => g.id);
    const guestCoords =
      groupIds.length > 0
        ? await this.guestsRepo
            .createQueryBuilder('g')
            .select('g.group_id', 'group_id')
            .addSelect('AVG(g.lat)', 'lat')
            .addSelect('AVG(g.lng)', 'lng')
            .where('g.group_id IN (:...groupIds)', { groupIds })
            .andWhere('g.lat IS NOT NULL')
            .andWhere('g.lng IS NOT NULL')
            .groupBy('g.group_id')
            .getRawMany<{ group_id: string; lat: string; lng: string }>()
        : [];

    const coordByGroup = new Map<string, { lat: number; lng: number }>();
    for (const row of guestCoords) {
      coordByGroup.set(row.group_id, {
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
      });
    }

    const carSeatsRows =
      groupIds.length > 0
        ? await this.guestsRepo
            .createQueryBuilder('g')
            .select('g.group_id', 'group_id')
            .addSelect('SUM(g.car_seats)', 'total')
            .where('g.group_id IN (:...groupIds)', { groupIds })
            .andWhere('g.car_seats IS NOT NULL')
            .groupBy('g.group_id')
            .getRawMany<{ group_id: string; total: string }>()
        : [];

    const carSeatsByGroup = new Map(
      carSeatsRows.map((r) => [
        r.group_id,
        Math.round(parseFloat(r.total) || 0),
      ]),
    );

    const guestLanguages =
      groupIds.length > 0
        ? await this.guestsRepo
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
              other_languages: string | string[] | null;
            }>()
        : [];

    const parseRawArray = (val: string | string[] | null): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      // TypeORM simple-array stores as plain comma-separated string (no braces)
      return val
        .split(',')
        .filter(Boolean)
        .map((s) => s.trim());
    };

    const languagesByGroup = new Map<string, Set<string>>();
    for (const row of guestLanguages) {
      if (!languagesByGroup.has(row.group_id))
        languagesByGroup.set(row.group_id, new Set());
      const set = languagesByGroup.get(row.group_id)!;
      if (row.native_language) set.add(row.native_language);
      parseRawArray(row.other_languages).forEach((l) => set.add(l));
    }

    const withDistance = groups.map((group) => {
      const guestCount =
        (group as GuestGroup & { guest_count?: number }).guest_count ?? 0;
      let distance_km: number | null = null;

      if (host.lat !== null && host.lng !== null) {
        const coord = coordByGroup.get(group.id);
        if (coord) {
          distance_km =
            Math.round(
              this.haversine(host.lat, host.lng, coord.lat, coord.lng) * 10,
            ) / 10;
        }
      }

      const languages = Array.from(languagesByGroup.get(group.id) ?? []).sort();

      const dto: GroupSuggestionDto = {
        id: group.id,
        group_code: group.group_code,
        guest_count: guestCount,
        distance_km,
        languages,
        car_count: group.car_count ?? null,
        total_car_seats: carSeatsByGroup.get(group.id) ?? 0,
      };
      return { dto, host_id: group.host_id };
    });

    const sort = (a: GroupSuggestionDto, b: GroupSuggestionDto) => {
      if (a.distance_km === null && b.distance_km === null)
        return a.group_code.localeCompare(b.group_code);
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    };

    const assigned = withDistance
      .filter((r) => r.host_id === hostId)
      .map((r) => r.dto)
      .sort(sort);
    const available = withDistance
      .filter((r) => r.host_id === null)
      .map((r) => r.dto)
      .sort(sort);

    return { assigned, available };
  }

  async getOne(id: string, currentUser: JwtPayload): Promise<HostResponseDto> {
    const host = await this.hostsRepo.findOne({ where: { id } });
    if (!host) throw new NotFoundException('Congregación no encontrada');
    await this.assertRegionAccess(host.region_id, currentUser);
    const groupCount = await this.groupsRepo.count({ where: { host_id: id } });
    const guestCount = await this.guestCountForHost(id);
    return this.toDto(host, groupCount, guestCount);
  }

  private haversine(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
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

  private async guestCountForHost(hostId: string): Promise<number> {
    const row = await this.guestsRepo
      .createQueryBuilder('g')
      .select('COUNT(g.id)', 'cnt')
      .innerJoin('guest_groups', 'gg', 'g.group_id = gg.id')
      .where('gg.host_id = :hostId', { hostId })
      .getRawOne<{ cnt: string }>();
    return parseInt(row?.cnt ?? '0', 10);
  }

  private async guestCountsForHosts(
    hostIds: string[],
  ): Promise<Map<string, number>> {
    if (hostIds.length === 0) return new Map();
    const rows = await this.guestsRepo
      .createQueryBuilder('g')
      .select('gg.host_id', 'host_id')
      .addSelect('COUNT(g.id)', 'cnt')
      .innerJoin('guest_groups', 'gg', 'g.group_id = gg.id')
      .where('gg.host_id IN (:...hostIds)', { hostIds })
      .groupBy('gg.host_id')
      .getRawMany<{ host_id: string; cnt: string }>();
    return new Map(rows.map((r) => [r.host_id, parseInt(r.cnt, 10)]));
  }

  async exportGuestsByHost(
    id: string,
    currentUser: JwtPayload,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const host = await this.hostsRepo.findOne({ where: { id } });
    if (!host) throw new NotFoundException('Host no encontrado');
    await this.assertRegionAccess(host.region_id, currentUser);

    const groups = await this.groupsRepo.find({ where: { host_id: id } });
    const groupIds = groups.map((g) => g.id);
    const groupCodeMap = new Map(groups.map((g) => [g.id, g.group_code]));

    const guests =
      groupIds.length > 0
        ? await this.guestsRepo.find({
            where: { group_id: In(groupIds) },
            order: { group_id: 'ASC', full_name: 'ASC' },
          })
        : [];

    const headers = [
      'Grupo',
      'Código',
      'Nombre',
      'Email',
      'Ciudad origen',
      'Habla inglés',
      'Otros idiomas',
      'Llegada fecha',
      'Llegada hora',
      'Salida fecha',
      'Salida hora',
      'Transporte',
      'Vuelo',
      'Transp. aeropuerto',
      'Dirección alojamiento',
      'Estado',
    ];

    const rows = guests.map((g) => [
      groupCodeMap.get(g.group_id) ?? '',
      g.guest_code,
      g.full_name,
      g.email ?? '',
      g.origin_city ?? '',
      g.speaks_english ? 'Sí' : 'No',
      (g.other_languages ?? []).join(', '),
      g.real_arrival ?? '',
      g.real_arrival_time ?? '',
      g.real_departure ?? '',
      g.real_departure_time ?? '',
      g.transport_mode ?? '',
      g.arrival_flight ?? '',
      g.needs_airport_transfer ? 'Sí' : 'No',
      g.hosting_address ?? '',
      g.status,
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths
    ws['!cols'] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 28 },
      { wch: 28 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 },
      { wch: 13 },
      { wch: 11 },
      { wch: 13 },
      { wch: 11 },
      { wch: 14 },
      { wch: 10 },
      { wch: 18 },
      { wch: 36 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Invitados');
    const buffer = Buffer.from(
      XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    );
    const safeName = host.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { buffer, filename: `invitados-${safeName}.xlsx` };
  }

  async exportExcel(
    regionId: string | undefined,
    currentUser: JwtPayload,
  ): Promise<Buffer> {
    const hosts = await this.findAll(regionId, currentUser);
    const allRegions = await this.regionsRepo.find({ select: ['id', 'name'] });
    const regionNameMap = new Map(allRegions.map((r) => [r.id, r.name]));

    const dayLabel = (d: number | null) =>
      d ? (['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d] ?? '') : '';

    const headers = [
      'name',
      'region_name',
      'address',
      'lat',
      'lng',
      'weekday_meeting_day',
      'weekday_meeting_time',
      'weekend_meeting_day',
      'weekend_meeting_time',
      'capacity',
      'group_count',
      'guest_count',
    ];
    const rows = hosts.map((h) => [
      h.name,
      regionNameMap.get(h.region_id) ?? '',
      h.address ?? '',
      h.lat ?? '',
      h.lng ?? '',
      h.weekday_meeting_day ? dayLabel(h.weekday_meeting_day) : '',
      h.weekday_meeting_time ?? '',
      h.weekend_meeting_day ? dayLabel(h.weekend_meeting_day) : '',
      h.weekend_meeting_time ?? '',
      h.capacity ?? '',
      h.group_count,
      h.guest_count,
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 28 },
      { wch: 20 },
      { wch: 36 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Hosts');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  downloadTemplate(): Buffer {
    const headers = [
      'name',
      'region_name',
      'address',
      'lat',
      'lng',
      'weekday_meeting_day',
      'weekday_meeting_time',
      'weekend_meeting_day',
      'weekend_meeting_time',
      'capacity',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hosts');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async parseImport(buffer: Buffer): Promise<ImportHostParseResponseDto> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });

    const allRegions = await this.regionsRepo.find({ select: ['id', 'name'] });
    const regionMap = new Map(
      allRegions.map((r) => [r.name.toLowerCase(), r.id]),
    );

    const allHosts = await this.hostsRepo.find({
      select: ['name', 'region_id'],
    });
    const existingKeys = new Set(
      allHosts.map((h) => `${h.name.toLowerCase()}::${h.region_id}`),
    );

    const valid: ImportHostRowDto[] = [];
    const duplicateRows: ImportHostRowDto[] = [];
    const errors: { row: number; name: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const name = String(raw['name'] ?? '').trim();
      const regionName = String(raw['region_name'] ?? '').trim();
      const rowNum = i + 2;

      if (!name) {
        errors.push({ row: rowNum, name: '', reason: 'Name is required' });
        continue;
      }
      if (!regionName) {
        errors.push({ row: rowNum, name, reason: 'region_name is required' });
        continue;
      }

      const regionId = regionMap.get(regionName.toLowerCase());
      if (!regionId) {
        errors.push({
          row: rowNum,
          name,
          reason: `Region "${regionName}" not found`,
        });
        continue;
      }

      const rowDto: ImportHostRowDto = {
        name,
        region_name: regionName,
        address: String(raw['address'] ?? '').trim() || null,
        lat: raw['lat'] !== '' ? Number(raw['lat']) || null : null,
        lng: raw['lng'] !== '' ? Number(raw['lng']) || null : null,
        weekday_meeting_day:
          raw['weekday_meeting_day'] !== ''
            ? Number(raw['weekday_meeting_day']) || null
            : null,
        weekday_meeting_time:
          String(raw['weekday_meeting_time'] ?? '').trim() || null,
        weekend_meeting_day:
          raw['weekend_meeting_day'] !== ''
            ? Number(raw['weekend_meeting_day']) || null
            : null,
        weekend_meeting_time:
          String(raw['weekend_meeting_time'] ?? '').trim() || null,
        capacity:
          raw['capacity'] !== '' ? Number(raw['capacity']) || null : null,
      };

      if (existingKeys.has(`${name.toLowerCase()}::${regionId}`)) {
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
    dto: ImportHostCommitDto,
  ): Promise<ImportHostCommitResponseDto> {
    const allRegions = await this.regionsRepo.find({ select: ['id', 'name'] });
    const regionMap = new Map(
      allRegions.map((r) => [r.name.toLowerCase(), r.id]),
    );
    let created = 0;
    let updated = 0;

    for (const row of dto.rows) {
      const regionId = regionMap.get(row.region_name.toLowerCase());
      if (!regionId) continue;
      const exists = await this.hostsRepo
        .createQueryBuilder('h')
        .where('LOWER(h.name) = LOWER(:name)', { name: row.name })
        .andWhere('h.region_id = :regionId', { regionId })
        .getOne();
      if (exists) continue;
      await this.hostsRepo.save(
        this.hostsRepo.create({
          name: row.name,
          region_id: regionId,
          address: row.address ?? null,
          lat: row.lat ?? null,
          lng: row.lng ?? null,
          weekday_meeting_day: row.weekday_meeting_day ?? null,
          weekday_meeting_time: row.weekday_meeting_time ?? null,
          weekend_meeting_day: row.weekend_meeting_day ?? null,
          weekend_meeting_time: row.weekend_meeting_time ?? null,
          capacity: row.capacity ?? null,
        }),
      );
      created++;
    }

    for (const row of dto.updateRows ?? []) {
      const regionId = regionMap.get(row.region_name.toLowerCase());
      if (!regionId) continue;
      const existing = await this.hostsRepo
        .createQueryBuilder('h')
        .where('LOWER(h.name) = LOWER(:name)', { name: row.name })
        .andWhere('h.region_id = :regionId', { regionId })
        .getOne();
      if (!existing) continue;
      Object.assign(existing, {
        address: row.address ?? null,
        lat: row.lat ?? null,
        lng: row.lng ?? null,
        weekday_meeting_day: row.weekday_meeting_day ?? null,
        weekday_meeting_time: row.weekday_meeting_time ?? null,
        weekend_meeting_day: row.weekend_meeting_day ?? null,
        weekend_meeting_time: row.weekend_meeting_time ?? null,
        capacity: row.capacity ?? null,
      });
      await this.hostsRepo.save(existing);
      updated++;
    }

    await this.cache.clear();
    return {
      created,
      updated,
      total: dto.rows.length + (dto.updateRows?.length ?? 0),
    };
  }

  toDto(host: Host, groupCount: number, guestCount = 0): HostResponseDto {
    const dto = new HostResponseDto();
    dto.id = host.id;
    dto.name = host.name;
    dto.region_id = host.region_id;
    dto.address = host.address;
    dto.lat = host.lat;
    dto.lng = host.lng;
    dto.weekday_meeting_day = host.weekday_meeting_day;
    dto.weekday_meeting_time = host.weekday_meeting_time;
    dto.weekend_meeting_day = host.weekend_meeting_day;
    dto.weekend_meeting_time = host.weekend_meeting_time;
    dto.capacity = host.capacity;
    dto.note = host.note;
    dto.group_count = groupCount;
    dto.guest_count = guestCount;
    dto.created_at = host.created_at;
    dto.updated_at = host.updated_at;
    return dto;
  }
}
