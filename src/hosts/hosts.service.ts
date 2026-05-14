import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Host } from './entities/host.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Guest } from '../guests/entities/guest.entity';
import { User } from '../users/entities/user.entity';
import { Region } from '../regions/entities/region.entity';
import {
  CreateHostDto, UpdateHostDto, HostResponseDto,
  GroupSuggestionDto, GroupSuggestionsResponseDto,
} from './dto/host.dto';
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
  ) {}

  async create(dto: CreateHostDto, currentUser: JwtPayload): Promise<HostResponseDto> {
    await this.assertRegionAccess(dto.region_id, currentUser);
    const region = await this.regionsRepo.findOne({ where: { id: dto.region_id } });
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
    });
    const saved = await this.hostsRepo.save(host);
    return this.toDto(saved, 0);
  }

  async findAll(regionId: string | undefined, currentUser: JwtPayload): Promise<HostResponseDto[]> {
    const qb = this.hostsRepo
      .createQueryBuilder('h')
      .loadRelationCountAndMap('h.group_count', 'h.groups');

    if (regionId) {
      await this.assertRegionAccess(regionId, currentUser);
      qb.where('h.region_id = :regionId', { regionId });
    } else if (currentUser.role === 'region_admin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const ids = (user?.regions ?? []).map((r) => r.id);
      if (ids.length === 0) return [];
      qb.where('h.region_id IN (:...ids)', { ids });
    } else if (currentUser.role !== 'superadmin') {
      throw new ForbiddenException();
    }

    const hosts = await qb.orderBy('h.name', 'ASC').getMany();
    const guestCounts = await this.guestCountsForHosts(hosts.map((h) => h.id));
    return hosts.map((h) =>
      this.toDto(h, (h as Host & { group_count?: number }).group_count ?? 0, guestCounts.get(h.id) ?? 0),
    );
  }

  async update(id: string, dto: UpdateHostDto, currentUser: JwtPayload): Promise<HostResponseDto> {
    const host = await this.hostsRepo.findOne({ where: { id } });
    if (!host) throw new NotFoundException('Congregación no encontrada');
    await this.assertRegionAccess(host.region_id, currentUser);

    Object.assign(host, dto);
    const saved = await this.hostsRepo.save(host);
    const groupCount = await this.groupsRepo.count({ where: { host_id: id } });
    const guestCount = await this.guestCountForHost(id);
    return this.toDto(saved, groupCount, guestCount);
  }

  async remove(id: string): Promise<void> {
    const host = await this.hostsRepo.findOne({ where: { id } });
    if (!host) throw new NotFoundException('Congregación no encontrada');

    // Unassign groups before removing
    await this.groupsRepo.update({ host_id: id }, { host_id: null });
    await this.hostsRepo.remove(host);
  }

  async getGroupSuggestions(hostId: string, currentUser: JwtPayload): Promise<GroupSuggestionsResponseDto> {
    const host = await this.hostsRepo.findOne({ where: { id: hostId } });
    if (!host) throw new NotFoundException('Congregación no encontrada');
    await this.assertRegionAccess(host.region_id, currentUser);

    const groups = await this.groupsRepo
      .createQueryBuilder('gg')
      .loadRelationCountAndMap('gg.guest_count', 'gg.guests')
      .where('gg.region_id = :regionId', { regionId: host.region_id })
      .getMany();

    // One query: first guest with accommodation coords per group
    const groupIds = groups.map((g) => g.id);
    const guestCoords = groupIds.length > 0
      ? await this.guestsRepo
          .createQueryBuilder('g')
          .select('g.group_id', 'group_id')
          .addSelect('g.lat', 'lat')
          .addSelect('g.lng', 'lng')
          .where('g.group_id IN (:...groupIds)', { groupIds })
          .andWhere('g.lat IS NOT NULL')
          .andWhere('g.lng IS NOT NULL')
          .getRawMany<{ group_id: string; lat: string; lng: string }>()
      : [];

    // Keep only the first row per group (first guest with coords)
    const coordByGroup = new Map<string, { lat: number; lng: number }>();
    for (const row of guestCoords) {
      if (!coordByGroup.has(row.group_id)) {
        coordByGroup.set(row.group_id, { lat: parseFloat(row.lat), lng: parseFloat(row.lng) });
      }
    }

    const withDistance = groups.map((group) => {
      const guestCount = (group as GuestGroup & { guest_count?: number }).guest_count ?? 0;
      let distance_km: number | null = null;

      if (host.lat !== null && host.lng !== null) {
        const coord = coordByGroup.get(group.id);
        if (coord) {
          distance_km = Math.round(this.haversine(host.lat, host.lng, coord.lat, coord.lng) * 10) / 10;
        }
      }

      const dto: GroupSuggestionDto = {
        id: group.id,
        group_code: group.group_code,
        guest_count: guestCount,
        distance_km,
      };
      return { dto, host_id: group.host_id };
    });

    const sort = (a: GroupSuggestionDto, b: GroupSuggestionDto) => {
      if (a.distance_km === null && b.distance_km === null) return a.group_code.localeCompare(b.group_code);
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    };

    const assigned = withDistance.filter((r) => r.host_id === hostId).map((r) => r.dto).sort(sort);
    const available = withDistance.filter((r) => r.host_id === null).map((r) => r.dto).sort(sort);

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

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async assertRegionAccess(regionId: string, currentUser: JwtPayload): Promise<void> {
    if (currentUser.role === 'superadmin') return;
    if (currentUser.role === 'region_admin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      if ((user?.regions ?? []).some((r) => r.id === regionId)) return;
    }
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

  private async guestCountsForHosts(hostIds: string[]): Promise<Map<string, number>> {
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

  async exportGuestsByHost(id: string, currentUser: JwtPayload): Promise<{ buffer: Buffer; filename: string }> {
    const host = await this.hostsRepo.findOne({ where: { id } });
    if (!host) throw new NotFoundException('Host no encontrado');
    await this.assertRegionAccess(host.region_id, currentUser);

    const groups = await this.groupsRepo.find({ where: { host_id: id } });
    const groupIds = groups.map((g) => g.id);
    const groupCodeMap = new Map(groups.map((g) => [g.id, g.group_code]));

    const guests = groupIds.length > 0
      ? await this.guestsRepo.find({
          where: { group_id: In(groupIds) },
          order: { group_id: 'ASC', full_name: 'ASC' },
        })
      : [];

    const headers = [
      'Grupo', 'Código', 'Nombre', 'Email', 'Ciudad origen',
      'Habla inglés', 'Otros idiomas',
      'Llegada fecha', 'Llegada hora', 'Salida fecha', 'Salida hora',
      'Transporte', 'Vuelo', 'Transp. aeropuerto', 'Dirección alojamiento', 'Estado',
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
      { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 28 }, { wch: 18 },
      { wch: 12 }, { wch: 24 },
      { wch: 13 }, { wch: 11 }, { wch: 13 }, { wch: 11 },
      { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 36 }, { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Invitados');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const safeName = host.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { buffer, filename: `invitados-${safeName}.xlsx` };
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
    dto.group_count = groupCount;
    dto.guest_count = guestCount;
    dto.created_at = host.created_at;
    dto.updated_at = host.updated_at;
    return dto;
  }
}
