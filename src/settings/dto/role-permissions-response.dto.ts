import { ApiProperty } from '@nestjs/swagger';

export class RolePermissionsResponseDto {
  @ApiProperty({ example: ['dashboard', 'regions', 'guests'] })
  region_admin: string[];

  @ApiProperty({ example: [] })
  volunteer: string[];

  @ApiProperty({ example: [] })
  volunteer_manager: string[];

  @ApiProperty({ example: [] })
  guest_manager: string[];

  @ApiProperty({ example: [] })
  host_manager: string[];
}
