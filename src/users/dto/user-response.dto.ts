import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'coordinador@roller.local' })
  email: string;

  @ApiProperty({
    example: 'region_admin',
    enum: ['superadmin', 'region_admin', 'volunteer', 'guest'],
  })
  role: UserRole;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}
