import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '../../users/entities/user.entity';

export class RegionCoordinatorDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'coordinador@roller.local' })
  email: string;

  @ApiProperty({
    example: 'region_admin',
    enum: ['superadmin', 'region_admin', 'volunteer', 'guest'],
  })
  role: UserRole;
}

export class RegionResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Madrid Norte' })
  name: string;

  @ApiPropertyOptional({ example: '2024-06-15', nullable: true })
  event_start_date: string | null;

  @ApiPropertyOptional({ example: '2024-06-22', nullable: true })
  event_end_date: string | null;

  @ApiProperty({ type: [RegionCoordinatorDto] })
  coordinators: RegionCoordinatorDto[];

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}
