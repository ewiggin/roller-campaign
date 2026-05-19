import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityVolunteerDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'V-001' })
  volunteer_code: string;

  @ApiProperty({ example: 'Carlos López' })
  full_name: string;
}

export class ActivityGuestGroupDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'GRP-001' })
  group_code: string;

  @ApiProperty({ example: 12 })
  guest_count: number;
}

export class AvailableGroupForActivityDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'GRP-001' })
  group_code: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  host_id: string | null;

  @ApiPropertyOptional({ example: 'Hotel Campanile', nullable: true })
  host_name: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  host_lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  host_lng: number | null;

  @ApiPropertyOptional({ example: 3.2, nullable: true, description: 'Distance in km from activity location to host. Null if either location is missing.' })
  distance_km: number | null;

  @ApiProperty({ example: 12 })
  guest_count: number;
}

export class ActivityResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  series_id: string | null;

  @ApiProperty({ example: 'Airport pickup' })
  name: string;

  @ApiPropertyOptional({ example: '✈️', nullable: true })
  icon: string | null;

  @ApiPropertyOptional({ example: 'Actividad de bienvenida', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'draft', enum: ['draft', 'published'] })
  status: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  host_id: string | null;

  @ApiPropertyOptional({ example: 'Congregación Norte', nullable: true })
  host_name: string | null;

  @ApiProperty({ example: '2024-06-15' })
  date: string;

  @ApiProperty({ example: '09:00' })
  start_time: string;

  @ApiProperty({ example: '13:00' })
  end_time: string;

  @ApiPropertyOptional({ example: 'Aeropuerto Adolfo Suárez, Madrid', nullable: true })
  activity_address: string | null;

  @ApiPropertyOptional({ example: 40.4936, nullable: true })
  activity_lat: number | null;

  @ApiPropertyOptional({ example: -3.5668, nullable: true })
  activity_lng: number | null;

  @ApiPropertyOptional({ example: 'Calle Gran Vía 1, Madrid', nullable: true })
  departure_address: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  departure_lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  departure_lng: number | null;

  @ApiProperty({ type: [ActivityVolunteerDto] })
  volunteers: ActivityVolunteerDto[];

  @ApiProperty({ example: 2 })
  volunteer_count: number;

  @ApiProperty({ type: [ActivityGuestGroupDto] })
  guest_groups: ActivityGuestGroupDto[];

  @ApiProperty({ example: 48 })
  total_guests_assigned: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}
