import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ImportGuestRowDto } from './import-parse-response.dto';

export class ImportCommitDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  // Rows are validated during the parse step; no re-validation here to avoid
  // the whitelist pipe stripping fields from un-decorated ImportGuestRowDto properties.
  @ApiProperty({ type: [ImportGuestRowDto] })
  @IsArray()
  rows: ImportGuestRowDto[];

  /** Filas de invitados ya existentes que deben actualizarse (no crearse). */
  @ApiPropertyOptional({ type: [ImportGuestRowDto] })
  @IsOptional()
  @IsArray()
  updateRows?: ImportGuestRowDto[];
}

export class ImportCommitResponseDto {
  @ApiProperty({ example: 145 })
  created_guests: number;

  @ApiProperty({ example: 5 })
  updated_guests: number;

  @ApiProperty({ example: 12 })
  created_groups: number;

  @ApiProperty({ example: 150 })
  total: number;

  @ApiPropertyOptional({ example: 3 })
  groups_not_found?: number;

  @ApiPropertyOptional({ type: [ImportGuestRowDto] })
  groups_not_found_rows?: ImportGuestRowDto[];
}
