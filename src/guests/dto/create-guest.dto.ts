import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import type { GuestStatus, TransportMode } from '../entities/guest.entity';

const TRANSPORT_VALUES = ['car', 'bus', 'train', 'plane', 'ferry', 'motorbike', 'other'] as const;
const STATUS_VALUES = ['pending', 'confirmed', 'cancelled', 'arrived', 'blocked'] as const;

export class CreateGuestDto {
  @ApiProperty({ example: 'G-001' })
  @IsString()
  @IsNotEmpty()
  guest_code: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  group_id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;

  @ApiProperty({ example: 'Juan García López' })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_minor?: boolean;

  @ApiPropertyOptional({ example: 'pending', enum: STATUS_VALUES })
  @IsOptional()
  @IsEnum(STATUS_VALUES)
  status?: GuestStatus;

  @ApiPropertyOptional({ example: 'Sucursal Madrid' })
  @IsOptional()
  @IsString()
  branch?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_group_contact?: boolean;

  @ApiPropertyOptional({ example: 'Español' })
  @IsOptional()
  @IsString()
  native_language?: string | null;

  @ApiPropertyOptional({ example: ['English', 'French'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  other_languages?: string[] | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  speaks_english?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_special_servant?: boolean;

  @ApiPropertyOptional({ example: 'Madrid' })
  @IsOptional()
  @IsString()
  origin_city?: string | null;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: '2024-06-10' })
  @IsOptional()
  @IsISO8601({ strict: true })
  available_from?: string | null;

  @ApiPropertyOptional({ example: '2024-06-25' })
  @IsOptional()
  @IsISO8601({ strict: true })
  available_to?: string | null;

  @ApiPropertyOptional({ example: 'plane', enum: TRANSPORT_VALUES })
  @IsOptional()
  @IsEnum(TRANSPORT_VALUES)
  arrival_transport?: TransportMode | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  arrival_other_transport?: string | null;

  @ApiPropertyOptional({ example: '2024-06-14' })
  @IsOptional()
  @IsISO8601({ strict: true })
  arrival_date?: string | null;

  @ApiPropertyOptional({ example: '10:30' })
  @IsOptional()
  @IsString()
  arrival_time?: string | null;

  @ApiPropertyOptional({ example: 'Madrid Barajas' })
  @IsOptional()
  @IsString()
  arrival_place?: string | null;

  @ApiPropertyOptional({ example: 'MAD' })
  @IsOptional()
  @IsString()
  arrival_airport?: string | null;

  @ApiPropertyOptional({ example: 'Iberia' })
  @IsOptional()
  @IsString()
  arrival_airline?: string | null;

  @ApiPropertyOptional({ example: 'IB1234' })
  @IsOptional()
  @IsString()
  arrival_flight?: string | null;

  @ApiPropertyOptional({ example: '2024-06-14' })
  @IsOptional()
  @IsISO8601({ strict: true })
  real_arrival?: string | null;

  @ApiPropertyOptional({ example: '10:45' })
  @IsOptional()
  @IsString()
  real_arrival_time?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  needs_airport_transfer?: boolean;

  @ApiPropertyOptional({ example: 'car', enum: TRANSPORT_VALUES })
  @IsOptional()
  @IsEnum(TRANSPORT_VALUES)
  departure_transport?: TransportMode | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  departure_other_transport?: string | null;

  @ApiPropertyOptional({ example: '2024-06-23' })
  @IsOptional()
  @IsISO8601({ strict: true })
  departure_date?: string | null;

  @ApiPropertyOptional({ example: '16:00' })
  @IsOptional()
  @IsString()
  departure_time?: string | null;

  @ApiPropertyOptional({ example: 'Madrid Barajas' })
  @IsOptional()
  @IsString()
  departure_place?: string | null;

  @ApiPropertyOptional({ example: 'MAD' })
  @IsOptional()
  @IsString()
  departure_airport?: string | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  departure_airline?: string | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  departure_flight?: string | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsISO8601({ strict: true })
  real_departure?: string | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  real_departure_time?: string | null;

  @ApiPropertyOptional({ example: 'Hotel Campanile' })
  @IsOptional()
  @IsString()
  accommodation?: string | null;

  @ApiPropertyOptional({ example: '2024-06-14' })
  @IsOptional()
  @IsISO8601({ strict: true })
  checkin_date?: string | null;

  @ApiPropertyOptional({ example: '2024-06-23' })
  @IsOptional()
  @IsISO8601({ strict: true })
  checkout_date?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  needs_special_accommodation?: boolean;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Madrid' })
  @IsOptional()
  @IsString()
  hosting_address?: string | null;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=...' })
  @IsOptional()
  @IsString()
  maps_link?: string | null;

  @ApiPropertyOptional({ example: 40.4168 })
  @IsOptional()
  @IsNumber()
  lat?: number | null;

  @ApiPropertyOptional({ example: -3.7038 })
  @IsOptional()
  @IsNumber()
  lng?: number | null;

  @ApiPropertyOptional({ example: 'bus' })
  @IsOptional()
  @IsString()
  transport_mode?: string | null;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  car_seats?: number | null;
}
