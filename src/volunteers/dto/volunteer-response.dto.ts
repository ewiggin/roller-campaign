import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationPointDto } from '../../activities/dto/location-point.dto';

export class VolunteerRoleDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Conductor' })
  name: string;
}

export class VolunteerRegionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Madrid Norte' })
  name: string;

  @ApiPropertyOptional({ example: '2024-06-14', nullable: true })
  event_start_date: string | null;

  @ApiPropertyOptional({ example: '2024-06-16', nullable: true })
  event_end_date: string | null;
}

export class VolunteerResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'V-001' })
  volunteer_code: string;

  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({ example: 'carlos@example.com', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ example: '+34 600 000 000', nullable: true })
  phone: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  user_id: string | null;

  @ApiProperty({ type: [VolunteerRoleDto] })
  roles: VolunteerRoleDto[];

  @ApiProperty({ type: [VolunteerRegionDto] })
  regions: VolunteerRegionDto[];

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Barcelona', nullable: true })
  hosting_address: string | null;

  @ApiPropertyOptional({ example: 41.3851, nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ example: 2.1734, nullable: true })
  lng: number | null;

  @ApiPropertyOptional({
    example: 'https://maps.google.com/?q=41.3851,2.1734',
    nullable: true,
  })
  maps_link: string | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  car_seats: number | null;

  @ApiProperty({ example: false })
  monday_morning: boolean;

  @ApiProperty({ example: false })
  monday_afternoon: boolean;

  @ApiProperty({ example: false })
  tuesday_morning: boolean;

  @ApiProperty({ example: false })
  tuesday_afternoon: boolean;

  @ApiProperty({ example: false })
  wednesday_morning: boolean;

  @ApiProperty({ example: false })
  wednesday_afternoon: boolean;

  @ApiProperty({ example: false })
  thursday_morning: boolean;

  @ApiProperty({ example: false })
  thursday_afternoon: boolean;

  @ApiProperty({ example: false })
  friday_morning: boolean;

  @ApiProperty({ example: false })
  friday_afternoon: boolean;

  @ApiProperty({ example: false })
  saturday_morning: boolean;

  @ApiProperty({ example: false })
  saturday_afternoon: boolean;

  @ApiProperty({ example: false })
  sunday_morning: boolean;

  @ApiProperty({ example: false })
  sunday_afternoon: boolean;

  @ApiProperty({ example: false })
  saturday_prev_morning: boolean;

  @ApiProperty({ example: false })
  saturday_prev_afternoon: boolean;

  @ApiProperty({ example: false })
  sunday_prev_morning: boolean;

  @ApiProperty({ example: false })
  sunday_prev_afternoon: boolean;

  @ApiProperty({ example: false })
  monday_next_morning: boolean;

  @ApiProperty({ example: false })
  monday_next_afternoon: boolean;

  @ApiPropertyOptional({ example: true, nullable: true })
  terms_accepted: boolean | null;

  @ApiPropertyOptional({ example: '2024-01-15T10:00:00.000Z', nullable: true })
  terms_accepted_at: string | null;

  @ApiPropertyOptional({ example: 'v1', nullable: true })
  terms_version: string | null;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}

export class AvailabilityEntryDto {
  @ApiProperty({ example: '2024-06-15' })
  date: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiPropertyOptional({ example: 'Morning only', nullable: true })
  note: string | null;
}

export class VolunteerActivityVolunteerDto {
  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 'Conductor', nullable: true })
  role_name: string | null;
}

export class VolunteerActivityDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiProperty({ example: 'Recogida en aeropuerto' })
  name: string;

  @ApiPropertyOptional({ example: '✈️', nullable: true })
  icon: string | null;

  @ApiPropertyOptional({ example: 'Recogida vuelo IB1234', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2024-06-15' })
  date: string;

  @ApiProperty({ example: '09:00' })
  start_time: string;

  @ApiProperty({ example: '11:00' })
  end_time: string;

  @ApiPropertyOptional({ type: [LocationPointDto], nullable: true })
  activity_locations: LocationPointDto[] | null;

  @ApiProperty({ type: [VolunteerActivityVolunteerDto] })
  volunteers: VolunteerActivityVolunteerDto[];
}
