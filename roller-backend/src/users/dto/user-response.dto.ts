import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '../entities/user.entity';

export class UserRegionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Region Norte' })
  name: string;
}

export class UserResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'coordinador@roller.local' })
  email: string;

  @ApiProperty({
    example: 'region_admin',
    enum: [
      'superadmin',
      'region_admin',
      'volunteer',
      'volunteer_manager',
      'guest_manager',
      'host_manager',
      'guest',
    ],
  })
  role: UserRole;

  @ApiProperty({ type: [UserRegionDto] })
  regions: UserRegionDto[];

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}
