import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Activity } from '../activities/entities/activity.entity';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Host } from '../hosts/entities/host.entity';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import { CreateGuestDto } from './dto/create-guest.dto';
import { GuestActivityResponseDto } from './dto/guest-activity-response.dto';
import { GuestFormLookupResponseDto } from './dto/guest-form-lookup.dto';
import { GuestFormSubmitDto } from './dto/guest-form-submit.dto';
import { GuestListQueryDto } from './dto/guest-list-query.dto';
import {
  GuestMeResponseDto,
  GuestTokenResponseDto,
} from './dto/guest-me-response.dto';
import { GuestResponseDto } from './dto/guest-response.dto';
import {
  ImportCommitDto,
  ImportCommitResponseDto,
} from './dto/import-commit.dto';
import {
  ImportErrorDto,
  ImportGuestRowDto,
  ImportParseResponseDto,
} from './dto/import-parse-response.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { Guest } from './entities/guest.entity';

const GUEST_TOKEN_TYPE = 'guest_access';

const TRANSPORT_VALUES = [
  'car',
  'bus',
  'train',
  'plane',
  'ferry',
  'motorbike',
  'other',
];
const STATUS_VALUES = [
  'pending',
  'confirmed',
  'cancelled',
  'arrived',
  'blocked',
];

const EXCEL_COLUMNS: Record<string, keyof ImportGuestRowDto> = {
  guest_code: 'guest_code',
  group_code: 'group_code',
  full_name: 'full_name',
  is_minor: 'is_minor',
  status: 'status',
  branch: 'branch',
  is_group_contact: 'is_group_contact',
  native_language: 'native_language',
  other_languages: 'other_languages',
  speaks_english: 'speaks_english',
  is_special_servant: 'is_special_servant',
  origin_city: 'origin_city',
  email: 'email',
  available_from: 'available_from',
  available_to: 'available_to',
  arrival_transport: 'arrival_transport',
  arrival_other_transport: 'arrival_other_transport',
  arrival_date: 'arrival_date',
  arrival_time: 'arrival_time',
  arrival_place: 'arrival_place',
  arrival_airport: 'arrival_airport',
  arrival_airline: 'arrival_airline',
  arrival_flight: 'arrival_flight',
  real_arrival: 'real_arrival',
  real_arrival_time: 'real_arrival_time',
  needs_airport_transfer: 'needs_airport_transfer',
  departure_transport: 'departure_transport',
  departure_other_transport: 'departure_other_transport',
  departure_date: 'departure_date',
  departure_time: 'departure_time',
  departure_place: 'departure_place',
  departure_airport: 'departure_airport',
  departure_airline: 'departure_airline',
  departure_flight: 'departure_flight',
  real_departure: 'real_departure',
  real_departure_time: 'real_departure_time',
  accommodation: 'accommodation',
  checkin_date: 'checkin_date',
  checkout_date: 'checkout_date',
  needs_special_accommodation: 'needs_special_accommodation',
  hosting_address: 'hosting_address',
  maps_link: 'maps_link',
  lat: 'lat',
  lng: 'lng',
  transport_mode: 'transport_mode',
  car_seats: 'car_seats',
};

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(Guest)
    private readonly guestsRepository: Repository<Guest>,
    @InjectRepository(GuestGroup)
    private readonly groupsRepository: Repository<GuestGroup>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Region)
    private readonly regionsRepository: Repository<Region>,
    @InjectRepository(Host)
    private readonly hostsRepository: Repository<Host>,
    @InjectRepository(Activity)
    private readonly activitiesRepository: Repository<Activity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async create(
    dto: CreateGuestDto,
    currentUser: JwtPayload,
  ): Promise<GuestResponseDto> {
    await this.assertRegionAccess(dto.region_id, currentUser);

    const exists = await this.guestsRepository.findOne({
      where: { guest_code: dto.guest_code },
    });
    if (exists) throw new ConflictException('El código de invitado ya existe');

    const group = await this.groupsRepository.findOne({
      where: { id: dto.group_id },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    if (group.region_id !== dto.region_id) {
      throw new BadRequestException(
        'El grupo no pertenece a la región indicada',
      );
    }

    const guest = this.guestsRepository.create(dto);
    const saved = await this.guestsRepository.save(guest);
    return this.toDto(saved);
  }

  async findAll(
    query: GuestListQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    data: GuestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      regionId,
      groupId,
      status,
      search,
      termsAccepted,
      page = 1,
      limit = 50,
    } = query;

    const qb = this.guestsRepository.createQueryBuilder('g');

    if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const adminRegionIds = (user?.regions ?? []).map((r) => r.id);
      if (adminRegionIds.length === 0)
        return { data: [], total: 0, page, limit };

      if (regionId && adminRegionIds.includes(regionId)) {
        qb.where('g.region_id = :regionId', { regionId });
      } else if (regionId) {
        throw new ForbiddenException();
      } else {
        qb.where('g.region_id IN (:...adminRegionIds)', { adminRegionIds });
      }
    } else if (regionId) {
      qb.where('g.region_id = :regionId', { regionId });
    }

    if (groupId) qb.andWhere('g.group_id = :groupId', { groupId });
    if (status) qb.andWhere('g.status = :status', { status });
    if (search) {
      qb.andWhere('(g.full_name LIKE :search OR g.guest_code LIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (termsAccepted !== undefined) {
      qb.andWhere('g.terms_accepted = :termsAccepted', { termsAccepted });
    }

    const total = await qb.getCount();
    const guests = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('g.full_name', 'ASC')
      .getMany();

    return { data: guests.map(this.toDto), total, page, limit };
  }

  async findOne(
    id: string,
    currentUser: JwtPayload,
  ): Promise<GuestResponseDto> {
    const guest = await this.guestsRepository.findOne({ where: { id } });
    if (!guest) throw new NotFoundException('Invitado no encontrado');
    await this.assertRegionAccess(guest.region_id, currentUser);
    return this.toDto(guest);
  }

  async update(
    id: string,
    dto: UpdateGuestDto,
    currentUser: JwtPayload,
  ): Promise<GuestResponseDto> {
    const guest = await this.guestsRepository.findOne({ where: { id } });
    if (!guest) throw new NotFoundException('Invitado no encontrado');
    await this.assertRegionAccess(guest.region_id, currentUser);

    if (dto.guest_code && dto.guest_code !== guest.guest_code) {
      const exists = await this.guestsRepository.findOne({
        where: { guest_code: dto.guest_code },
      });
      if (exists)
        throw new ConflictException('El código de invitado ya existe');
    }

    Object.assign(guest, dto);
    const saved = await this.guestsRepository.save(guest);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const guest = await this.guestsRepository.findOne({ where: { id } });
    if (!guest) throw new NotFoundException('Invitado no encontrado');
    await this.guestsRepository.remove(guest);
  }

  async migrate(
    id: string,
    targetGroupId: string,
    currentUser: JwtPayload,
  ): Promise<GuestResponseDto> {
    const guest = await this.guestsRepository.findOne({ where: { id } });
    if (!guest) throw new NotFoundException('Invitado no encontrado');
    await this.assertRegionAccess(guest.region_id, currentUser);

    const targetGroup = await this.groupsRepository.findOne({
      where: { id: targetGroupId },
    });
    if (!targetGroup)
      throw new NotFoundException('Grupo de destino no encontrado');
    if (targetGroup.region_id !== guest.region_id) {
      throw new BadRequestException(
        'La migración entre regiones no está permitida',
      );
    }

    if (guest.is_group_contact) {
      guest.is_group_contact = false;
    }

    guest.group_id = targetGroupId;
    const saved = await this.guestsRepository.save(guest);
    return this.toDto(saved);
  }

  parseExcel(buffer: Buffer, regionId?: string): ImportParseResponseDto {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: false,
      defval: null,
    });

    const valid: ImportGuestRowDto[] = [];
    const errors: ImportErrorDto[] = [];
    const seenCodes = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const rowErrors: string[] = [];

      const guest_code = this.normalizeCode(
        this.parseString(row['guest_code']),
      );
      const group_code = this.normalizeCode(
        this.parseString(row['group_code']),
      );
      const full_name = this.parseString(row['full_name']);

      if (!guest_code) rowErrors.push('guest_code es obligatorio');
      if (!group_code) rowErrors.push('group_code es obligatorio');
      if (!full_name) rowErrors.push('full_name es obligatorio');

      if (guest_code && seenCodes.has(guest_code)) {
        rowErrors.push('guest_code duplicado en el archivo');
      }

      const status = this.parseString(row['status']);
      if (status && !STATUS_VALUES.includes(status)) {
        rowErrors.push(`status inválido: ${status}`);
      }

      const arrival_transport = this.parseString(row['arrival_transport']);
      if (arrival_transport && !TRANSPORT_VALUES.includes(arrival_transport)) {
        rowErrors.push(`arrival_transport inválido: ${arrival_transport}`);
      }

      const departure_transport = this.parseString(row['departure_transport']);
      if (
        departure_transport &&
        !TRANSPORT_VALUES.includes(departure_transport)
      ) {
        rowErrors.push(`departure_transport inválido: ${departure_transport}`);
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNum,
          guest_code: guest_code ?? '',
          reason: rowErrors.join('; '),
        });
        continue;
      }

      if (guest_code) seenCodes.add(guest_code);

      const other_languages_raw = this.parseString(row['other_languages']);

      valid.push({
        guest_code: guest_code!,
        group_code: group_code!,
        full_name: full_name!,
        is_minor: this.parseBool(row['is_minor']),
        status: (status as ImportGuestRowDto['status']) || 'pending',
        branch: this.parseString(row['branch']),
        is_group_contact: this.parseBool(row['is_group_contact']),
        native_language: this.parseString(row['native_language']),
        other_languages: other_languages_raw
          ? other_languages_raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        speaks_english: this.parseBool(row['speaks_english']),
        is_special_servant: this.parseBool(row['is_special_servant']),
        origin_city: this.parseString(row['origin_city']),
        email: this.parseString(row['email']),
        available_from: this.parseString(row['available_from']),
        available_to: this.parseString(row['available_to']),
        arrival_transport: this.parseString(row['arrival_transport']),
        arrival_other_transport: this.parseString(
          row['arrival_other_transport'],
        ),
        arrival_date: this.parseString(row['arrival_date']),
        arrival_time: this.parseString(row['arrival_time']),
        arrival_place: this.parseString(row['arrival_place']),
        arrival_airport: this.parseString(row['arrival_airport']),
        arrival_airline: this.parseString(row['arrival_airline']),
        arrival_flight: this.parseString(row['arrival_flight']),
        real_arrival: this.parseString(row['real_arrival']),
        real_arrival_time: this.parseString(row['real_arrival_time']),
        needs_airport_transfer: this.parseBool(row['needs_airport_transfer']),
        departure_transport: this.parseString(row['departure_transport']),
        departure_other_transport: this.parseString(
          row['departure_other_transport'],
        ),
        departure_date: this.parseString(row['departure_date']),
        departure_time: this.parseString(row['departure_time']),
        departure_place: this.parseString(row['departure_place']),
        departure_airport: this.parseString(row['departure_airport']),
        departure_airline: this.parseString(row['departure_airline']),
        departure_flight: this.parseString(row['departure_flight']),
        real_departure: this.parseString(row['real_departure']),
        real_departure_time: this.parseString(row['real_departure_time']),
        accommodation: this.parseString(row['accommodation']),
        checkin_date: this.parseString(row['checkin_date']),
        checkout_date: this.parseString(row['checkout_date']),
        needs_special_accommodation: this.parseBool(
          row['needs_special_accommodation'],
        ),
        hosting_address: this.parseString(row['hosting_address']),
        maps_link: this.parseString(row['maps_link']),
        lat: this.parseFloat(row['lat']),
        lng: this.parseFloat(row['lng']),
        transport_mode: this.parseString(row['transport_mode']),
        car_seats: this.parseInt(row['car_seats']),
      });
    }

    return {
      valid,
      errors,
      duplicates: [],
      duplicateRows: [],
      summary: {
        total: rows.length,
        valid: valid.length,
        errors: errors.length,
        duplicates: 0,
      },
    };
  }

  async parseWithDuplicates(
    buffer: Buffer,
    regionId?: string,
  ): Promise<ImportParseResponseDto> {
    const preview = this.parseExcel(buffer, regionId);

    if (preview.valid.length > 0) {
      const codes = preview.valid.map((r) => r.guest_code);
      const existing = await this.guestsRepository.find({
        where: { guest_code: In(codes) },
        select: { guest_code: true },
      });
      const existingCodes = new Set(existing.map((g) => g.guest_code));

      const duplicateRows = preview.valid.filter((r) =>
        existingCodes.has(r.guest_code),
      );
      preview.duplicates = duplicateRows.map((r) => r.guest_code);
      preview.duplicateRows = duplicateRows;
      preview.valid = preview.valid.filter(
        (r) => !existingCodes.has(r.guest_code),
      );

      preview.summary.duplicates = preview.duplicates.length;
      preview.summary.valid = preview.valid.length;
    }

    return preview;
  }

  async commitImport(
    dto: ImportCommitDto,
    currentUser: JwtPayload,
  ): Promise<ImportCommitResponseDto> {
    const groupCache = new Map<string, GuestGroup>();
    let createdGroups = 0;
    let createdGuests = 0;
    let updatedGuests = 0;
    let groupsNotFound = 0;
    const notFoundRows: ImportGuestRowDto[] = [];

    if (dto.regionId) {
      // ── Mode A: fixed region ──────────────────────────────────────────────
      await this.assertRegionAccess(dto.regionId, currentUser);
      const region = await this.regionsRepository.findOne({
        where: { id: dto.regionId },
      });
      if (!region) throw new NotFoundException('Región no encontrada');

      for (const row of dto.rows) {
        let group = groupCache.get(row.group_code);
        if (!group) {
          const found = await this.groupsRepository.findOne({
            where: { group_code: row.group_code },
          });
          group =
            found ??
            (await this.groupsRepository.save(
              this.groupsRepository.create({
                group_code: row.group_code,
                region_id: dto.regionId,
              }),
            ));
          if (!found) createdGroups++;
          groupCache.set(row.group_code, group);
        }

        const exists = await this.guestsRepository.findOne({
          where: { guest_code: row.guest_code },
        });
        if (exists) continue;

        await this.guestsRepository.save(
          this.guestsRepository.create({
            ...this.rowToGuestFields(row),
            group_id: group.id,
            region_id: dto.regionId,
          }),
        );
        createdGuests++;
      }
    } else {
      // ── Mode B: derive region from group ─────────────────────────────────
      for (const row of dto.rows) {
        let group = groupCache.get(row.group_code);
        if (!group) {
          const found = await this.groupsRepository.findOne({
            where: { group_code: row.group_code },
          });
          if (!found) {
            groupsNotFound++;
            notFoundRows.push(row);
            continue;
          }
          if (!(await this.hasRegionAccess(found.region_id, currentUser)))
            continue;
          group = found;
          groupCache.set(row.group_code, group);
        }

        const exists = await this.guestsRepository.findOne({
          where: { guest_code: row.guest_code },
        });
        if (exists) continue;

        await this.guestsRepository.save(
          this.guestsRepository.create({
            ...this.rowToGuestFields(row),
            group_id: group.id,
            region_id: group.region_id,
          }),
        );
        createdGuests++;
      }
    }

    // ── Updates (updateRows) ──────────────────────────────────────────────
    for (const row of dto.updateRows ?? []) {
      const guest = await this.guestsRepository.findOne({
        where: { guest_code: row.guest_code },
      });
      if (!guest) continue;
      if (!(await this.hasRegionAccess(guest.region_id, currentUser))) continue;

      // Resolve new group if group_code changed, within the same region
      let newGroupId = guest.group_id;
      if (row.group_code) {
        let group = groupCache.get(row.group_code);
        if (!group) {
          const found = await this.groupsRepository.findOne({
            where: { group_code: row.group_code },
          });
          if (found && found.region_id === guest.region_id) {
            group = found;
            groupCache.set(row.group_code, group);
          }
        }
        if (group) newGroupId = group.id;
      }

      Object.assign(guest, this.rowToGuestFields(row), {
        group_id: newGroupId,
      });
      await this.guestsRepository.save(guest);
      updatedGuests++;
    }

    return {
      created_guests: createdGuests,
      updated_guests: updatedGuests,
      created_groups: createdGroups,
      total: dto.rows.length + (dto.updateRows?.length ?? 0),
      ...(dto.regionId
        ? {}
        : {
            groups_not_found: groupsNotFound,
            groups_not_found_rows: notFoundRows,
          }),
    };
  }

  private rowToGuestFields(row: ImportGuestRowDto) {
    return {
      guest_code: row.guest_code,
      full_name: row.full_name,
      is_minor: row.is_minor ?? false,
      status: (row.status as Guest['status']) ?? 'pending',
      branch: row.branch ?? null,
      is_group_contact: row.is_group_contact ?? false,
      native_language: row.native_language ?? null,
      other_languages: row.other_languages ?? null,
      speaks_english: row.speaks_english ?? false,
      is_special_servant: row.is_special_servant ?? false,
      origin_city: row.origin_city ?? null,
      email: row.email ?? null,
      available_from: row.available_from ?? null,
      available_to: row.available_to ?? null,
      arrival_transport:
        (row.arrival_transport as Guest['arrival_transport']) ?? null,
      arrival_other_transport: row.arrival_other_transport ?? null,
      arrival_date: row.arrival_date ?? null,
      arrival_time: row.arrival_time ?? null,
      arrival_place: row.arrival_place ?? null,
      arrival_airport: row.arrival_airport ?? null,
      arrival_airline: row.arrival_airline ?? null,
      arrival_flight: row.arrival_flight ?? null,
      real_arrival: row.real_arrival ?? null,
      real_arrival_time: row.real_arrival_time ?? null,
      needs_airport_transfer: row.needs_airport_transfer ?? false,
      departure_transport:
        (row.departure_transport as Guest['departure_transport']) ?? null,
      departure_other_transport: row.departure_other_transport ?? null,
      departure_date: row.departure_date ?? null,
      departure_time: row.departure_time ?? null,
      departure_place: row.departure_place ?? null,
      departure_airport: row.departure_airport ?? null,
      departure_airline: row.departure_airline ?? null,
      departure_flight: row.departure_flight ?? null,
      real_departure: row.real_departure ?? null,
      real_departure_time: row.real_departure_time ?? null,
      accommodation: row.accommodation ?? null,
      checkin_date: row.checkin_date ?? null,
      checkout_date: row.checkout_date ?? null,
      needs_special_accommodation: row.needs_special_accommodation ?? false,
      hosting_address: row.hosting_address ?? null,
      maps_link: row.maps_link ?? null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      transport_mode: row.transport_mode ?? null,
      car_seats: row.car_seats ?? null,
    };
  }

  async generateAccessToken(
    guestId: string,
    currentUser: JwtPayload,
  ): Promise<GuestTokenResponseDto> {
    const guest = await this.guestsRepository.findOne({
      where: { id: guestId },
    });
    if (!guest) throw new NotFoundException('Invitado no encontrado');
    await this.assertRegionAccess(guest.region_id, currentUser);

    const token = this.jwtService.sign(
      { sub: guest.guest_code, type: GUEST_TOKEN_TYPE },
      { expiresIn: '365d' },
    );
    const clientUrl = this.config.get<string>(
      'CLIENT_URL',
      'http://localhost:4300',
    );
    return { token, access_url: `${clientUrl}/access?token=${token}` };
  }

  async getByToken(token: string): Promise<GuestMeResponseDto> {
    let guestCode: string;
    try {
      const payload = this.jwtService.verify<{ sub: string; type: string }>(
        token,
      );
      if (payload.type !== GUEST_TOKEN_TYPE) throw new Error('wrong type');
      guestCode = payload.sub;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const guest = await this.guestsRepository.findOne({
      where: { guest_code: guestCode },
    });
    if (!guest) throw new NotFoundException('Invitado no encontrado');

    const [region, group] = await Promise.all([
      this.regionsRepository.findOne({ where: { id: guest.region_id } }),
      guest.group_id
        ? this.groupsRepository.findOne({ where: { id: guest.group_id } })
        : null,
    ]);

    let host: Host | null = null;
    if (group?.host_id) {
      host = await this.hostsRepository.findOne({
        where: { id: group.host_id },
      });
    }

    const dto = new GuestMeResponseDto();
    Object.assign(dto, this.toDto(guest));
    dto.group_code = group?.group_code ?? null;
    dto.region = {
      id: region?.id ?? guest.region_id,
      name: region?.name ?? '',
      event_start_date: region?.event_start_date ?? null,
      event_end_date: region?.event_end_date ?? null,
    };
    dto.host = host
      ? {
          id: host.id,
          name: host.name,
          address: host.address,
          lat: host.lat,
          lng: host.lng,
          weekday_meeting_day: host.weekday_meeting_day,
          weekday_meeting_time: host.weekday_meeting_time,
          weekend_meeting_day: host.weekend_meeting_day,
          weekend_meeting_time: host.weekend_meeting_time,
        }
      : null;
    return dto;
  }

  async getActivitiesByToken(
    token: string,
  ): Promise<GuestActivityResponseDto[]> {
    let guestCode: string;
    try {
      const payload = this.jwtService.verify<{ sub: string; type: string }>(
        token,
      );
      if (payload.type !== GUEST_TOKEN_TYPE) throw new Error('wrong type');
      guestCode = payload.sub;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const guest = await this.guestsRepository.findOne({
      where: { guest_code: guestCode },
    });
    if (!guest) throw new NotFoundException('Invitado no encontrado');
    if (!guest.group_id) return [];

    const activities = await this.activitiesRepository
      .createQueryBuilder('a')
      .innerJoin('a.guestGroups', 'gg', 'gg.id = :groupId', {
        groupId: guest.group_id,
      })
      .leftJoinAndSelect('a.volunteers', 'v')
      .where('a.status = :status', { status: 'published' })
      .orderBy('a.date', 'ASC')
      .addOrderBy('a.start_time', 'ASC')
      .getMany();

    return activities.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      description: a.description,
      date: a.date,
      start_time: a.start_time,
      end_time: a.end_time,
      activity_locations: a.activity_locations ?? null,
      is_preaching_shift: a.is_preaching_shift,
      volunteers: (a.volunteers ?? []).map((v) => ({
        full_name: v.full_name,
        phone: v.phone,
        email: v.email,
      })),
    }));
  }

  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const headers = Object.keys(EXCEL_COLUMNS);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, 'Invitados');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportAll(
    query: GuestListQueryDto,
    currentUser: JwtPayload,
  ): Promise<Buffer> {
    const { regionId, groupId, status, search, termsAccepted } = query;

    const qb = this.guestsRepository.createQueryBuilder('g');

    if (currentUser.role !== 'superadmin') {
      const user = await this.usersRepository.findOne({
        where: { id: currentUser.sub },
        relations: { regions: true },
      });
      const adminRegionIds = (user?.regions ?? []).map((r) => r.id);
      if (adminRegionIds.length === 0) return this.buildGuestsExcel([]);
      if (regionId && adminRegionIds.includes(regionId)) {
        qb.where('g.region_id = :regionId', { regionId });
      } else {
        qb.where('g.region_id IN (:...adminRegionIds)', { adminRegionIds });
      }
    } else {
      if (regionId) qb.where('g.region_id = :regionId', { regionId });
    }

    if (groupId) qb.andWhere('g.group_id = :groupId', { groupId });
    if (status) qb.andWhere('g.status = :status', { status });
    if (search) {
      qb.andWhere('(g.full_name LIKE :search OR g.guest_code LIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (termsAccepted !== undefined) {
      qb.andWhere('g.terms_accepted = :termsAccepted', { termsAccepted });
    }

    const guests = await qb.orderBy('g.full_name', 'ASC').getMany();

    const regions = await this.regionsRepository.find({
      select: ['id', 'name'],
    });
    const groups = await this.groupsRepository.find({
      select: ['id', 'group_code'],
    });
    const regionMap = new Map(regions.map((r) => [r.id, r.name]));
    const groupMap = new Map(groups.map((g) => [g.id, g.group_code]));

    return this.buildGuestsExcel(guests, regionMap, groupMap);
  }

  private buildGuestsExcel(
    guests: import('./entities/guest.entity').Guest[],
    regionMap = new Map<string, string>(),
    groupMap = new Map<string, string>(),
  ): Buffer {
    const headers = [
      'guest_code',
      'full_name',
      'email',
      'origin_city',
      'group_code',
      'region_name',
      'status',
      'speaks_english',
      'other_languages',
      'transport_mode',
      'arrival_flight',
      'needs_airport_transfer',
      'real_arrival',
      'real_arrival_time',
      'real_departure',
      'real_departure_time',
      'hosting_address',
      'lat',
      'lng',
      'is_minor',
      'branch',
      'native_language',
    ];
    const rows = guests.map((g) => [
      g.guest_code,
      g.full_name,
      g.email ?? '',
      g.origin_city ?? '',
      groupMap.get(g.group_id) ?? '',
      regionMap.get(g.region_id) ?? '',
      g.status,
      g.speaks_english ? 'Sí' : 'No',
      (g.other_languages ?? []).join(', '),
      g.transport_mode ?? '',
      g.arrival_flight ?? '',
      g.needs_airport_transfer ? 'Sí' : 'No',
      g.real_arrival ?? '',
      g.real_arrival_time ?? '',
      g.real_departure ?? '',
      g.real_departure_time ?? '',
      g.hosting_address ?? '',
      g.lat ?? '',
      g.lng ?? '',
      g.is_minor ? 'Sí' : 'No',
      g.branch ?? '',
      g.native_language ?? '',
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 28 },
      { wch: 18 },
      { wch: 12 },
      { wch: 20 },
      { wch: 11 },
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 12 },
      { wch: 20 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 36 },
      { wch: 10 },
      { wch: 10 },
      { wch: 9 },
      { wch: 12 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Invitados');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  exportRowsToExcel(rows: ImportGuestRowDto[]): Buffer {
    const headers = Object.keys(EXCEL_COLUMNS);
    const data = rows.map((row) =>
      headers.map((h) => {
        const key = EXCEL_COLUMNS[h] as keyof ImportGuestRowDto;
        const val = row[key];
        return Array.isArray(val) ? val.join(', ') : (val ?? '');
      }),
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(wb, ws, 'No encontrados');
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

  private async hasRegionAccess(
    regionId: string,
    currentUser: JwtPayload,
  ): Promise<boolean> {
    if (currentUser.role === 'superadmin') return true;
    const user = await this.usersRepository.findOne({
      where: { id: currentUser.sub },
      relations: { regions: true },
    });
    return (user?.regions ?? []).some((r) => r.id === regionId);
  }

  async lookupByCode(code: string): Promise<GuestFormLookupResponseDto> {
    const upper = code.trim().toUpperCase();
    const normalized = upper.includes('-')
      ? upper
      : (upper.match(/.{1,4}/g) ?? []).join('-');
    const candidates = Array.from(new Set([upper, normalized]));

    const guest = await this.guestsRepository.findOne({
      select: ['guest_code', 'group_id', 'region_id'],
      where: candidates.map((c) => ({ guest_code: c })),
    });

    if (!guest) throw new NotFoundException('Código de invitado no encontrado');

    const group = await this.groupsRepository.findOne({
      where: { id: guest.group_id },
      select: ['region_id'],
    });

    const region = await this.regionsRepository.findOne({
      where: { id: group?.region_id ?? guest.region_id },
    });

    return {
      guest_code: guest.guest_code,
      region_name: region?.name ?? '',
    };
  }

  async submitForm(code: string, dto: GuestFormSubmitDto): Promise<void> {
    const upper = code.trim().toUpperCase();
    const normalized = upper.includes('-')
      ? upper
      : (upper.match(/.{1,4}/g) ?? []).join('-');
    const candidates = Array.from(new Set([upper, normalized]));

    const guest = await this.guestsRepository.findOne({
      where: candidates.map((c) => ({ guest_code: c })),
    });
    if (!guest) throw new NotFoundException('Código de invitado no encontrado');

    Object.assign(guest, {
      full_name: dto.full_name,
      email: dto.email,
      origin_city: dto.origin_city,
      car_seats: dto.car_seats,
      speaks_english: dto.speaks_english,
      other_languages: dto.other_languages ?? null,
      real_arrival: dto.real_arrival,
      real_arrival_time: dto.real_arrival_time,
      real_departure: dto.real_departure,
      real_departure_time: dto.real_departure_time,
      hosting_address: dto.hosting_address,
      lat: dto.lat,
      lng: dto.lng,
      transport_mode: dto.transport_mode,
      arrival_other_transport: dto.arrival_other_transport,
      arrival_flight: dto.arrival_flight,
      needs_airport_transfer: dto.needs_airport_transfer,
      terms_accepted: dto.terms_accepted,
      terms_accepted_at: dto.terms_accepted ? new Date().toISOString() : null,
      terms_version: dto.terms_accepted ? dto.terms_version : null,
    });

    await this.guestsRepository.save(guest);
  }

  toDto(guest: Guest): GuestResponseDto {
    const dto = new GuestResponseDto();
    Object.assign(dto, guest);
    return dto;
  }

  private normalizeCode(code: string | null): string | null {
    if (!code) return null;
    if (code.includes('-')) return code;
    return code.match(/.{1,4}/g)!.join('-');
  }

  private parseString(val: unknown): string | null {
    if (val === null || val === undefined || val === '') return null;
    return String(val).trim() || null;
  }

  private parseBool(val: unknown): boolean {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val;
    const s = String(val).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'sí' || s === 'si';
  }

  private parseFloat(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = parseFloat(String(val));
    return isNaN(n) ? null : n;
  }

  private parseInt(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = parseInt(String(val), 10);
    return isNaN(n) ? null : n;
  }
}
