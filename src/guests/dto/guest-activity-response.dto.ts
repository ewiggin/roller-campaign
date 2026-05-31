import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GuestActivityVolunteerDto {
  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 'carlos@example.com', nullable: true })
  email: string | null;
}

export class GuestActivityResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Airport pickup' })
  name: string;

  @ApiPropertyOptional({ example: '✈️', nullable: true })
  icon: string | null;

  @ApiPropertyOptional({
    example: 'Traslado desde el aeropuerto',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: '2024-06-15' })
  date: string;

  @ApiProperty({ example: '09:00' })
  start_time: string;

  @ApiProperty({ example: '13:00' })
  end_time: string;

  @ApiPropertyOptional({ example: 'Calle Gran Vía 1, Madrid', nullable: true })
  departure_address: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  departure_lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  departure_lng: number | null;

  @ApiPropertyOptional({
    example: 'Aeropuerto Adolfo Suárez, Madrid',
    nullable: true,
  })
  activity_address: string | null;

  @ApiPropertyOptional({ example: 40.4936, nullable: true })
  activity_lat: number | null;

  @ApiPropertyOptional({ example: -3.5668, nullable: true })
  activity_lng: number | null;

  @ApiProperty({ type: [GuestActivityVolunteerDto] })
  volunteers: GuestActivityVolunteerDto[];
}
