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
import { VolunteerFormLookupResponseDto } from './dto/volunteer-form-lookup.dto';
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
  ) {}

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
    if (
      currentUser.role !== 'superadmin' &&
      currentUser.role !== 'region_admin'
    ) {
      throw new ForbiddenException();
    }
    const {
      regionId,
      roleId,
      search,
      is_active,
      date,
      min_car_seats,
      available_slots,
      page = 1,
      limit = 50,
    } = query;

    const qb = this.volunteersRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.roles', 'roles')
      .leftJoinAndSelect('v.regions', 'regions');

    let effectiveRegionId: string | null = null;

    if (currentUser.role === 'region_admin') {
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
      qb.andWhere('v.full_name LIKE :search OR v.volunteer_code LIKE :search', {
        search: `%${search}%`,
      });
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
      qb.andWhere(`(${parts.join(' OR ')})`, params);
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

    // Starting index for auto-generated codes (avoids collisions with previous imports)
    const sinCodCount = await this.volunteersRepo
      .createQueryBuilder('v')
      .where("v.volunteer_code LIKE 'SIN-COD-%'")
      .getCount();
    let sinCodIndex = sinCodCount + 1;

    const to_create: ImportVolunteerRowDto[] = [];
    const skipped: string[] = [];

    for (const row of rows) {
      const rawCode = this.str(row['Número de identificación']);
      const code =
        rawCode ?? `SIN-COD-${String(sinCodIndex++).padStart(4, '0')}`;
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
      });
    }

    return {
      to_create,
      skipped,
      summary: {
        total: to_create.length + skipped.length,
        to_create: to_create.length,
        skipped: skipped.length,
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
      'Sexo',
      'Estado civil',
      'Congregación',
      'Sucursal',
      'Tiene asignado un turno',
      'Grupos',
      'Horas asignadas',
      'Plazas de coche disponibles',
      'Dirección',
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
      'Maps',
      'Lat',
      'Lon',
      'Región de participación',
      'Email',
    ];
    const example = [
      '5274026',
      'Martínez, Mario',
      'Varón',
      'Casado',
      'Olot',
      'Cataluña',
      'No',
      'grupo1',
      '0',
      '3',
      'Passatge Bernat Metge, 14, 17800 Olot',
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
      'https://www.google.com/maps?q=42.18,2.47',
      '42,1836987',
      '2,4774935',
      'Costa Brava',
      'mario@example.com',
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

    if (currentUser.role === 'region_admin') {
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
    } else if (currentUser.role === 'superadmin') {
      if (regionId) qb.where('regions.id = :regionId', { regionId });
    } else {
      throw new ForbiddenException();
    }

    if (roleId) qb.andWhere('roles.id = :roleId', { roleId });
    if (search)
      qb.andWhere('v.full_name LIKE :search OR v.volunteer_code LIKE :search', {
        search: `%${search}%`,
      });
    if (is_active !== undefined)
      qb.andWhere('v.is_active = :is_active', { is_active });
    if (min_car_seats !== undefined)
      qb.andWhere('v.car_seats >= :min_car_seats', { min_car_seats });
    if (available_slots?.length) {
      const parts = available_slots.map((s, i) => `v.${s} = :_av${i}`);
      const params = Object.fromEntries(
        available_slots.map((_, i) => [`_av${i}`, true]),
      );
      qb.andWhere(`(${parts.join(' OR ')})`, params);
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
      regions: (v.regions ?? []).map((r) => ({ id: r.id, name: r.name })),
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
