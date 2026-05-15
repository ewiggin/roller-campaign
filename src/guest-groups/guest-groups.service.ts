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
import { GuestGroup } from './entities/guest-group.entity';
import { Host } from '../hosts/entities/host.entity';
import { User } from '../users/entities/user.entity';
import { Region } from '../regions/entities/region.entity';
import { Guest } from '../guests/entities/guest.entity';
import { CreateGuestGroupDto } from './dto/create-guest-group.dto';
import { UpdateGuestGroupDto } from './dto/update-guest-group.dto';
import { GuestGroupResponseDto } from './dto/guest-group-response.dto';
import { ImportGroupResponseDto } from './dto/import-group-response.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

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

  async create(dto: CreateGuestGroupDto, currentUser: JwtPayload): Promise<GuestGroupResponseDto> {
    await this.assertRegionAccess(dto.region_id, currentUser);

    const region = await this.regionsRepository.findOne({ where: { id: dto.region_id } });
    if (!region) throw new NotFoundException('Región no encontrada');

    const exists = await this.groupsRepository.findOne({ where: { group_code: dto.group_code } });
    if (exists) throw new ConflictException('El código de grupo ya existe');

    const group = this.groupsRepository.create({ group_code: dto.group_code, region_id: dto.region_id });
    const saved = await this.groupsRepository.save(group);
    return this.toDto(saved, 0);
  }

  async findAll(
    regionId: string | undefined,
    currentUser: JwtPayload,
    page = 1,
    limit = 50,
  ): Promise<{ data: GuestGroupResponseDto[]; total: number; page: number; limit: number }> {
    if (currentUser.role !== 'superadmin' && currentUser.role !== 'region_admin') {
      throw new ForbiddenException();
    }

    const query = this.groupsRepository
      .createQueryBuilder('gg')
      .loadRelationCountAndMap('gg.guest_count', 'gg.guests')
      .orderBy('gg.group_code', 'ASC');

    if (regionId) {
      await this.assertRegionAccess(regionId, currentUser);
      query.where('gg.region_id = :regionId', { regionId });
    } else if (currentUser.role === 'region_admin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const ids = (user?.regions ?? []).map((r) => r.id);
      if (ids.length === 0) return { data: [], total: 0, page, limit };
      query.where('gg.region_id IN (:...ids)', { ids });
    }

    const total = await query.getCount();
    const groups = await query.skip((page - 1) * limit).take(limit).getMany();
    return {
      data: groups.map((g) => this.toDto(g, (g as GuestGroup & { guest_count?: number }).guest_count ?? 0)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, currentUser: JwtPayload): Promise<GuestGroupResponseDto> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertRegionAccess(group.region_id, currentUser);

    const guestCount = await this.guestsRepository.count({ where: { group_id: id } });
    return this.toDto(group, guestCount);
  }

  async update(id: string, dto: UpdateGuestGroupDto, currentUser: JwtPayload): Promise<GuestGroupResponseDto> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertRegionAccess(group.region_id, currentUser);

    if (dto.group_code && dto.group_code !== group.group_code) {
      const exists = await this.groupsRepository.findOne({ where: { group_code: dto.group_code } });
      if (exists) throw new ConflictException('El código de grupo ya existe');
    }

    if (dto.region_id && dto.region_id !== group.region_id) {
      await this.assertRegionAccess(dto.region_id, currentUser);
    }

    Object.assign(group, dto);
    const saved = await this.groupsRepository.save(group);
    const guestCount = await this.guestsRepository.count({ where: { group_id: id } });
    return this.toDto(saved, guestCount);
  }

  async remove(id: string): Promise<void> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const guestCount = await this.guestsRepository.count({ where: { group_id: id } });
    if (guestCount > 0) throw new BadRequestException('No se puede eliminar un grupo con invitados');

    await this.groupsRepository.remove(group);
  }

  async setContact(id: string, guestId: string, currentUser: JwtPayload): Promise<void> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertRegionAccess(group.region_id, currentUser);

    const guest = await this.guestsRepository.findOne({ where: { id: guestId } });
    if (!guest) throw new NotFoundException('Invitado no encontrado');
    if (guest.group_id !== id) throw new BadRequestException('El invitado no pertenece a este grupo');

    await this.guestsRepository.update({ group_id: id, is_group_contact: true }, { is_group_contact: false });
    await this.guestsRepository.update({ id: guestId }, { is_group_contact: true });
  }

  async importFromExcel(
    buffer: Buffer,
    regionId: string,
    currentUser: JwtPayload,
  ): Promise<ImportGroupResponseDto> {
    await this.assertRegionAccess(regionId, currentUser);

    const region = await this.regionsRepository.findOne({ where: { id: regionId } });
    if (!region) throw new NotFoundException('Región no encontrada');

    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

    const codes = rows
      .map((r) => {
        const raw = r['group_code'] ?? r['Group Code'] ?? r['Código de Grupo'] ?? Object.values(r)[0];
        if (typeof raw !== 'string') return null;
        const code = raw.trim();
        return code.includes('-') ? code : (code.match(/.{1,4}/g)!.join('-'));
      })
      .filter((c): c is string => !!c);

    let created = 0;
    let skipped = 0;

    for (const code of codes) {
      const exists = await this.groupsRepository.findOne({ where: { group_code: code } });
      if (exists) {
        skipped++;
        continue;
      }
      await this.groupsRepository.save(
        this.groupsRepository.create({ group_code: code, region_id: regionId }),
      );
      created++;
    }

    return { created, skipped, total: codes.length };
  }

  async exportAll(regionId: string | undefined, currentUser: JwtPayload): Promise<Buffer> {
    const query = this.groupsRepository
      .createQueryBuilder('gg')
      .loadRelationCountAndMap('gg.guest_count', 'gg.guests')
      .orderBy('gg.group_code', 'ASC');

    if (regionId) {
      await this.assertRegionAccess(regionId, currentUser);
      query.where('gg.region_id = :regionId', { regionId });
    } else if (currentUser.role === 'region_admin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const ids = (user?.regions ?? []).map((r) => r.id);
      if (ids.length === 0) return this.buildGroupsExcel([]);
      query.where('gg.region_id IN (:...ids)', { ids });
    } else if (currentUser.role !== 'superadmin') {
      throw new ForbiddenException();
    }

    const groups = await query.getMany();

    const regions = await this.regionsRepository.find({ select: ['id', 'name'] });
    const regionMap = new Map(regions.map((r) => [r.id, r.name]));

    const hostIds = [...new Set(groups.map((g) => g.host_id).filter(Boolean))] as string[];
    const hosts = hostIds.length
      ? await this.hostsRepository.find({ where: { id: In(hostIds) }, select: ['id', 'name'] })
      : [];
    const hostMap = new Map(hosts.map((h) => [h.id, h.name]));

    return this.buildGroupsExcel(groups, regionMap, hostMap);
  }

  private buildGroupsExcel(
    groups: (GuestGroup & { guest_count?: number })[],
    regionMap = new Map<string, string>(),
    hostMap = new Map<string, string>(),
  ): Buffer {
    const headers = ['group_code', 'region_name', 'host_name', 'guest_count'];
    const rows = groups.map((g) => [
      g.group_code,
      regionMap.get(g.region_id) ?? '',
      g.host_id ? (hostMap.get(g.host_id) ?? '') : '',
      g.guest_count ?? 0,
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 28 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Grupos');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['group_code'], ['GRP-001'], ['GRP-002']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Groups');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  private async assertRegionAccess(regionId: string, currentUser: JwtPayload): Promise<void> {
    if (currentUser.role === 'superadmin') return;
    if (currentUser.role === 'region_admin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const hasAccess = (user?.regions ?? []).some((r) => r.id === regionId);
      if (!hasAccess) throw new ForbiddenException();
      return;
    }
    throw new ForbiddenException();
  }

  async assignHost(id: string, hostId: string | null, currentUser: JwtPayload): Promise<GuestGroupResponseDto> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertRegionAccess(group.region_id, currentUser);

    if (hostId !== null) {
      const host = await this.hostsRepository.findOne({ where: { id: hostId } });
      if (!host) throw new NotFoundException('Congregación no encontrada');
      if (host.region_id !== group.region_id) {
        throw new BadRequestException('La congregación no pertenece a la misma región que el grupo');
      }
    }

    group.host_id = hostId;
    const saved = await this.groupsRepository.save(group);
    const guestCount = await this.guestsRepository.count({ where: { group_id: id } });
    const hostName = hostId
      ? (await this.hostsRepository.findOne({ where: { id: hostId } }))?.name ?? null
      : null;
    return this.toDto(saved, guestCount, hostName);
  }

  toDto(group: GuestGroup, guestCount: number, hostName?: string | null): GuestGroupResponseDto {
    const dto = new GuestGroupResponseDto();
    dto.id = group.id;
    dto.group_code = group.group_code;
    dto.region_id = group.region_id;
    dto.host_id = group.host_id ?? null;
    dto.host_name = hostName ?? null;
    dto.guest_count = guestCount;
    dto.created_at = group.created_at;
    dto.updated_at = group.updated_at;
    return dto;
  }
}
