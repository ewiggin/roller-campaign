import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportHostRowDto {
  @ApiProperty({ example: 'Congregación Norte' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Costa Brava' })
  @IsString()
  region_name: string;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Girona', nullable: true })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ example: 41.9794, nullable: true })
  @IsOptional()
  lat?: number | null;

  @ApiPropertyOptional({ example: 2.8214, nullable: true })
  @IsOptional()
  lng?: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  @IsOptional()
  weekday_meeting_day?: number | null;

  @ApiPropertyOptional({ example: '19:30', nullable: true })
  @IsOptional()
  @IsString()
  weekday_meeting_time?: string | null;

  @ApiPropertyOptional({ example: 7, nullable: true })
  @IsOptional()
  weekend_meeting_day?: number | null;

  @ApiPropertyOptional({ example: '10:00', nullable: true })
  @IsOptional()
  @IsString()
  weekend_meeting_time?: string | null;
}

export class ImportHostErrorDto {
  @ApiProperty({ example: 2 })
  row: number;

  @ApiProperty({ example: 'Congregación Norte' })
  name: string;

  @ApiProperty({ example: 'Region "XYZ" not found' })
  reason: string;
}

export class ImportHostParseResponseDto {
  @ApiProperty({ type: [ImportHostRowDto] })
  valid: ImportHostRowDto[];

  @ApiProperty({ type: [ImportHostRowDto] })
  duplicateRows: ImportHostRowDto[];

  @ApiProperty({ type: [ImportHostErrorDto] })
  errors: ImportHostErrorDto[];

  @ApiProperty({ example: { total: 10, valid: 8, duplicates: 1, errors: 1 } })
  summary: { total: number; valid: number; duplicates: number; errors: number };
}

export class ImportHostCommitDto {
  @ApiProperty({ type: [ImportHostRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportHostRowDto)
  rows: ImportHostRowDto[];

  @ApiPropertyOptional({ type: [ImportHostRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportHostRowDto)
  updateRows?: ImportHostRowDto[];
}

export class ImportHostCommitResponseDto {
  @ApiProperty({ example: 8 })
  created: number;

  @ApiProperty({ example: 1 })
  updated: number;

  @ApiProperty({ example: 9 })
  total: number;
}
