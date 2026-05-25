import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GuestGroupResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'GRP-001' })
  group_code: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  host_id: string | null;

  @ApiPropertyOptional({ example: 'Congregación Norte', nullable: true })
  host_name: string | null;

  @ApiProperty({ example: 3 })
  guest_count: number;

  @ApiProperty({ example: ['Spanish', 'English'], type: [String] })
  languages: string[];

  @ApiProperty({ example: 5 })
  total_car_seats: number;

  @ApiPropertyOptional({ example: '2024-06-14', nullable: true })
  available_from: string | null;

  @ApiPropertyOptional({ example: '2024-06-21', nullable: true })
  available_to: string | null;

  @ApiPropertyOptional({ example: 'mixed', enum: ['men_only', 'mixed', 'women_only'], nullable: true })
  composition: 'men_only' | 'mixed' | 'women_only' | null;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}
