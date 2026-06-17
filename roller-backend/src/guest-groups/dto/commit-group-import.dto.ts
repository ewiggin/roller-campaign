import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ImportGroupRowDto } from './import-group-row.dto';

export class CommitGroupImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportGroupRowDto)
  rows: ImportGroupRowDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportGroupRowDto)
  updateRows?: ImportGroupRowDto[];

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsBoolean()
  deleteAbsent?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toDeleteCodes?: string[];

  @IsOptional()
  @IsBoolean()
  partialUpdate?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileColumns?: string[];
}
