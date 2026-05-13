import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GuestFormLookupResponseDto {
  @ApiProperty({ example: 'ABCD-1234' })
  guest_code: string;

  @ApiProperty({ example: 'Juan García López' })
  full_name: string;

  @ApiPropertyOptional({ example: 'juan@example.com', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ example: 'Madrid', nullable: true })
  origin_city: string | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  car_seats: number | null;

  @ApiProperty({ example: false })
  speaks_english: boolean;

  @ApiPropertyOptional({ example: '2024-06-14', nullable: true })
  real_arrival: string | null;

  @ApiPropertyOptional({ example: '10:00', nullable: true })
  real_arrival_time: string | null;

  @ApiPropertyOptional({ example: '2024-06-21', nullable: true })
  real_departure: string | null;

  @ApiPropertyOptional({ example: '16:00', nullable: true })
  real_departure_time: string | null;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Barcelona', nullable: true })
  hosting_address: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  lng: number | null;

  @ApiPropertyOptional({ example: 'Avión', nullable: true })
  transport_mode: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  arrival_other_transport: string | null;

  @ApiPropertyOptional({ example: 'IB1234', nullable: true })
  arrival_flight: string | null;

  @ApiProperty({ example: false })
  needs_airport_transfer: boolean;

  @ApiProperty({ example: 'Costa Brava' })
  region_name: string;
}
