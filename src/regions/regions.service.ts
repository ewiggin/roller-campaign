import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Region } from './entities/region.entity';
import { User } from '../users/entities/user.entity';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionResponseDto } from './dto/region-response.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region)
    private readonly regionsRepository: Repository<Region>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateRegionDto): Promise<RegionResponseDto> {
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
