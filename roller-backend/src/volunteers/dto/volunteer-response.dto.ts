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

export class VolunteerCongregationDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Congregación Olot' })
  name: string;

  @ApiPropertyOptional({ example: 'Carrer Major, 1, 17800 Olot', nullable: true })
  address: string | null;

  @ApiPropertyOptional({ example: 42.1837, nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ example: 2.4775, nullable: true })
  lng: number | null;
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

  @ApiPropertyOptional({ type: VolunteerCongregationDto, nullable: true })
  congregation: VolunteerCongregationDto | null;

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

export class VolunteerPreachingGroupVolunteerDto {
  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 'Conductor', nullable: true })
  role_name: string | null;

  @ApiPropertyOptional({ example: 'Conduce la furgoneta', nullable: true })
  description: string | null;
}

export class VolunteerPreachingGroupGuestDto {
  @ApiProperty({ example: 'Mary Johnson' })
  full_name: string;

  @ApiProperty({ example: false })
  is_minor: boolean;

  @ApiProperty({ example: false })
  is_group_contact: boolean;
}

export class VolunteerPreachingGroupGuestGroupDto {
  @ApiProperty({ example: 'GRP-014' })
  group_code: string;

  @ApiProperty({ example: 8 })
  guest_count: number;

  @ApiProperty({ type: [VolunteerPreachingGroupGuestDto] })
  guests: VolunteerPreachingGroupGuestDto[];
}

export class VolunteerPreachingGroupDto {
  @ApiPropertyOptional({ example: 'Grupo Centro', nullable: true })
  name: string | null;

  @ApiPropertyOptional({ example: 'Conduce la furgoneta', nullable: true })
  description: string | null;

  @ApiProperty({ type: [VolunteerPreachingGroupVolunteerDto] })
  volunteers: VolunteerPreachingGroupVolunteerDto[];

  @ApiProperty({ type: [VolunteerPreachingGroupGuestGroupDto] })
  guest_groups: VolunteerPreachingGroupGuestGroupDto[];
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

  @ApiProperty({ example: false })
  is_preaching_shift: boolean;

  @ApiProperty({ type: [VolunteerActivityVolunteerDto] })
  volunteers: VolunteerActivityVolunteerDto[];

  @ApiPropertyOptional({
    type: VolunteerPreachingGroupDto,
    nullable: true,
    description:
      'Grupo de predicación al que pertenece el voluntario en este turno (solo si is_preaching_shift es true y está asignado a un grupo)',
  })
  preaching_group: VolunteerPreachingGroupDto | null;
}
