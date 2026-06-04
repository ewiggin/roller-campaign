import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

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

  @ApiPropertyOptional({
    example: 'Aeropuerto Adolfo Suárez, Madrid',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  activity_address?: string | null;

  @ApiPropertyOptional({ example: 40.4936, nullable: true })
  @IsOptional()
  @IsNumber()
  activity_lat?: number | null;

  @ApiPropertyOptional({ example: -3.5668, nullable: true })
  @IsOptional()
  @IsNumber()
  activity_lng?: number | null;

  @ApiPropertyOptional({ example: 'Calle Gran Vía 1, Madrid', nullable: true })
  @IsOptional()
  @IsString()
  departure_address?: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  @IsOptional()
  @IsNumber()
  departure_lat?: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  @IsOptional()
  @IsNumber()
  departure_lng?: number | null;
}
