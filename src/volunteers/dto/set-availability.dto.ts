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
  @ApiProperty({ example: 'V-001' })
  volunteer_code: string;

  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({ example: 'carlos@example.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+34 600 000 000' })
  phone?: string | null;
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
