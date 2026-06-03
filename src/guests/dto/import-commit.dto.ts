import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';
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

  /** Si true, elimina de la BD los invitados de la región que no aparezcan en el Excel (solo modo región). */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  deleteAbsent?: boolean;

  /** Si true, en los updateRows solo se patchean los campos cuya columna estaba presente en el Excel. */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  partialUpdate?: boolean;

  /** Columnas reconocidas del Excel, necesarias cuando partialUpdate es true. */
  @ApiPropertyOptional({ example: ['guest_code', 'group_code', 'status'] })
  @IsOptional()
  @IsArray()
  columns?: string[];
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
  deleted_guests?: number;

  @ApiPropertyOptional({ example: 3 })
  groups_not_found?: number;

  @ApiPropertyOptional({ type: [ImportGuestRowDto] })
  groups_not_found_rows?: ImportGuestRowDto[];
}
