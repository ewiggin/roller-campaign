import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportCartRowDto {
  @ApiProperty({ example: 'Región Norte' })
  @IsString()
  region_name: string;

  @ApiPropertyOptional({ example: 'Congregación Norte', nullable: true })
  @IsOptional()
  @IsString()
  host_name?: string | null;

  @ApiProperty({ example: '1' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: 'Calle Gran Vía 1, Madrid', nullable: true })
  @IsOptional()
  @IsString()
  primary_address?: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  @IsOptional()
  primary_lat?: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  @IsOptional()
  primary_lng?: number | null;

  @ApiPropertyOptional({ example: 'Calle Alcalá 10, Madrid', nullable: true })
  @IsOptional()
  @IsString()
  secondary_address?: string | null;

  @ApiPropertyOptional({ example: 40.42, nullable: true })
  @IsOptional()
  secondary_lat?: number | null;

  @ApiPropertyOptional({ example: -3.7, nullable: true })
  @IsOptional()
  secondary_lng?: number | null;
}

export class ImportCartErrorDto {
  @ApiProperty({ example: 2 })
  row: number;

  @ApiProperty({ example: '1' })
  number: string;

  @ApiProperty({ example: 'Region "XYZ" not found' })
  reason: string;
}

export class ImportCartParseResponseDto {
  @ApiProperty({ type: [ImportCartRowDto] })
  valid: ImportCartRowDto[];

  @ApiProperty({ type: [ImportCartErrorDto] })
  errors: ImportCartErrorDto[];

  @ApiProperty({ example: { total: 10, valid: 8, errors: 2 } })
  summary: { total: number; valid: number; errors: number };
}

export class ImportCartCommitDto {
  @ApiProperty({ type: [ImportCartRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCartRowDto)
  rows: ImportCartRowDto[];
}

export class ImportCartCommitResponseDto {
  @ApiProperty({ example: 8 })
  created: number;

  @ApiProperty({ example: 8 })
  total: number;
}
