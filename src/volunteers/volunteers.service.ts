import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
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
  VolunteerActivityDto,
  VolunteerResponseDto,
  VolunteerRoleDto,
  VolunteerRegionDto,
  AvailabilityEntryDto,
  VolunteerPreachingGroupDto,
  VolunteerPreachingGroupVolunteerDto,
  VolunteerPreachingGroupGuestDto,
  VolunteerPreachingGroupGuestGroupDto,
} from './dto/volunteer-response.dto';
import {
  VolunteerCodeTokenResponseDto,
  VolunteerFormLookupResponseDto,
} from './dto/volunteer-form-lookup.dto';
import { VolunteerFormSubmitDto } from './dto/volunteer-form-submit.dto';
import {
  SetAvailabilityDto,
  CreateRoleDto,
  ImportVolunteerRowDto,
  ImportVolunteerParseResponseDto,
  ImportVolunteerCommitDto,
  ImportVolunteerCommitResponseDto,
} from './dto/set-availability.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { LocationPoint } from '../activities/dto/location-point.dto';

const VOLUNTEER_TOKEN_TYPE = 'volunteer_access';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(Volunteer)
    private readonly volunteersRepo: Repository<Volunteer>,
    @InjectRepository(VolunteerRole)
    private readonly rolesRepo: Repository<VolunteerRole>,
    @InjectRepository(VolunteerAvailability)
    private readonly availRepo: Repository<VolunteerAvailability>,
    @InjectRepository(Region) private readonly regionsRepo: Repository<Region>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  private buildSearchCondition(alias: string): string {
    if (this.dataSource.options.type === 'postgres') {
      return (
        `(unaccent(lower(${alias}.full_name)) LIKE unaccent(lower(:search))` +
        ` OR unaccent(lower(${alias}.volunteer_code)) LIKE unaccent(lower(:search)))`
      );
    }
    return (
      `(lower(${alias}.full_name) LIKE lower(:search)` +
      ` OR lower(${alias}.volunteer_code) LIKE lower(:search))`
    );
  }

  // ── Roles ──────────────────────────────────────────────────────────────────

  async findAllRoles(): Promise<VolunteerRoleDto[]> {
    const roles = await this.rolesRepo.find({ order: { name: 'ASC' } });
    return roles.map((r) => ({ id: r.id, name: r.name }));
  }

  async createRole(dto: CreateRoleDto): Promise<VolunteerRoleDto> {
    const exists = await this.rolesRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('El nombre de rol ya existe');
    const saved = await this.rolesRepo.save(
      this.rolesRepo.create({ name: dto.name }),
    );
    return { id: saved.id, name: saved.name };
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    await this.rolesRepo.remove(role);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(
    dto: CreateVolunteerDto,
    currentUser: JwtPayload,
  ): Promise<VolunteerResponseDto> {
    const exists = await this.volunteersRepo.findOne({
      where: { volunteer_code: dto.volunteer_code },
    });
    if (exists)
      throw new ConflictException('El código de voluntario ya existe');

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
  ): Promise<{
    data: VolunteerResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      regionId,
      roleId,
      search,
      is_active,
      date,
      min_car_seats,
      available_slots,
      terms_accepted,
      page = 1,
      limit = 50,
    } = query;

    const qb = this.volunteersRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.roles', 'roles')
      .leftJoinAndSelect('v.regions', 'regions');

    let effectiveRegionId: string | null = null;

    if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const adminRegionIds = (user?.regions ?? []).map((r) => r.id);
      if (adminRegionIds.length === 0)
        return { data: [], total: 0, page, limit };

      effectiveRegionId =
        regionId && adminRegionIds.includes(regionId) ? regionId : null;
      if (effectiveRegionId) {
        qb.where('regions.id = :regionId', { regionId: effectiveRegionId });
      } else {
        qb.where('regions.id IN (:...adminRegionIds)', { adminRegionIds });
      }
    } else if (regionId) {
      effectiveRegionId = regionId;
      qb.where('regions.id = :regionId', { regionId });
    }

    if (roleId) qb.andWhere('roles.id = :roleId', { roleId });
    if (search)
      qb.andWhere(this.buildSearchCondition('v'), { search: `%${search}%` });
    if (is_active !== undefined)
      qb.andWhere('v.is_active = :is_active', { is_active });

    if (date && effectiveRegionId) {
      qb.andWhere(
        `(NOT EXISTS (
          SELECT 1 FROM volunteer_availability _va
          WHERE _va.volunteer_id = v.id AND _va.region_id = :_avRegion
        ) OR EXISTS (
          SELECT 1 FROM volunteer_availability _va2
          WHERE _va2.volunteer_id = v.id AND _va2.region_id = :_avRegion AND _va2.date = :_avDate
        ))`,
        { _avRegion: effectiveRegionId, _avDate: date },
      );
    }

    if (min_car_seats !== undefined) {
      qb.andWhere('v.car_seats >= :min_car_seats', { min_car_seats });
    }
    if (available_slots?.length) {
      const parts = available_slots.map((s, i) => `v.${s} = :_av${i}`);
      const params = Object.fromEntries(
        available_slots.map((_, i) => [`_av${i}`, true]),
      );
      qb.andWhere(`(${parts.join(' AND ')})`, params);
    }
    if (terms_accepted === true) {
      qb.andWhere('v.terms_accepted = :terms_accepted', {
        terms_accepted: true,
      });
    } else if (terms_accepted === false) {
      qb.andWhere(
        '(v.terms_accepted IS NULL OR v.terms_accepted = :terms_accepted)',
        { terms_accepted: false },
      );
    }

    const total = await qb.getCount();
    const volunteers = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('v.full_name', 'ASC')
      .getMany();

    return { data: volunteers.map(this.toDto), total, page, limit };
  }

  async findOne(
    id: string,
    currentUser: JwtPayload,
  ): Promise<VolunteerResponseDto> {
    const v = await this.volunteersRepo.findOne({
      where: { id },
      relations: { roles: true, regions: true },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.assertAccess(v, currentUser);
    return this.toDto(v);
  }

  async update(
    id: string,
    dto: UpdateVolunteerDto,
    currentUser: JwtPayload,
  ): Promise<VolunteerResponseDto> {
    const v = await this.volunteersRepo.findOne({
      where: { id },
      relations: { roles: true, regions: true },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.assertAccess(v, currentUser);

    if (dto.volunteer_code && dto.volunteer_code !== v.volunteer_code) {
      const exists = await this.volunteersRepo.findOne({
        where: { volunteer_code: dto.volunteer_code },
      });
      if (exists)
        throw new ConflictException('El código de voluntario ya existe');
    }

    if (dto.role_ids !== undefined) {
      v.roles = dto.role_ids.length
        ? await this.rolesRepo.find({ where: { id: In(dto.role_ids) } })
        : [];
    }
    if (dto.region_ids !== undefined) {
      v.regions = dto.region_ids.length
        ? await this.regionsRepo.find({ where: { id: In(dto.region_ids) } })
        : [];
    }

    Object.assign(v, {
      volunteer_code: dto.volunteer_code ?? v.volunteer_code,
      full_name: dto.full_name ?? v.full_name,
      email: dto.email !== undefined ? dto.email : v.email,
      phone: dto.phone !== undefined ? dto.phone : v.phone,
      is_active: dto.is_active !== undefined ? dto.is_active : v.is_active,
      hosting_address:
        dto.hosting_address !== undefined
          ? dto.hosting_address
          : v.hosting_address,
      lat: dto.lat !== undefined ? dto.lat : v.lat,
      lng: dto.lng !== undefined ? dto.lng : v.lng,
      maps_link: dto.maps_link !== undefined ? dto.maps_link : v.maps_link,
      car_seats: dto.car_seats !== undefined ? dto.car_seats : v.car_seats,
      monday_morning:
        dto.monday_morning !== undefined
          ? dto.monday_morning
          : v.monday_morning,
      monday_afternoon:
        dto.monday_afternoon !== undefined
          ? dto.monday_afternoon
          : v.monday_afternoon,
      tuesday_morning:
        dto.tuesday_morning !== undefined
          ? dto.tuesday_morning
          : v.tuesday_morning,
      tuesday_afternoon:
        dto.tuesday_afternoon !== undefined
          ? dto.tuesday_afternoon
          : v.tuesday_afternoon,
      wednesday_morning:
        dto.wednesday_morning !== undefined
          ? dto.wednesday_morning
          : v.wednesday_morning,
      wednesday_afternoon:
        dto.wednesday_afternoon !== undefined
          ? dto.wednesday_afternoon
          : v.wednesday_afternoon,
      thursday_morning:
        dto.thursday_morning !== undefined
          ? dto.thursday_morning
          : v.thursday_morning,
      thursday_afternoon:
        dto.thursday_afternoon !== undefined
          ? dto.thursday_afternoon
          : v.thursday_afternoon,
      friday_morning:
        dto.friday_morning !== undefined
          ? dto.friday_morning
          : v.friday_morning,
      friday_afternoon:
        dto.friday_afternoon !== undefined
          ? dto.friday_afternoon
          : v.friday_afternoon,
      saturday_morning:
        dto.saturday_morning !== undefined
          ? dto.saturday_morning
          : v.saturday_morning,
      saturday_afternoon:
        dto.saturday_afternoon !== undefined
          ? dto.saturday_afternoon
          : v.saturday_afternoon,
      sunday_morning:
        dto.sunday_morning !== undefined
          ? dto.sunday_morning
          : v.sunday_morning,
      sunday_afternoon:
        dto.sunday_afternoon !== undefined
          ? dto.sunday_afternoon
          : v.sunday_afternoon,
      saturday_prev_morning:
        dto.saturday_prev_morning !== undefined
          ? dto.saturday_prev_morning
          : v.saturday_prev_morning,
      saturday_prev_afternoon:
        dto.saturday_prev_afternoon !== undefined
          ? dto.saturday_prev_afternoon
          : v.saturday_prev_afternoon,
      sunday_prev_morning:
        dto.sunday_prev_morning !== undefined
          ? dto.sunday_prev_morning
          : v.sunday_prev_morning,
      sunday_prev_afternoon:
        dto.sunday_prev_afternoon !== undefined
          ? dto.sunday_prev_afternoon
          : v.sunday_prev_afternoon,
      monday_next_morning:
        dto.monday_next_morning !== undefined
          ? dto.monday_next_morning
          : v.monday_next_morning,
      monday_next_afternoon:
        dto.monday_next_afternoon !== undefined
          ? dto.monday_next_afternoon
          : v.monday_next_afternoon,
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

  async setAvailability(
    id: string,
    dto: SetAvailabilityDto,
    currentUser: JwtPayload,
  ): Promise<AvailabilityEntryDto[]> {
    const v = await this.volunteersRepo.findOne({
      where: { id },
      relations: { regions: true },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.assertAccess(v, currentUser);

    await this.availRepo.delete({ volunteer_id: id, region_id: dto.region_id });

    if (dto.dates.length > 0) {
      const entries = dto.dates.map((date) =>
        this.availRepo.create({
          volunteer_id: id,
          region_id: dto.region_id,
          date,
          note: null,
        }),
      );
      await this.availRepo.save(entries);
    }

    return this.getAvailability(id, currentUser);
  }

  async getAvailability(
    id: string,
    currentUser: JwtPayload,
  ): Promise<AvailabilityEntryDto[]> {
    const v = await this.volunteersRepo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    await this.assertAccess(v, currentUser);

    const entries = await this.availRepo.find({
      where: { volunteer_id: id },
      order: { date: 'ASC' },
    });
    return entries.map((e) => ({
      date: e.date,
      region_id: e.region_id,
      note: e.note,
    }));
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async parseImport(buffer: Buffer): Promise<ImportVolunteerParseResponseDto> {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: false,
      defval: null,
    });

    const codes = rows
      .map((r) => this.str(r['Número de identificación']))
      .filter(Boolean) as string[];
    const existing = codes.length
      ? await this.volunteersRepo.find({
          where: { volunteer_code: In(codes) },
          select: { volunteer_code: true },
        })
      : [];
    const existingSet = new Set(existing.map((v) => v.volunteer_code));

    const to_create: ImportVolunteerRowDto[] = [];
    const skipped: string[] = [];
    const excelCodes = new Set<string>();

    for (const row of rows) {
      const rawCode = this.str(row['Número de identificación']);
      const code =
        rawCode ?? `GEN-${randomBytes(4).toString('hex').toUpperCase()}`;
      if (rawCode) excelCodes.add(code);
      if (rawCode && existingSet.has(code)) {
        skipped.push(code);
        continue;
      }

      to_create.push({
        volunteer_code: code,
        full_name: this.str(row['Nombre']) ?? code,
        email: this.str(row['Email']),
        phone: this.str(row['Teléfono']),
        region_name: this.str(row['Región de participación']),
        car_seats: this.parseNum(row['Plazas de coche disponibles']),
        hosting_address: this.str(row['Dirección']),
        lat: this.parseCoord(row['Lat']),
        lng: this.parseCoord(row['Lon']),
        maps_link: this.str(row['Maps']),
        sex: this.str(row['Sexo']),
        civil_status: this.str(row['Estado civil']),
        congregation: this.str(row['Congregación']),
        branch: this.str(row['Sucursal']),
        has_assigned_shift: this.str(row['Tiene asignado un turno']),
        groups: this.str(row['Grupos']),
        assigned_hours: this.parseNum(row['Horas asignadas']),
        is_active:
          row['Activo'] !== undefined
            ? this.parseBool(row['Activo'])
            : undefined,
        role_names: this.str(row['Roles']),
        monday_morning: this.parseBool(row['Lu M']),
        monday_afternoon: this.parseBool(row['Lu T']),
        tuesday_morning: this.parseBool(row['Ma M']),
        tuesday_afternoon: this.parseBool(row['Ma T']),
        wednesday_morning: this.parseBool(row['Mi M']),
        wednesday_afternoon: this.parseBool(row['Mi T']),
        thursday_morning: this.parseBool(row['Ju M']),
        thursday_afternoon: this.parseBool(row['Ju T']),
        friday_morning: this.parseBool(row['Vi M']),
        friday_afternoon: this.parseBool(row['Vi T']),
        saturday_morning: this.parseBool(row['Sa M']),
        saturday_afternoon: this.parseBool(row['Sa T']),
        sunday_morning: this.parseBool(row['Do M']),
        sunday_afternoon: this.parseBool(row['Do T']),
        saturday_prev_morning: this.parseBool(row['SaA M']),
        saturday_prev_afternoon: this.parseBool(row['SaA T']),
        sunday_prev_morning: this.parseBool(row['DoA M']),
        sunday_prev_afternoon: this.parseBool(row['DoA T']),
        monday_next_morning: this.parseBool(row['LuS M']),
        monday_next_afternoon: this.parseBool(row['LuS T']),
      });
    }

    // Volunteers in DB absent from the Excel
    const allDbVolunteers = await this.volunteersRepo.find({
      select: { volunteer_code: true },
    });
    const to_delete = allDbVolunteers
      .map((v) => v.volunteer_code)
      .filter((c) => !excelCodes.has(c));

    return {
      to_create,
      skipped,
      to_delete,
      summary: {
        total: to_create.length + skipped.length,
        to_create: to_create.length,
        skipped: skipped.length,
        to_delete: to_delete.length,
      },
    };
  }

  async commitImport(
    dto: ImportVolunteerCommitDto,
  ): Promise<ImportVolunteerCommitResponseDto> {
    // Pre-load all regions once for name lookups
    const allRegions = await this.regionsRepo.find();
    const regionByName = new Map(
      allRegions.map((r) => [r.name.trim().toLowerCase(), r]),
    );

    // Fall back to region_ids if provided (legacy path)
    const fallbackRegions = dto.region_ids?.length
      ? allRegions.filter((r) => dto.region_ids!.includes(r.id))
      : [];

    let created = 0;
    let skipped = 0;

    for (const row of dto.rows) {
      const exists = await this.volunteersRepo.findOne({
        where: { volunteer_code: row.volunteer_code },
      });
      if (exists) {
        skipped++;
        continue;
      }

      // Resolve region: prefer name from row, fall back to region_ids
      const rowRegion = row.region_name
        ? regionByName.get(row.region_name.trim().toLowerCase())
        : undefined;
      const regions = rowRegion ? [rowRegion] : fallbackRegions;

      await this.volunteersRepo.save(
        this.volunteersRepo.create({
          volunteer_code: row.volunteer_code,
          full_name: row.full_name,
          email: row.email ?? null,
          phone: row.phone ?? null,
          is_active: row.is_active ?? true,
          regions,
          car_seats: row.car_seats ?? null,
          hosting_address: row.hosting_address ?? null,
          lat: row.lat ?? null,
          lng: row.lng ?? null,
          maps_link: row.maps_link ?? null,
          monday_morning: row.monday_morning ?? false,
          monday_afternoon: row.monday_afternoon ?? false,
          tuesday_morning: row.tuesday_morning ?? false,
          tuesday_afternoon: row.tuesday_afternoon ?? false,
          wednesday_morning: row.wednesday_morning ?? false,
          wednesday_afternoon: row.wednesday_afternoon ?? false,
          thursday_morning: row.thursday_morning ?? false,
          thursday_afternoon: row.thursday_afternoon ?? false,
          friday_morning: row.friday_morning ?? false,
          friday_afternoon: row.friday_afternoon ?? false,
          saturday_morning: row.saturday_morning ?? false,
          saturday_afternoon: row.saturday_afternoon ?? false,
          sunday_morning: row.sunday_morning ?? false,
          sunday_afternoon: row.sunday_afternoon ?? false,
          saturday_prev_morning: row.saturday_prev_morning ?? false,
          saturday_prev_afternoon: row.saturday_prev_afternoon ?? false,
          sunday_prev_morning: row.sunday_prev_morning ?? false,
          sunday_prev_afternoon: row.sunday_prev_afternoon ?? false,
          monday_next_morning: row.monday_next_morning ?? false,
          monday_next_afternoon: row.monday_next_afternoon ?? false,
        }),
      );
      created++;
    }

    // ── Delete absent (global) ────────────────────────────────────────────
    let deleted = 0;
    if (dto.deleteAbsent) {
      const codesToDelete = dto.toDeleteCodes ?? [];
      if (codesToDelete.length > 0) {
        // DB has ON DELETE CASCADE on all volunteer join tables and availability
        for (let i = 0; i < codesToDelete.length; i += 200) {
          await this.volunteersRepo.delete({
            volunteer_code: In(codesToDelete.slice(i, i + 200)),
          });
        }
        deleted = codesToDelete.length;
      }
    }

    return {
      created,
      skipped,
      total: dto.rows.length,
      ...(deleted > 0 ? { deleted } : {}),
    };
  }

  // ── Me (volunteer role) ────────────────────────────────────────────────────

  async getMe(currentUser: JwtPayload): Promise<VolunteerResponseDto> {
    const v = await this.volunteersRepo.findOne({
      where: { user_id: currentUser.sub },
      relations: { roles: true, regions: true },
    });
    if (!v)
      throw new NotFoundException(
        'No tienes un perfil de voluntario vinculado a esta cuenta',
      );
    return this.toDto(v);
  }

  async getMyAvailability(
    currentUser: JwtPayload,
  ): Promise<AvailabilityEntryDto[]> {
    const v = await this.volunteersRepo.findOne({
      where: { user_id: currentUser.sub },
    });
    if (!v)
      throw new NotFoundException(
        'No tienes un perfil de voluntario vinculado a esta cuenta',
      );
    const entries = await this.availRepo.find({
      where: { volunteer_id: v.id },
      order: { date: 'ASC' },
    });
    return entries.map((e) => ({
      date: e.date,
      region_id: e.region_id,
      note: e.note,
    }));
  }

  async setMyAvailability(
    currentUser: JwtPayload,
    dto: SetAvailabilityDto,
  ): Promise<AvailabilityEntryDto[]> {
    const v = await this.volunteersRepo.findOne({
      where: { user_id: currentUser.sub },
    });
    if (!v)
      throw new NotFoundException(
        'No tienes un perfil de voluntario vinculado a esta cuenta',
      );
    return this.setAvailability(v.id, dto, currentUser);
  }

  async findVolunteerByUserId(userId: string): Promise<Volunteer | null> {
    return this.volunteersRepo.findOne({ where: { user_id: userId } });
  }

  generateTemplate(): Buffer {
    const headers = [
      'Número de identificación',
      'Nombre',
      'Email',
      'Teléfono',
      'Región de participación',
      'Plazas de coche disponibles',
      'Dirección',
      'Maps',
      'Lat',
      'Lon',
      'Lu M',
      'Lu T',
      'Ma M',
      'Ma T',
      'Mi M',
      'Mi T',
      'Ju M',
      'Ju T',
      'Vi M',
      'Vi T',
      'Sa M',
      'Sa T',
      'Do M',
      'Do T',
      'SaA M',
      'SaA T',
      'DoA M',
      'DoA T',
      'LuS M',
      'LuS T',
    ];
    const example = [
      '5274026',
      'Martínez, Mario',
      'mario@example.com',
      '+34 600 000 000',
      'Costa Brava',
      '3',
      'Passatge Bernat Metge, 14, 17800 Olot',
      'https://www.google.com/maps?q=42.18,2.47',
      '42,1836987',
      '2,4774935',
      'No',
      'No',
      'No',
      'No',
      'No',
      'No',
      'No',
      'No',
      'No',
      'No',
      'Sí',
      'Sí',
      'Sí',
      'Sí',
      'No',
      'No',
      'No',
      'No',
      'No',
      'No',
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    XLSX.utils.book_append_sheet(wb, ws, 'Voluntarios');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportAll(
    query: VolunteerListQueryDto,
    currentUser: JwtPayload,
  ): Promise<Buffer> {
    const {
      regionId,
      roleId,
      search,
      is_active,
      min_car_seats,
      available_slots,
    } = query;

    const qb = this.volunteersRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.roles', 'roles')
      .leftJoinAndSelect('v.regions', 'regions');

    if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepo.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const adminRegionIds = (user?.regions ?? []).map((r) => r.id);
      if (adminRegionIds.length === 0) return this.buildVolunteersExcel([]);
      const filterRegion =
        regionId && adminRegionIds.includes(regionId) ? regionId : null;
      if (filterRegion) {
        qb.where('regions.id = :regionId', { regionId: filterRegion });
      } else {
        qb.where('regions.id IN (:...adminRegionIds)', { adminRegionIds });
      }
    } else {
      if (regionId) qb.where('regions.id = :regionId', { regionId });
    }

    if (roleId) qb.andWhere('roles.id = :roleId', { roleId });
    if (search)
      qb.andWhere(this.buildSearchCondition('v'), { search: `%${search}%` });
    if (is_active !== undefined)
      qb.andWhere('v.is_active = :is_active', { is_active });
    if (min_car_seats !== undefined)
      qb.andWhere('v.car_seats >= :min_car_seats', { min_car_seats });
    if (available_slots?.length) {
      const parts = available_slots.map((s, i) => `v.${s} = :_av${i}`);
      const params = Object.fromEntries(
        available_slots.map((_, i) => [`_av${i}`, true]),
      );
      qb.andWhere(`(${parts.join(' AND ')})`, params);
    }

    const volunteers = await qb.orderBy('v.full_name', 'ASC').getMany();
    return this.buildVolunteersExcel(volunteers);
  }

  private buildVolunteersExcel(volunteers: Volunteer[]): Buffer {
    const headers = [
      'Número de identificación',
      'Nombre',
      'Email',
      'Teléfono',
      'Activo',
      'Región de participación',
      'Roles',
      'Plazas de coche disponibles',
      'Dirección',
      'Lat',
      'Lon',
      'Maps',
      'Lu M',
      'Lu T',
      'Ma M',
      'Ma T',
      'Mi M',
      'Mi T',
      'Ju M',
      'Ju T',
      'Vi M',
      'Vi T',
      'Sa M',
      'Sa T',
      'Do M',
      'Do T',
      'SaA M',
      'SaA T',
      'DoA M',
      'DoA T',
      'LuS M',
      'LuS T',
    ];

    const rows = volunteers.map((v) => [
      v.volunteer_code,
      v.full_name,
      v.email ?? '',
      v.phone ?? '',
      v.is_active ? 'Sí' : 'No',
      (v.regions ?? []).map((r) => r.name).join(', '),
      (v.roles ?? []).map((r) => r.name).join(', '),
      v.car_seats ?? '',
      v.hosting_address ?? '',
      v.lat ?? '',
      v.lng ?? '',
      v.maps_link ?? '',
      v.monday_morning ? 'Yes' : 'No',
      v.monday_afternoon ? 'Yes' : 'No',
      v.tuesday_morning ? 'Yes' : 'No',
      v.tuesday_afternoon ? 'Yes' : 'No',
      v.wednesday_morning ? 'Yes' : 'No',
      v.wednesday_afternoon ? 'Yes' : 'No',
      v.thursday_morning ? 'Yes' : 'No',
      v.thursday_afternoon ? 'Yes' : 'No',
      v.friday_morning ? 'Yes' : 'No',
      v.friday_afternoon ? 'Yes' : 'No',
      v.saturday_morning ? 'Yes' : 'No',
      v.saturday_afternoon ? 'Yes' : 'No',
      v.sunday_morning ? 'Yes' : 'No',
      v.sunday_afternoon ? 'Yes' : 'No',
      v.saturday_prev_morning ? 'Yes' : 'No',
      v.saturday_prev_afternoon ? 'Yes' : 'No',
      v.sunday_prev_morning ? 'Yes' : 'No',
      v.sunday_prev_afternoon ? 'Yes' : 'No',
      v.monday_next_morning ? 'Yes' : 'No',
      v.monday_next_afternoon ? 'Yes' : 'No',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Voluntarios');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertAccess(
    v: Volunteer,
    currentUser: JwtPayload,
  ): Promise<void> {
    if (currentUser.role === 'superadmin') return;
    if (v.user_id === currentUser.sub) return;
    const user = await this.usersRepo.findOne({
      where: { id: currentUser.sub },
      relations: { regions: true },
    });
    const adminIds = new Set((user?.regions ?? []).map((r) => r.id));
    const volunteerRegionIds = (v.regions ?? []).map((r) => r.id);
    if (volunteerRegionIds.some((id) => adminIds.has(id))) return;
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
    regions: (v.regions ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      event_start_date: r.event_start_date ?? null,
      event_end_date: r.event_end_date ?? null,
    })),
    hosting_address: v.hosting_address,
    lat: v.lat,
    lng: v.lng,
    maps_link: v.maps_link,
    car_seats: v.car_seats,
    monday_morning: v.monday_morning,
    monday_afternoon: v.monday_afternoon,
    tuesday_morning: v.tuesday_morning,
    tuesday_afternoon: v.tuesday_afternoon,
    wednesday_morning: v.wednesday_morning,
    wednesday_afternoon: v.wednesday_afternoon,
    thursday_morning: v.thursday_morning,
    thursday_afternoon: v.thursday_afternoon,
    friday_morning: v.friday_morning,
    friday_afternoon: v.friday_afternoon,
    saturday_morning: v.saturday_morning,
    saturday_afternoon: v.saturday_afternoon,
    sunday_morning: v.sunday_morning,
    sunday_afternoon: v.sunday_afternoon,
    saturday_prev_morning: v.saturday_prev_morning,
    saturday_prev_afternoon: v.saturday_prev_afternoon,
    sunday_prev_morning: v.sunday_prev_morning,
    sunday_prev_afternoon: v.sunday_prev_afternoon,
    monday_next_morning: v.monday_next_morning,
    monday_next_afternoon: v.monday_next_afternoon,
    terms_accepted: v.terms_accepted,
    terms_accepted_at: v.terms_accepted_at,
    terms_version: v.terms_version,
    created_at: v.created_at,
    updated_at: v.updated_at,
  });

  // ── Acceso público (formulario voluntario) ─────────────────────────────────

  async getPublicRegions(): Promise<{ id: string; name: string }[]> {
    const regions = await this.regionsRepo.find({ order: { name: 'ASC' } });
    return regions.map((r) => ({ id: r.id, name: r.name }));
  }

  async lookupByCode(code: string): Promise<VolunteerFormLookupResponseDto> {
    const normalized = code.trim().toUpperCase();
    const v = await this.volunteersRepo.findOne({
      where: { volunteer_code: normalized },
      relations: { regions: true },
    });
    if (!v) throw new NotFoundException('Código de voluntario no encontrado');

    return {
      volunteer_code: v.volunteer_code,
      full_name: v.full_name,
      email: v.email,
      phone: v.phone,
      car_seats: v.car_seats,
      hosting_address: v.hosting_address,
      lat: v.lat,
      lng: v.lng,
      maps_link: v.maps_link,
      monday_morning: v.monday_morning,
      monday_afternoon: v.monday_afternoon,
      tuesday_morning: v.tuesday_morning,
      tuesday_afternoon: v.tuesday_afternoon,
      wednesday_morning: v.wednesday_morning,
      wednesday_afternoon: v.wednesday_afternoon,
      thursday_morning: v.thursday_morning,
      thursday_afternoon: v.thursday_afternoon,
      friday_morning: v.friday_morning,
      friday_afternoon: v.friday_afternoon,
      saturday_morning: v.saturday_morning,
      saturday_afternoon: v.saturday_afternoon,
      sunday_morning: v.sunday_morning,
      sunday_afternoon: v.sunday_afternoon,
      saturday_prev_morning: v.saturday_prev_morning,
      saturday_prev_afternoon: v.saturday_prev_afternoon,
      sunday_prev_morning: v.sunday_prev_morning,
      sunday_prev_afternoon: v.sunday_prev_afternoon,
      monday_next_morning: v.monday_next_morning,
      monday_next_afternoon: v.monday_next_afternoon,
      regions: (v.regions ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        event_start_date: r.event_start_date ?? null,
        event_end_date: r.event_end_date ?? null,
      })),
      terms_accepted: v.terms_accepted,
      terms_accepted_at: v.terms_accepted_at,
    };
  }

  async submitForm(code: string, dto: VolunteerFormSubmitDto): Promise<void> {
    const normalized = code.trim().toUpperCase();
    const v = await this.volunteersRepo.findOne({
      where: { volunteer_code: normalized },
      relations: { regions: true },
    });
    if (!v) throw new NotFoundException('Código de voluntario no encontrado');

    const region = await this.regionsRepo.findOne({
      where: { id: dto.region_id },
    });
    if (!region) throw new NotFoundException('Región no encontrada');

    Object.assign(v, {
      email: dto.email,
      phone: dto.phone ?? null,
      hosting_address: dto.hosting_address ?? null,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      maps_link: dto.maps_link ?? null,
      car_seats: dto.car_seats,
      monday_morning: dto.monday_morning,
      monday_afternoon: dto.monday_afternoon,
      tuesday_morning: dto.tuesday_morning,
      tuesday_afternoon: dto.tuesday_afternoon,
      wednesday_morning: dto.wednesday_morning,
      wednesday_afternoon: dto.wednesday_afternoon,
      thursday_morning: dto.thursday_morning,
      thursday_afternoon: dto.thursday_afternoon,
      friday_morning: dto.friday_morning,
      friday_afternoon: dto.friday_afternoon,
      saturday_morning: dto.saturday_morning,
      saturday_afternoon: dto.saturday_afternoon,
      sunday_morning: dto.sunday_morning,
      sunday_afternoon: dto.sunday_afternoon,
      saturday_prev_morning: dto.saturday_prev_morning,
      saturday_prev_afternoon: dto.saturday_prev_afternoon,
      sunday_prev_morning: dto.sunday_prev_morning,
      sunday_prev_afternoon: dto.sunday_prev_afternoon,
      monday_next_morning: dto.monday_next_morning,
      monday_next_afternoon: dto.monday_next_afternoon,
      terms_accepted: dto.terms_accepted ?? null,
      terms_version: dto.terms_version ?? null,
      terms_accepted_at:
        dto.terms_accepted && !v.terms_accepted_at
          ? new Date().toISOString()
          : v.terms_accepted_at,
    });

    const alreadyInRegion = (v.regions ?? []).some(
      (r) => r.id === dto.region_id,
    );
    if (!alreadyInRegion) {
      v.regions = [...(v.regions ?? []), region];
    }

    await this.volunteersRepo.save(v);
  }

  // ── Volunteer-access token endpoints ──────────────────────────────────────

  private verifyVolunteerToken(token: string): string {
    try {
      const payload = this.jwtService.verify<{ sub: string; type: string }>(
        token,
      );
      if (payload.type !== VOLUNTEER_TOKEN_TYPE) throw new Error('wrong type');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  async getTokenByCode(code: string): Promise<VolunteerCodeTokenResponseDto> {
    const normalized = code.trim().toUpperCase();
    const v = await this.volunteersRepo.findOne({
      select: ['volunteer_code'],
      where: { volunteer_code: normalized },
    });
    if (!v) throw new NotFoundException('Código de voluntario no encontrado');

    const token = this.jwtService.sign(
      { sub: v.volunteer_code, type: VOLUNTEER_TOKEN_TYPE },
      { expiresIn: '365d' },
    );
    return { token };
  }

  async getVolunteerByToken(token: string): Promise<VolunteerResponseDto> {
    const volunteerCode = this.verifyVolunteerToken(token);
    const v = await this.volunteersRepo.findOne({
      where: { volunteer_code: volunteerCode },
      relations: { roles: true, regions: true },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');
    return this.toDto(v);
  }

  async getAvailabilityByToken(token: string): Promise<AvailabilityEntryDto[]> {
    const volunteerCode = this.verifyVolunteerToken(token);
    const v = await this.volunteersRepo.findOne({
      where: { volunteer_code: volunteerCode },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');

    const entries = await this.availRepo.find({
      where: { volunteer_id: v.id },
      order: { date: 'ASC' },
    });
    return entries.map((e) => ({
      date: e.date,
      region_id: e.region_id,
      note: e.note,
    }));
  }

  async setAvailabilityByToken(
    token: string,
    dto: SetAvailabilityDto,
  ): Promise<AvailabilityEntryDto[]> {
    const volunteerCode = this.verifyVolunteerToken(token);
    const v = await this.volunteersRepo.findOne({
      where: { volunteer_code: volunteerCode },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');

    await this.availRepo.delete({
      volunteer_id: v.id,
      region_id: dto.region_id,
    });

    if (dto.dates.length > 0) {
      const entries = dto.dates.map((date) =>
        this.availRepo.create({
          volunteer_id: v.id,
          region_id: dto.region_id,
          date,
          note: null,
        }),
      );
      await this.availRepo.save(entries);
    }

    const updated = await this.availRepo.find({
      where: { volunteer_id: v.id },
      order: { date: 'ASC' },
    });
    return updated.map((e) => ({
      date: e.date,
      region_id: e.region_id,
      note: e.note,
    }));
  }

  async getActivitiesByToken(token: string): Promise<VolunteerActivityDto[]> {
    const volunteerCode = this.verifyVolunteerToken(token);
    const v = await this.volunteersRepo.findOne({
      select: ['id'],
      where: { volunteer_code: volunteerCode },
    });
    if (!v) throw new NotFoundException('Voluntario no encontrado');

    const isSqlite = this.dataSource.options.type === 'better-sqlite3';
    const p1 = isSqlite ? '?' : '$1';

    const rows = await this.dataSource.query<
      Array<{
        id: string;
        region_id: string;
        name: string;
        icon: string | null;
        description: string | null;
        date: string;
        start_time: string;
        end_time: string;
        activity_locations: string | null;
        is_preaching_shift: boolean | number;
      }>
    >(
      `SELECT a.id, a.region_id, a.name, a.icon, a.description, a.date, a.start_time, a.end_time,
              a.activity_locations, a.is_preaching_shift
       FROM activities a
       INNER JOIN activity_volunteers av ON av."activitiesId" = a.id AND av."volunteersId" = ${p1}
       WHERE a.status = 'published'
       ORDER BY a.date ASC, a.start_time ASC`,
      [v.id],
    );

    const activityIds = rows.map((r) => r.id);
    const volunteerRows =
      activityIds.length > 0
        ? await this.dataSource.query<
            Array<{
              activity_id: string;
              full_name: string;
              phone: string | null;
              role_name: string | null;
            }>
          >(
            isSqlite
              ? `SELECT av."activitiesId" AS activity_id, vol.full_name, vol.phone, vr.name AS role_name
                 FROM activity_volunteers av
                 INNER JOIN volunteers vol ON vol.id = av."volunteersId"
                 LEFT JOIN activity_volunteer_roles avr ON avr.activity_id = av."activitiesId" AND avr.volunteer_id = av."volunteersId"
                 LEFT JOIN volunteer_roles vr ON vr.id = avr.role_id
                 WHERE av."activitiesId" IN (${activityIds.map(() => '?').join(',')})
                 ORDER BY vol.full_name ASC`
              : `SELECT av."activitiesId"::varchar AS activity_id, vol.full_name, vol.phone, vr.name AS role_name
                 FROM activity_volunteers av
                 INNER JOIN volunteers vol ON vol.id = av."volunteersId"
                 LEFT JOIN activity_volunteer_roles avr ON avr.activity_id = av."activitiesId"::varchar AND avr.volunteer_id = av."volunteersId"::varchar
                 LEFT JOIN volunteer_roles vr ON vr.id = avr.role_id
                 WHERE av."activitiesId"::varchar = ANY($1)
                 ORDER BY vol.full_name ASC`,
            isSqlite ? activityIds : [activityIds],
          )
        : [];

    const volunteersByActivity = new Map<
      string,
      { full_name: string; phone: string | null; role_name: string | null }[]
    >();
    for (const vr of volunteerRows) {
      const list = volunteersByActivity.get(vr.activity_id) ?? [];
      list.push({
        full_name: vr.full_name,
        phone: vr.phone,
        role_name: vr.role_name,
      });
      volunteersByActivity.set(vr.activity_id, list);
    }

    const preachingShiftIds = rows
      .filter((r) => Boolean(r.is_preaching_shift))
      .map((r) => r.id);
    const preachingGroupByActivity = await this.getVolunteerPreachingGroups(
      v.id,
      preachingShiftIds,
      isSqlite,
    );

    return rows.map((r) => ({
      id: r.id,
      region_id: r.region_id,
      name: r.name,
      icon: r.icon,
      description: r.description,
      date: r.date,
      start_time: r.start_time,
      end_time: r.end_time,
      activity_locations: r.activity_locations
        ? (JSON.parse(r.activity_locations) as LocationPoint[])
        : null,
      is_preaching_shift: Boolean(r.is_preaching_shift),
      volunteers: volunteersByActivity.get(r.id) ?? [],
      preaching_group: preachingGroupByActivity.get(r.id) ?? null,
    }));
  }

  /**
   * For preaching-shift activities, finds the preaching group the volunteer
   * belongs to in each one, along with its members and assigned guest groups.
   */
  private async getVolunteerPreachingGroups(
    volunteerId: string,
    activityIds: string[],
    isSqlite: boolean,
  ): Promise<Map<string, VolunteerPreachingGroupDto>> {
    const result = new Map<string, VolunteerPreachingGroupDto>();
    if (activityIds.length === 0) return result;

    const activityFilter = this.buildIdFilter(
      'apg.activity_id',
      activityIds,
      isSqlite,
      2,
    );
    const membership = await this.dataSource.query<
      Array<{
        group_id: string;
        activity_id: string;
        group_name: string | null;
        my_description: string | null;
      }>
    >(
      `SELECT apg.id AS group_id, apg.activity_id, apg.name AS group_name, apgv.description AS my_description
       FROM activity_preaching_group_volunteers apgv
       INNER JOIN activity_preaching_groups apg ON apg.id = apgv.preaching_group_id
       WHERE apgv.volunteer_id = ${isSqlite ? '?' : '$1'} AND ${activityFilter.clause}`,
      isSqlite ? [volunteerId, ...activityIds] : [volunteerId, activityIds],
    );
    if (membership.length === 0) return result;

    const groupIds = membership.map((m) => m.group_id);

    const groupFilter = this.buildIdFilter(
      'apgv.preaching_group_id',
      groupIds,
      isSqlite,
      1,
    );
    const memberRows = await this.dataSource.query<
      Array<{
        group_id: string;
        full_name: string;
        phone: string | null;
        role_name: string | null;
        description: string | null;
      }>
    >(
      `SELECT apgv.preaching_group_id AS group_id, vol.full_name, vol.phone, vr.name AS role_name, apgv.description
       FROM activity_preaching_group_volunteers apgv
       INNER JOIN activity_preaching_groups apg ON apg.id = apgv.preaching_group_id
       INNER JOIN volunteers vol ON vol.id = apgv.volunteer_id
       LEFT JOIN activity_volunteer_roles avr ON avr.activity_id = apg.activity_id AND avr.volunteer_id = apgv.volunteer_id
       LEFT JOIN volunteer_roles vr ON vr.id = avr.role_id
       WHERE ${groupFilter.clause}
       ORDER BY vol.full_name ASC`,
      groupFilter.params,
    );

    const guestGroupFilter = this.buildIdFilter(
      'apggg."preachingGroupId"',
      groupIds,
      isSqlite,
      1,
    );
    const guestGroupRows = await this.dataSource.query<
      Array<{ group_id: string; guest_group_id: string; group_code: string }>
    >(
      `SELECT apggg."preachingGroupId" AS group_id, gg.id AS guest_group_id, gg.group_code
       FROM activity_preaching_group_guest_groups apggg
       INNER JOIN guest_groups gg ON gg.id = apggg."guestGroupId"
       WHERE ${guestGroupFilter.clause}
       ORDER BY gg.group_code ASC`,
      guestGroupFilter.params,
    );

    const guestGroupIds = [
      ...new Set(guestGroupRows.map((g) => g.guest_group_id)),
    ];
    const guestFilter = this.buildIdFilter(
      'g.group_id',
      guestGroupIds,
      isSqlite,
      1,
    );
    const guestRows = guestGroupIds.length
      ? await this.dataSource.query<
          Array<{
            group_id: string;
            full_name: string;
            is_minor: boolean | number;
            is_group_contact: boolean | number;
          }>
        >(
          `SELECT g.group_id, g.full_name, g.is_minor, g.is_group_contact
           FROM guests g
           WHERE ${guestFilter.clause}
           ORDER BY g.is_group_contact DESC, g.full_name ASC`,
          guestFilter.params,
        )
      : [];

    const guestsByGroup = new Map<string, VolunteerPreachingGroupGuestDto[]>();
    for (const g of guestRows) {
      const list = guestsByGroup.get(g.group_id) ?? [];
      list.push({
        full_name: g.full_name,
        is_minor: Boolean(g.is_minor),
        is_group_contact: Boolean(g.is_group_contact),
      });
      guestsByGroup.set(g.group_id, list);
    }

    const guestGroupsByPreachingGroup = new Map<
      string,
      VolunteerPreachingGroupGuestGroupDto[]
    >();
    for (const gg of guestGroupRows) {
      const guests = guestsByGroup.get(gg.guest_group_id) ?? [];
      const list = guestGroupsByPreachingGroup.get(gg.group_id) ?? [];
      list.push({
        group_code: gg.group_code,
        guest_count: guests.length,
        guests,
      });
      guestGroupsByPreachingGroup.set(gg.group_id, list);
    }

    const membersByGroup = new Map<
      string,
      VolunteerPreachingGroupVolunteerDto[]
    >();
    for (const m of memberRows) {
      const list = membersByGroup.get(m.group_id) ?? [];
      list.push({
        full_name: m.full_name,
        phone: m.phone,
        role_name: m.role_name,
        description: m.description,
      });
      membersByGroup.set(m.group_id, list);
    }

    for (const m of membership) {
      result.set(m.activity_id, {
        name: m.group_name,
        description: m.my_description,
        volunteers: membersByGroup.get(m.group_id) ?? [],
        guest_groups: guestGroupsByPreachingGroup.get(m.group_id) ?? [],
      });
    }

    return result;
  }

  private buildIdFilter(
    column: string,
    ids: string[],
    isSqlite: boolean,
    paramIndex: number,
  ): { clause: string; params: unknown[] } {
    if (isSqlite) {
      return {
        clause: `${column} IN (${ids.map(() => '?').join(',')})`,
        params: ids,
      };
    }
    return { clause: `${column} = ANY($${paramIndex})`, params: [ids] };
  }

  private str(val: unknown): string | null {
    if (val === null || val === undefined || val === '') return null;
    return String(val).trim() || null;
  }

  private parseNum(val: unknown): number | null {
    const s = this.str(val);
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  private parseCoord(val: unknown): number | null {
    const s = this.str(val);
    if (!s) return null;
    const n = parseFloat(s.replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  private parseBool(val: unknown): boolean {
    const s = this.str(val);
    if (!s) return false;
    const lower = s.toLowerCase();
    return lower === 'sí' || lower === 'si' || s === '1' || lower === 'true';
  }
}
