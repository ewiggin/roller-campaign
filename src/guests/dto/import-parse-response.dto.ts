import { ApiProperty } from '@nestjs/swagger';

export class ImportGuestRowDto {
  @ApiProperty({ example: 'G-001' })
  guest_code: string;

  @ApiProperty({ example: 'GRP-001' })
  group_code: string;

  @ApiProperty({
    example: 'Juan García López',
    required: false,
    nullable: true,
  })
  full_name?: string | null;

  is_minor?: boolean;
  status?: string;
  branch?: string | null;
  is_group_contact?: boolean;
  native_language?: string | null;
  other_languages?: string[] | null;
  speaks_english?: boolean;
  is_special_servant?: boolean;
  origin_city?: string | null;
  email?: string | null;
  available_from?: string | null;
  available_to?: string | null;
  arrival_transport?: string | null;
  arrival_other_transport?: string | null;
  arrival_date?: string | null;
  arrival_time?: string | null;
  arrival_place?: string | null;
  arrival_airport?: string | null;
  arrival_airline?: string | null;
  arrival_flight?: string | null;
  real_arrival?: string | null;
  real_arrival_time?: string | null;
  needs_airport_transfer?: boolean;
  departure_transport?: string | null;
  departure_other_transport?: string | null;
  departure_date?: string | null;
  departure_time?: string | null;
  departure_place?: string | null;
  departure_airport?: string | null;
  departure_airline?: string | null;
  departure_flight?: string | null;
  real_departure?: string | null;
  real_departure_time?: string | null;
  accommodation?: string | null;
  checkin_date?: string | null;
  checkout_date?: string | null;
  needs_special_accommodation?: boolean;
  hosting_address?: string | null;
  maps_link?: string | null;
  lat?: number | null;
  lng?: number | null;
  transport_mode?: string | null;
  car_seats?: number | null;
}

export class ImportErrorDto {
  @ApiProperty({ example: 2 })
  row: number;

  @ApiProperty({ example: 'G-001' })
  guest_code: string;

  @ApiProperty({ example: 'full_name es obligatorio' })
  reason: string;
}

export class ImportSummaryDto {
  @ApiProperty({ example: 150 })
  total: number;

  @ApiProperty({ example: 145 })
  valid: number;

  @ApiProperty({ example: 3 })
  errors: number;

  @ApiProperty({ example: 2 })
  duplicates: number;
}

export class ImportParseResponseDto {
  @ApiProperty({ type: [ImportGuestRowDto] })
  valid: ImportGuestRowDto[];

  @ApiProperty({ type: [ImportErrorDto] })
  errors: ImportErrorDto[];

  /** Códigos de invitados que ya existen en la BD. */
  @ApiProperty({ example: ['G-005', 'G-012'] })
  duplicates: string[];

  /** Filas completas de los duplicados (para poder pasarlas al commit como updateRows). */
  @ApiProperty({ type: [ImportGuestRowDto] })
  duplicateRows: ImportGuestRowDto[];

  @ApiProperty({ type: ImportSummaryDto })
  summary: ImportSummaryDto;

  /** Columnas reconocidas presentes en el Excel (para actualización parcial). */
  @ApiProperty({ example: ['guest_code', 'group_code', 'status'] })
  columns: string[];
}
