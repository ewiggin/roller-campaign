import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class SetAvailabilityDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;

  @ApiProperty({ example: ['2024-06-15', '2024-06-16', '2024-06-17'] })
  @IsArray()
  @IsISO8601({ strict: true }, { each: true })
  dates: string[];
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Conductor' })
  @IsString()
  name: string;
}

export class ImportVolunteerRowDto {
  @ApiProperty({ example: '5274026' })
  volunteer_code: string;

  @ApiProperty({ example: 'Martínez, Mario' })
  full_name: string;

  @ApiPropertyOptional({ example: 'mario@example.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+34 600 000 000' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Costa Brava' })
  region_name?: string | null;

  @ApiPropertyOptional({ example: 3 })
  car_seats?: number | null;

  @ApiPropertyOptional({ example: 'Passatge Bernat Metge, 14, 17800 Olot' })
  hosting_address?: string | null;

  @ApiPropertyOptional({ example: 42.1836987 })
  lat?: number | null;

  @ApiPropertyOptional({ example: 2.4774935 })
  lng?: number | null;

  @ApiPropertyOptional({ example: 'https://www.google.com/maps?q=42.18,2.47' })
  maps_link?: string | null;

  @ApiPropertyOptional({ example: 'Varón' })
  sex?: string | null;

  @ApiPropertyOptional({ example: 'Casado' })
  civil_status?: string | null;

  @ApiPropertyOptional({ example: 'Olot' })
  congregation?: string | null;

  @ApiPropertyOptional({ example: 'Cataluña' })
  branch?: string | null;

  @ApiPropertyOptional({ example: 'No' })
  has_assigned_shift?: string | null;

  @ApiPropertyOptional({ example: 'grupo1' })
  groups?: string | null;

  @ApiPropertyOptional({ example: 0 })
  assigned_hours?: number | null;

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'Conductor, Guía' })
  role_names?: string | null;

  @ApiPropertyOptional({ example: false })
  monday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  monday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  tuesday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  tuesday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  wednesday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  wednesday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  thursday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  thursday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  friday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  friday_afternoon?: boolean;

  @ApiPropertyOptional({ example: true })
  saturday_morning?: boolean;

  @ApiPropertyOptional({ example: true })
  saturday_afternoon?: boolean;

  @ApiPropertyOptional({ example: true })
  sunday_morning?: boolean;

  @ApiPropertyOptional({ example: true })
  sunday_afternoon?: boolean;
}

export class ImportVolunteerParseResponseDto {
  @ApiProperty({ type: [ImportVolunteerRowDto] })
  to_create: ImportVolunteerRowDto[];

  @ApiProperty({ example: ['V-001', 'V-002'] })
  skipped: string[];

  @ApiProperty({ example: { total: 10, to_create: 8, skipped: 2 } })
  summary: { total: number; to_create: number; skipped: number };
}

export class ImportVolunteerCommitDto {
  @ApiProperty({ example: ['123e4567-e89b-12d3-a456-426614174000'] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  region_ids?: string[];

  @ApiProperty({ type: [ImportVolunteerRowDto] })
  @IsArray()
  rows: ImportVolunteerRowDto[];
}

export class ImportVolunteerCommitResponseDto {
  @ApiProperty({ example: 8 })
  created: number;

  @ApiProperty({ example: 2 })
  skipped: number;

  @ApiProperty({ example: 10 })
  total: number;
}
