import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Cart } from './entities/cart.entity';
import { Region } from '../regions/entities/region.entity';
import { Host } from '../hosts/entities/host.entity';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import {
  ImportCartCommitDto,
  ImportCartCommitResponseDto,
  ImportCartParseResponseDto,
  ImportCartRowDto,
} from './dto/import-cart.dto';

const CART_RELATIONS = { host: true };

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart) private readonly cartsRepo: Repository<Cart>,
    @InjectRepository(Region) private readonly regionsRepo: Repository<Region>,
    @InjectRepository(Host) private readonly hostsRepo: Repository<Host>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreateCartDto): Promise<CartResponseDto> {
    const region = await this.regionsRepo.findOne({
      where: { id: dto.region_id },
    });
    if (!region) throw new NotFoundException('Region not found');

    const cart = this.cartsRepo.create({
      region_id: dto.region_id,
      host_id: dto.host_id ?? null,
      number: dto.number,
      primary_location: dto.primary_location ?? null,
      secondary_location: dto.secondary_location ?? null,
      image_key: dto.image_key ?? null,
    });
    const saved = await this.cartsRepo.save(cart);
    await this.cache.clear();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.toDto(
      (await this.cartsRepo.findOne({
        where: { id: saved.id },
        relations: CART_RELATIONS,
      }))!,
    );
  }

  async findAll(): Promise<CartResponseDto[]> {
    const carts = await this.cartsRepo.find({
      relations: CART_RELATIONS,
      order: { number: 'ASC' },
    });
    return carts.map((c) => this.toDto(c));
  }

  async findOne(id: string): Promise<CartResponseDto> {
    const cart = await this.cartsRepo.findOne({
      where: { id },
      relations: CART_RELATIONS,
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return this.toDto(cart);
  }

  async update(id: string, dto: UpdateCartDto): Promise<CartResponseDto> {
    const cart = await this.cartsRepo.findOne({ where: { id } });
    if (!cart) throw new NotFoundException('Cart not found');

    if (dto.region_id !== undefined) {
      const region = await this.regionsRepo.findOne({
        where: { id: dto.region_id },
      });
      if (!region) throw new NotFoundException('Region not found');
      cart.region_id = dto.region_id;
    }
    if (dto.host_id !== undefined) cart.host_id = dto.host_id ?? null;
    if (dto.number !== undefined) cart.number = dto.number;
    if (dto.primary_location !== undefined)
      cart.primary_location = dto.primary_location ?? null;
    if (dto.secondary_location !== undefined)
      cart.secondary_location = dto.secondary_location ?? null;
    if (dto.image_key !== undefined) cart.image_key = dto.image_key ?? null;

    await this.cartsRepo.save(cart);
    await this.cache.clear();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.toDto(
      (await this.cartsRepo.findOne({
        where: { id },
        relations: CART_RELATIONS,
      }))!,
    );
  }

  async remove(id: string): Promise<void> {
    const cart = await this.cartsRepo.findOne({ where: { id } });
    if (!cart) throw new NotFoundException('Cart not found');
    await this.cartsRepo.remove(cart);
    await this.cache.clear();
  }

  // ── Excel export ────────────────────────────────────────────────────────────

  async exportExcel(): Promise<Buffer> {
    const carts = await this.cartsRepo.find({
      relations: CART_RELATIONS,
      order: { number: 'ASC' },
    });
    const allRegions = await this.regionsRepo.find({ select: ['id', 'name'] });
    const regionMap = new Map(allRegions.map((r) => [r.id, r.name]));

    const headers = [
      'number',
      'region_name',
      'host_name',
      'primary_address',
      'primary_lat',
      'primary_lng',
      'secondary_address',
      'secondary_lat',
      'secondary_lng',
    ];
    const rows = carts.map((c) => [
      c.number,
      regionMap.get(c.region_id) ?? '',
      c.host?.name ?? '',
      c.primary_location?.address ?? '',
      c.primary_location?.lat ?? '',
      c.primary_location?.lng ?? '',
      c.secondary_location?.address ?? '',
      c.secondary_location?.lat ?? '',
      c.secondary_location?.lng ?? '',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 24 },
      { wch: 36 },
      { wch: 12 },
      { wch: 12 },
      { wch: 36 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Carts');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  downloadTemplate(): Buffer {
    const headers = [
      'number',
      'region_name',
      'host_name',
      'primary_address',
      'primary_lat',
      'primary_lng',
      'secondary_address',
      'secondary_lat',
      'secondary_lng',
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 24 },
      { wch: 36 },
      { wch: 12 },
      { wch: 12 },
      { wch: 36 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Carts');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ── Excel import ─────────────────────────────────────────────────────────────

  async parseImport(buffer: Buffer): Promise<ImportCartParseResponseDto> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });

    const allRegions = await this.regionsRepo.find({ select: ['id', 'name'] });
    const regionMap = new Map(
      allRegions.map((r) => [r.name.toLowerCase(), r.id]),
    );

    const valid: ImportCartRowDto[] = [];
    const errors: { row: number; number: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const rowNum = i + 2;
      const number = String(raw['number'] ?? '').trim();
      const regionName = String(raw['region_name'] ?? '').trim();

      if (!regionName) {
        errors.push({ row: rowNum, number, reason: 'region_name is required' });
        continue;
      }
      if (!regionMap.has(regionName.toLowerCase())) {
        errors.push({
          row: rowNum,
          number,
          reason: `Region "${regionName}" not found`,
        });
        continue;
      }

      const primaryLat =
        raw['primary_lat'] !== '' ? Number(raw['primary_lat']) : null;
      const primaryLng =
        raw['primary_lng'] !== '' ? Number(raw['primary_lng']) : null;
      if (
        (primaryLat !== null && isNaN(primaryLat)) ||
        (primaryLng !== null && isNaN(primaryLng))
      ) {
        errors.push({
          row: rowNum,
          number,
          reason: 'primary_lat / primary_lng must be numbers',
        });
        continue;
      }

      const secondaryLat =
        raw['secondary_lat'] !== '' ? Number(raw['secondary_lat']) : null;
      const secondaryLng =
        raw['secondary_lng'] !== '' ? Number(raw['secondary_lng']) : null;
      if (
        (secondaryLat !== null && isNaN(secondaryLat)) ||
        (secondaryLng !== null && isNaN(secondaryLng))
      ) {
        errors.push({
          row: rowNum,
          number,
          reason: 'secondary_lat / secondary_lng must be numbers',
        });
        continue;
      }

      valid.push({
        region_name: regionName,
        host_name: String(raw['host_name'] ?? '').trim() || null,
        number,
        primary_address: String(raw['primary_address'] ?? '').trim() || null,
        primary_lat: primaryLat,
        primary_lng: primaryLng,
        secondary_address:
          String(raw['secondary_address'] ?? '').trim() || null,
        secondary_lat: secondaryLat,
        secondary_lng: secondaryLng,
      });
    }

    return {
      valid,
      errors,
      summary: {
        total: rows.length,
        valid: valid.length,
        errors: errors.length,
      },
    };
  }

  async commitImport(
    dto: ImportCartCommitDto,
  ): Promise<ImportCartCommitResponseDto> {
    const allRegions = await this.regionsRepo.find({ select: ['id', 'name'] });
    const regionMap = new Map(
      allRegions.map((r) => [r.name.toLowerCase(), r.id]),
    );

    const allHosts = await this.hostsRepo.find({ select: ['id', 'name'] });
    const hostMap = new Map(allHosts.map((h) => [h.name.toLowerCase(), h.id]));

    const entities = dto.rows.map((row) => {
      const region_id = regionMap.get(row.region_name.toLowerCase())!;
      const host_id = row.host_name
        ? (hostMap.get(row.host_name.toLowerCase()) ?? null)
        : null;

      const primary_location =
        row.primary_lat != null && row.primary_lng != null
          ? {
              address:
                row.primary_address ?? `${row.primary_lat}, ${row.primary_lng}`,
              lat: row.primary_lat,
              lng: row.primary_lng,
            }
          : null;

      const secondary_location =
        row.secondary_lat != null && row.secondary_lng != null
          ? {
              address:
                row.secondary_address ??
                `${row.secondary_lat}, ${row.secondary_lng}`,
              lat: row.secondary_lat,
              lng: row.secondary_lng,
            }
          : null;

      return this.cartsRepo.create({
        region_id,
        host_id,
        number: row.number,
        primary_location,
        secondary_location,
        image_key: null,
      });
    });

    await this.cartsRepo.save(entities);
    await this.cache.clear();
    return { created: entities.length, total: entities.length };
  }

  private toDto(cart: Cart): CartResponseDto {
    return {
      id: cart.id,
      region_id: cart.region_id,
      host_id: cart.host_id,
      host_name: cart.host?.name ?? null,
      number: cart.number,
      primary_location: cart.primary_location,
      secondary_location: cart.secondary_location,
      image_key: cart.image_key,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
    };
  }
}
