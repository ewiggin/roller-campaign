import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    const withDistance = await Promise.all(
      groups.map(async (group) => {
        const guestCount = (group as GuestGroup & { guest_count?: number }).guest_count ?? 0;
        let distance_km: number | null = null;

        if (host.lat !== null && host.lng !== null) {
          const coords = await this.guestsRepo
            .createQueryBuilder('g')
            .select('AVG(g.lat)', 'avg_lat')
            .addSelect('AVG(g.lng)', 'avg_lng')
            .where('g.group_id = :groupId', { groupId: group.id })
            .andWhere('g.lat IS NOT NULL')
            .andWhere('g.lng IS NOT NULL')
            .getRawOne<{ avg_lat: string; avg_lng: string }>();

          const avgLat = parseFloat(coords?.avg_lat ?? '');
          const avgLng = parseFloat(coords?.avg_lng ?? '');
          if (!isNaN(avgLat) && !isNaN(avgLng)) {
            distance_km = this.haversine(host.lat, host.lng, avgLat, avgLng);
          }
        }

        const dto: GroupSuggestionDto = {
          id: group.id,
          group_code: group.group_code,
          guest_count: guestCount,
          distance_km,
        };
        return { dto, host_id: group.host_id };
      }),
    );

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
