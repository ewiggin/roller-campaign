import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportRegionRowDto {
  @ApiProperty({ example: 'Costa Brava' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '2026-07-01', nullable: true })
  @IsOptional()
  @IsString()
  event_start_date?: string | null;

  @ApiPropertyOptional({ example: '2026-07-07', nullable: true })
  @IsOptional()
  @IsString()
  event_end_date?: string | null;
}

export class ImportRegionErrorDto {
  @ApiProperty({ example: 2 })
  row: number;

  @ApiProperty({ example: 'Costa Brava' })
  name: string;

  @ApiProperty({ example: 'Name is required' })
  reason: string;
}

export class ImportRegionParseResponseDto {
  @ApiProperty({ type: [ImportRegionRowDto] })
  valid: ImportRegionRowDto[];

  @ApiProperty({ type: [ImportRegionRowDto] })
  duplicateRows: ImportRegionRowDto[];

  @ApiProperty({ type: [ImportRegionErrorDto] })
  errors: ImportRegionErrorDto[];

  @ApiProperty({ example: { total: 10, valid: 8, duplicates: 1, errors: 1 } })
  summary: { total: number; valid: number; duplicates: number; errors: number };
}

export class ImportRegionCommitDto {
  @ApiProperty({ type: [ImportRegionRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRegionRowDto)
  rows: ImportRegionRowDto[];

  @ApiPropertyOptional({ type: [ImportRegionRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRegionRowDto)
  updateRows?: ImportRegionRowDto[];
}

export class ImportRegionCommitResponseDto {
  @ApiProperty({ example: 8 })
  created: number;

  @ApiProperty({ example: 1 })
  updated: number;

  @ApiProperty({ example: 9 })
  total: number;
}
