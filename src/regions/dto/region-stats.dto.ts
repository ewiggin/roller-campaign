import { ApiProperty } from '@nestjs/swagger';

export class RegionStatsDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiProperty({ example: 'Madrid Norte' })
  region_name: string;

  @ApiProperty({ example: '2024-06-15', nullable: true })
  event_start_date: string | null;

  @ApiProperty({ example: '2024-06-22', nullable: true })
  event_end_date: string | null;

  @ApiProperty({ example: 120 })
  guest_count: number;

  @ApiProperty({ example: 45 })
  volunteer_count: number;

  @ApiProperty({ example: 12 })
  activity_count: number;

  @ApiProperty({ example: 8 })
  covered_activities: number;
}
