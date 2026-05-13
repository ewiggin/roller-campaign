import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Volunteer } from './entities/volunteer.entity';
import { VolunteerRole } from './entities/volunteer-role.entity';
import { VolunteerAvailability } from './entities/volunteer-availability.entity';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { VolunteerListQueryDto } from './dto/volunteer-list-query.dto';
import {
  VolunteerResponseDto,
  VolunteerRoleDto,
  VolunteerRegionDto,
  AvailabilityEntryDto,
} from './dto/volunteer-response.dto';
import {
  SetAvailabilityDto,
  CreateRoleDto,
  ImportVolunteerRowDto,
  ImportVolunteerParseResponseDto,
  ImportVolunteerCommitDto,
  ImportVolunteerCommitResponseDto,
} from './dto/set-availability.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(Volunteer) private readonly volunteersRepo: Repository<Volunteer>,
    @InjectRepository(VolunteerRole) private readonly rolesRepo: Repository<VolunteerRole>,
    @InjectRepository(VolunteerAvailability) private readonly availRepo: Repository<VolunteerAvailability>,
    @InjectRepository(Region) private readonly regionsRepo: Repository<Region>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  // ── Roles ──────────────────────────────────────────────────────────────────

  async findAllRoles(): Promise<VolunteerRoleDto[]> {
    const roles = await this.rolesRepo.find({ order: { name: 'ASC' } });
    return roles.map((r) => ({ id: r.id, name: r.name }));
  }

  async createRole(dto: CreateRoleDto): Promise<VolunteerRoleDto> {
    const exists = await this.rolesRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('El nombre de rol ya existe');
    const saved = await this.rolesRepo.save(this.rolesRepo.create({ name: dto.name }));
    return { id: saved.id, name: saved.name };
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    await this.rolesRepo.remove(role);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(dto: CreateVolunteerDto, currentUser: JwtPayload): Promise<VolunteerResponseDto> {
    const exists = await this.volunteersRepo.findOne({ where: { volunteer_code: dto.volunteer_code } });
    if (exists) throw new ConflictException('El código de voluntario ya existe');

    const roles = dto.role_ids?.length
      ? await this.rolesRepo.find({ where: { id: In(dto.role_ids) } })
      : [];

    const regions = dto.region_ids?.length
      ? await this.regionsRepo.find({ where: { id: In(dto.region_ids) } })
      : [];

    const volunteer = this.volunteersRepo.create({
      volunteer_code: dto.volunteer_code,
      full_name: dto.full_name,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      is_active: dto.is_active ?? true,
      user_id: dto.user_id ?? null,
      roles,
      regions,
    });
    const saved = await this.volunteersRepo.save(volunteer);
    return this.toDto(saved);
  }

  async findAll(
    query: VolunteerListQueryDto,
    currentUser: JwtPayload,
  ): Promise<{ data: VolunteerResponseDto[]; total: number; page: number; limit: number }> {
    if (currentUser.role !== 'superadmin' && currentUser.role !== 'region_admin') {
      throw new ForbiddenException();
    }
    const { regionId, roleId, search, is_active, page = 1, limit = 50 } = query;

    const qb = this.volunteersRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.roles', 'roles')
      .leftJoinAndSelect('v.regions', 'regions');

    if (currentUser.role === 'region_admin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const adminRegionIds = (user?.regions ?? []).map((r) => r.id);
      if (adminRegionIds.length === 0) return { data: [], total: 0, page, limit };

      const filterRegion = regionId && adminRegionIds.includes(regionId) ? regionId : null;
      if (filterRegion) {
        qb.where('regions.id = :regionId', { regionId: filterRegion });
      } else {
        qb.where('regions.id IN (:...adminRegionIds)', { adminRegionIds });
      }
    } else if (regionId) {
      qb.where('regions.id = :regionId', { regionId });
    }

    if (roleId) qb.andWhere('roles.id = :roleId', { roleId });
    if (search) qb.andWhere('v.full_name LIKE :search OR v.volunteer_code LIKE :search', { search: `%${search}%` });
    if (is_active !== undefined) qb.andWhere('v.is_active = :is_active', { is_active });

    const total = await qb.getCount();
    const volunteers = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('v.full_name', 'ASC')
      .getMany();

    return { data: volunteers.map(this.toDto), total, page, limit };
  }

  async findOne(id: string, currentUser: JwtPayload): Promise<VolunteerResponseDto> {
    const v = await this.volunteersRepo.findOne({
      where: { id },
      relations: { roles: true, regions: true },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.assertAccess(v, currentUser);
    return this.toDto(v);
  }

  async update(id: string, dto: UpdateVolunteerDto, currentUser: JwtPayload): Promise<VolunteerResponseDto> {
    const v = await this.volunteersRepo.findOne({
      where: { id },
      relations: { roles: true, regions: true },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.assertAccess(v, currentUser);

    if (dto.volunteer_code && dto.volunteer_code !== v.volunteer_code) {
      const exists = await this.volunteersRepo.findOne({ where: { volunteer_code: dto.volunteer_code } });
      if (exists) throw new ConflictException('El código de voluntario ya existe');
    }

    if (dto.role_ids !== undefined) {
      v.roles = dto.role_ids.length ? await this.rolesRepo.find({ where: { id: In(dto.role_ids) } }) : [];
    }
    if (dto.region_ids !== undefined) {
      v.regions = dto.region_ids.length ? await this.regionsRepo.find({ where: { id: In(dto.region_ids) } }) : [];
    }

    Object.assign(v, {
      volunteer_code: dto.volunteer_code ?? v.volunteer_code,
      full_name: dto.full_name ?? v.full_name,
      email: dto.email !== undefined ? dto.email : v.email,
      phone: dto.phone !== undefined ? dto.phone : v.phone,
      is_active: dto.is_active !== undefined ? dto.is_active : v.is_active,
    });

    const saved = await this.volunteersRepo.save(v);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const v = await this.volunteersRepo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.volunteersRepo.remove(v);
  }

  // ── Availability ───────────────────────────────────────────────────────────

  async setAvailability(id: string, dto: SetAvailabilityDto, currentUser: JwtPayload): Promise<AvailabilityEntryDto[]> {
    const v = await this.volunteersRepo.findOne({ where: { id }, relations: { regions: true } });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.assertAccess(v, currentUser);

    await this.availRepo.delete({ volunteer_id: id, region_id: dto.region_id });

    if (dto.dates.length > 0) {
      const entries = dto.dates.map((date) =>
        this.availRepo.create({ volunteer_id: id, region_id: dto.region_id, date, note: null }),
      );
      await this.availRepo.save(entries);
    }

    return this.getAvailability(id, currentUser);
  }

  async getAvailability(id: string, currentUser: JwtPayload): Promise<AvailabilityEntryDto[]> {
    const v = await this.volunteersRepo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.assertAccess(v, currentUser);

    const entries = await this.availRepo.find({
      where: { volunteer_id: id },
      order: { date: 'ASC' },
    });
    return entries.map((e) => ({ date: e.date, region_id: e.region_id, note: e.note }));
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async parseImport(buffer: Buffer): Promise<ImportVolunteerParseResponseDto> {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: null });

    const codes = rows.map((r) => this.str(r['volunteer_code'])).filter(Boolean) as string[];
    const existing = codes.length
      ? await this.volunteersRepo.find({ where: { volunteer_code: In(codes) }, select: { volunteer_code: true } })
      : [];
    const existingSet = new Set(existing.map((v) => v.volunteer_code));

    const to_create: ImportVolunteerRowDto[] = [];
    const skipped: string[] = [];

    for (const row of rows) {
      const code = this.str(row['volunteer_code']);
      if (!code) continue;
      if (existingSet.has(code)) { skipped.push(code); continue; }
      to_create.push({
        volunteer_code: code,
        full_name: this.str(row['full_name']) ?? code,
        email: this.str(row['email']),
        phone: this.str(row['phone']),
      });
    }

    return {
      to_create,
      skipped,
      summary: { total: rows.length, to_create: to_create.length, skipped: skipped.length },
    };
  }

  async commitImport(dto: ImportVolunteerCommitDto): Promise<ImportVolunteerCommitResponseDto> {
    const regions = dto.region_ids?.length
      ? await this.regionsRepo.find({ where: { id: In(dto.region_ids) } })
      : [];

    let created = 0;
    let skipped = 0;

    for (const row of dto.rows) {
      const exists = await this.volunteersRepo.findOne({ where: { volunteer_code: row.volunteer_code } });
      if (exists) { skipped++; continue; }
      await this.volunteersRepo.save(
        this.volunteersRepo.create({
          volunteer_code: row.volunteer_code,
          full_name: row.full_name,
          email: row.email ?? null,
          phone: row.phone ?? null,
          regions,
        }),
      );
      created++;
    }

    return { created, skipped, total: dto.rows.length };
  }

  // ── Me (volunteer role) ────────────────────────────────────────────────────

  async getMe(currentUser: JwtPayload): Promise<VolunteerResponseDto> {
    const v = await this.volunteersRepo.findOne({
      where: { user_id: currentUser.sub },
      relations: { roles: true, regions: true },
    });
    if (!v) throw new NotFoundException('No tienes un perfil de voluntario vinculado a esta cuenta');
    return this.toDto(v);
  }

  async getMyAvailability(currentUser: JwtPayload): Promise<AvailabilityEntryDto[]> {
    const v = await this.volunteersRepo.findOne({ where: { user_id: currentUser.sub } });
    if (!v) throw new NotFoundException('No tienes un perfil de voluntario vinculado a esta cuenta');
    const entries = await this.availRepo.find({ where: { volunteer_id: v.id }, order: { date: 'ASC' } });
    return entries.map((e) => ({ date: e.date, region_id: e.region_id, note: e.note }));
  }

  async setMyAvailability(currentUser: JwtPayload, dto: SetAvailabilityDto): Promise<AvailabilityEntryDto[]> {
    const v = await this.volunteersRepo.findOne({ where: { user_id: currentUser.sub } });
    if (!v) throw new NotFoundException('No tienes un perfil de voluntario vinculado a esta cuenta');
    return this.setAvailability(v.id, dto, currentUser);
  }

  async findVolunteerByUserId(userId: string): Promise<Volunteer | null> {
    return this.volunteersRepo.findOne({ where: { user_id: userId } });
  }

  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['volunteer_code', 'full_name', 'email', 'phone']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Voluntarios');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertAccess(v: Volunteer, currentUser: JwtPayload): Promise<void> {
    if (currentUser.role === 'superadmin') return;
    if (currentUser.role === 'volunteer') {
      if (v.user_id === currentUser.sub) return;
      throw new ForbiddenException();
    }
    if (currentUser.role === 'region_admin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const adminIds = new Set((user?.regions ?? []).map((r) => r.id));
      const volunteerRegionIds = (v.regions ?? []).map((r) => r.id);
      if (volunteerRegionIds.some((id) => adminIds.has(id))) return;
      throw new ForbiddenException();
    }
    throw new ForbiddenException();
  }

  private toDto = (v: Volunteer): VolunteerResponseDto => ({
    id: v.id,
    volunteer_code: v.volunteer_code,
    full_name: v.full_name,
    email: v.email,
    phone: v.phone,
    is_active: v.is_active,
    user_id: v.user_id,
    roles: (v.roles ?? []).map((r) => ({ id: r.id, name: r.name })),
    regions: (v.regions ?? []).map((r) => ({ id: r.id, name: r.name })),
    created_at: v.created_at,
    updated_at: v.updated_at,
  });

  private str(val: unknown): string | null {
    if (val === null || val === undefined || val === '') return null;
    return String(val).trim() || null;
  }
}
