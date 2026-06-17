import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ImportGroupRowDto {
  @IsString()
  @IsNotEmpty()
  group_code: string;

  @IsOptional()
  @IsString()
  region_name?: string | null;

  @IsOptional()
  @IsString()
  host_name?: string | null;

  @IsOptional()
  @IsString()
  available_from?: string | null;

  @IsOptional()
  @IsString()
  available_to?: string | null;

  @IsOptional()
  @IsString()
  composition?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  car_count?: number | null;
}
