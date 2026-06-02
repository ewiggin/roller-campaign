import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const ALL_SLOTS = [
  'monday_morning',
  'monday_afternoon',
  'tuesday_morning',
  'tuesday_afternoon',
  'wednesday_morning',
  'wednesday_afternoon',
  'thursday_morning',
  'thursday_afternoon',
  'friday_morning',
  'friday_afternoon',
  'saturday_morning',
  'saturday_afternoon',
  'sunday_morning',
  'sunday_afternoon',
  'saturday_prev_morning',
  'saturday_prev_afternoon',
  'sunday_prev_morning',
  'sunday_prev_afternoon',
  'monday_next_morning',
  'monday_next_afternoon',
] as const;

export class VolunteerListQueryDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ example: 'Carlos' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: '2024-06-15' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  min_car_seats?: number;

  @ApiPropertyOptional({
    example: ['monday_morning', 'saturday_afternoon'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsIn([...ALL_SLOTS], { each: true })
  available_slots?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  terms_accepted?: boolean;
}
