import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportGroupResponseDto {
  @ApiProperty({ example: 12 })
  created: number;

  @ApiProperty({ example: 3 })
  updated: number;

  @ApiProperty({ example: 15 })
  total: number;

  @ApiPropertyOptional({ example: 1 })
  regions_not_found?: number;

  @ApiPropertyOptional({ example: 2 })
  hosts_not_found?: number;

  @ApiPropertyOptional({ example: 4 })
  deleted?: number;
}
