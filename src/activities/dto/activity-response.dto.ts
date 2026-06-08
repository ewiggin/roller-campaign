import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationPoint, LocationPointDto } from './location-point.dto';

export class VolunteerAvailableRoleDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Driver' })
  name: string;
}

export class ActivityVolunteerDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'V-001' })
  volunteer_code: string;

  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  role_id: string | null;

  @ApiPropertyOptional({ example: 'Driver', nullable: true })
  role_name: string | null;

  @ApiProperty({ type: [VolunteerAvailableRoleDto] })
  available_roles: VolunteerAvailableRoleDto[];
}

export class ActivityGuestGroupDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'GRP-001' })
  group_code: string;

  @ApiProperty({ example: 12 })
  guest_count: number;
}

export class VolunteerRoleRefDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Driver' })
  name: string;
}

export class AvailableVolunteerForActivityDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'V-001' })
  volunteer_code: string;

  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiProperty({ type: [VolunteerRoleRefDto] })
  roles: VolunteerRoleRefDto[];

  @ApiProperty({
    example: false,
    description: 'True if assigned to another overlapping activity',
  })
  already_in_activity: boolean;
}

export class AvailableGroupForActivityDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'GRP-001' })
  group_code: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  host_id: string | null;

  @ApiPropertyOptional({ example: 'Hotel Campanile', nullable: true })
  host_name: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  host_lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  host_lng: number | null;

  @ApiPropertyOptional({
    example: 3.2,
    nullable: true,
    description:
      'Distance in km from activity location to host. Null if either location is missing.',
  })
  distance_km: number | null;

  @ApiProperty({ example: 12 })
  guest_count: number;

  @ApiProperty({
    example: false,
    description:
      'True if assigned to another activity overlapping in date+time',
  })
  already_in_activity: boolean;

  @ApiProperty({
    example: false,
    description:
      "True if the activity time overlaps with the host congregation's meeting schedule",
  })
  host_schedule_conflict: boolean;

  @ApiProperty({
    example: 1,
    description:
      'Number of preaching shift activities this group is already assigned to (excluding this activity)',
  })
  preaching_shifts_count: number;
}

export class PreachingGroupVolunteerDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'V-001' })
  volunteer_code: string;

  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  role_id: string | null;

  @ApiPropertyOptional({ example: 'Driver', nullable: true })
  role_name: string | null;

  @ApiProperty({ type: [VolunteerAvailableRoleDto] })
  available_roles: VolunteerAvailableRoleDto[];

  @ApiPropertyOptional({ example: 'Conduce la furgoneta', nullable: true })
  description: string | null;
}

export class PreachingGroupDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiPropertyOptional({ example: 'Grupo Centro', nullable: true })
  name: string | null;

  @ApiProperty({ example: 0 })
  position: number;

  @ApiProperty({ type: [PreachingGroupVolunteerDto] })
  volunteers: PreachingGroupVolunteerDto[];

  @ApiProperty({ type: [ActivityGuestGroupDto] })
  guest_groups: ActivityGuestGroupDto[];
}

export class ActivityResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  series_id: string | null;

  @ApiProperty({ example: 'Airport pickup' })
  name: string;

  @ApiPropertyOptional({ example: '✈️', nullable: true })
  icon: string | null;

  @ApiPropertyOptional({ example: 'Actividad de bienvenida', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'draft', enum: ['draft', 'published'] })
  status: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  host_id: string | null;

  @ApiPropertyOptional({ example: 'Congregación Norte', nullable: true })
  host_name: string | null;

  @ApiProperty({ example: '2024-06-15' })
  date: string;

  @ApiProperty({ example: '09:00' })
  start_time: string;

  @ApiProperty({ example: '13:00' })
  end_time: string;

  @ApiPropertyOptional({ type: [LocationPointDto], nullable: true })
  activity_locations: LocationPoint[] | null;

  @ApiProperty({ example: false })
  is_preaching_shift: boolean;

  @ApiProperty({ type: [ActivityVolunteerDto] })
  volunteers: ActivityVolunteerDto[];

  @ApiProperty({ example: 2 })
  volunteer_count: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  required_volunteers: number | null;

  @ApiProperty({ type: [ActivityGuestGroupDto] })
  guest_groups: ActivityGuestGroupDto[];

  @ApiProperty({ example: 48 })
  total_guests_assigned: number;

  @ApiProperty({
    type: [PreachingGroupDto],
    description:
      'Grupos de predicación de la actividad (solo aplica cuando is_preaching_shift es true)',
  })
  preaching_groups: PreachingGroupDto[];

  @ApiPropertyOptional({ example: 50, nullable: true })
  max_guests: number | null;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}
