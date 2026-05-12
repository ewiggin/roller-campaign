import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestGroup } from './entities/guest-group.entity';
import { User } from '../users/entities/user.entity';
import { Region } from '../regions/entities/region.entity';
import { Guest } from '../guests/entities/guest.entity';
import { CreateGuestGroupDto } from './dto/create-guest-group.dto';
import { UpdateGuestGroupDto } from './dto/update-guest-group.dto';
import { GuestGroupResponseDto } from './dto/guest-group-response.dto';
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

  async findAll(regionId: string | undefined, currentUser: JwtPayload): Promise<GuestGroupResponseDto[]> {
    if (currentUser.role !== 'superadmin' && currentUser.role !== 'region_admin') {
      throw new ForbiddenException();
    }

    const query = this.groupsRepository
      .createQueryBuilder('gg')
      .loadRelationCountAndMap('gg.guest_count', 'gg.guests');

    if (regionId) {
      await this.assertRegionAccess(regionId, currentUser);
      query.where('gg.region_id = :regionId', { regionId });
    } else if (currentUser.role === 'region_admin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const ids = (user?.regions ?? []).map((r) => r.id);
      if (ids.length === 0) return [];
      query.where('gg.region_id IN (:...ids)', { ids });
    }

    const groups = await query.getMany();
    return groups.map((g) => this.toDto(g, (g as GuestGroup & { guest_count?: number }).guest_count ?? 0));
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

  toDto(group: GuestGroup, guestCount: number): GuestGroupResponseDto {
    const dto = new GuestGroupResponseDto();
    dto.id = group.id;
    dto.group_code = group.group_code;
    dto.region_id = group.region_id;
    dto.guest_count = guestCount;
    dto.created_at = group.created_at;
    dto.updated_at = group.updated_at;
    return dto;
  }
}
