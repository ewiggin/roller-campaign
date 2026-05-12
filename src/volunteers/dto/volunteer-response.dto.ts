import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ example: 'Solo mañana', nullable: true })
  note: string | null;
}
