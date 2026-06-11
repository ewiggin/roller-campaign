import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { GuestStatus, TransportMode } from '../entities/guest.entity';

export class GuestResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'G-001' })
  guest_code: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  group_id: string;

  @ApiPropertyOptional({ example: 'GRP-001', nullable: true })
  group_code: string | null;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiProperty({ example: 'Juan García López' })
  full_name: string;

  @ApiProperty({ example: false })
  is_minor: boolean;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'confirmed', 'cancelled', 'arrived', 'blocked'],
  })
  status: GuestStatus;

  @ApiPropertyOptional({ example: 'Sucursal Madrid', nullable: true })
  branch: string | null;

  @ApiProperty({ example: false })
  is_group_contact: boolean;

  @ApiPropertyOptional({ example: 'Español', nullable: true })
  native_language: string | null;

  @ApiPropertyOptional({ example: ['English', 'French'], nullable: true })
  other_languages: string[] | null;

  @ApiProperty({ example: false })
  speaks_english: boolean;

  @ApiProperty({ example: false })
  is_special_servant: boolean;

  @ApiPropertyOptional({ example: 'Madrid', nullable: true })
  origin_city: string | null;

  @ApiPropertyOptional({ example: 'juan@example.com', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ example: '2024-06-10', nullable: true })
  available_from: string | null;

  @ApiPropertyOptional({ example: '2024-06-25', nullable: true })
  available_to: string | null;

  @ApiPropertyOptional({
    example: 'plane',
    enum: ['car', 'bus', 'train', 'plane', 'ferry', 'motorbike', 'other'],
    nullable: true,
  })
  arrival_transport: TransportMode | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  arrival_other_transport: string | null;

  @ApiPropertyOptional({ example: '2024-06-14', nullable: true })
  arrival_date: string | null;

  @ApiPropertyOptional({ example: '10:30', nullable: true })
  arrival_time: string | null;

  @ApiPropertyOptional({ example: 'Madrid Barajas', nullable: true })
  arrival_place: string | null;

  @ApiPropertyOptional({ example: 'MAD', nullable: true })
  arrival_airport: string | null;

  @ApiPropertyOptional({ example: 'Iberia', nullable: true })
  arrival_airline: string | null;

  @ApiPropertyOptional({ example: 'IB1234', nullable: true })
  arrival_flight: string | null;

  @ApiPropertyOptional({ example: '2024-06-14', nullable: true })
  real_arrival: string | null;

  @ApiPropertyOptional({ example: '10:45', nullable: true })
  real_arrival_time: string | null;

  @ApiProperty({ example: false })
  needs_airport_transfer: boolean;

  @ApiPropertyOptional({
    example: 'car',
    enum: ['car', 'bus', 'train', 'plane', 'ferry', 'motorbike', 'other'],
    nullable: true,
  })
  departure_transport: TransportMode | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  departure_other_transport: string | null;

  @ApiPropertyOptional({ example: '2024-06-23', nullable: true })
  departure_date: string | null;

  @ApiPropertyOptional({ example: '16:00', nullable: true })
  departure_time: string | null;

  @ApiPropertyOptional({ example: 'Madrid Barajas', nullable: true })
  departure_place: string | null;

  @ApiPropertyOptional({ example: 'MAD', nullable: true })
  departure_airport: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  departure_airline: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  departure_flight: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  real_departure: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  real_departure_time: string | null;

  @ApiPropertyOptional({ example: 'Hotel Campanile', nullable: true })
  accommodation: string | null;

  @ApiPropertyOptional({ example: '2024-06-14', nullable: true })
  checkin_date: string | null;

  @ApiPropertyOptional({ example: '2024-06-23', nullable: true })
  checkout_date: string | null;

  @ApiProperty({ example: false })
  needs_special_accommodation: boolean;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Madrid', nullable: true })
  hosting_address: string | null;

  @ApiPropertyOptional({
    example: 'https://maps.google.com/?q=...',
    nullable: true,
  })
  maps_link: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  lng: number | null;

  @ApiPropertyOptional({ example: 'bus', nullable: true })
  transport_mode: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  car_seats: number | null;

  @ApiProperty({ example: false })
  terms_accepted: boolean;

  @ApiPropertyOptional({ example: '2026-05-17T10:00:00.000Z', nullable: true })
  terms_accepted_at: string | null;

  @ApiPropertyOptional({ example: '1.0', nullable: true })
  terms_version: string | null;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}
