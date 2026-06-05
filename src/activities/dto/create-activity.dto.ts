import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LocationPointDto } from './location-point.dto';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateActivityDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;

  @ApiProperty({ example: 'Airport pickup' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '✈️', nullable: true })
  @IsOptional()
  @IsString()
  icon?: string | null;

  @ApiPropertyOptional({
    example: 'Actividad de bienvenida en el aeropuerto',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  host_id?: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @IsOptional()
  @IsInt()
  @IsPositive()
  required_volunteers?: number | null;

  @ApiPropertyOptional({ example: 50, nullable: true })
  @IsOptional()
  @IsInt()
  @IsPositive()
  max_guests?: number | null;

  @ApiProperty({ example: '2024-06-15' })
  @IsISO8601({ strict: true })
  date: string;

  @ApiProperty({ example: '09:00' })
  @Matches(TIME_REGEX, { message: 'start_time debe tener formato HH:MM' })
  start_time: string;

  @ApiProperty({ example: '13:00' })
  @Matches(TIME_REGEX, { message: 'end_time debe tener formato HH:MM' })
  end_time: string;

  @ApiPropertyOptional({ type: [LocationPointDto], nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationPointDto)
  activity_locations?: LocationPointDto[] | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_preaching_shift?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  request_attendance?: boolean;
}
