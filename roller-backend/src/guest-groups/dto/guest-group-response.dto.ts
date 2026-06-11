import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GuestGroupResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'GRP-001' })
  group_code: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
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

  @ApiPropertyOptional({
    example: 'mixed',
    enum: ['men_only', 'mixed', 'women_only'],
    nullable: true,
  })
  composition: 'men_only' | 'mixed' | 'women_only' | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  car_count: number | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  agg_guest_count: number | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  agg_minor_count: number | null;

  @ApiPropertyOptional({
    example: { confirmed: 2, arrived: 1 },
    nullable: true,
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  agg_status_counts: Record<string, number> | null;

  @ApiPropertyOptional({ example: 40.417, nullable: true })
  agg_avg_lat: number | null;

  @ApiPropertyOptional({ example: -3.704, nullable: true })
  agg_avg_lng: number | null;

  @ApiPropertyOptional({
    example: ['Spanish', 'English'],
    type: [String],
    nullable: true,
  })
  agg_languages: string[] | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  agg_speaks_english: boolean | null;

  @ApiPropertyOptional({ example: 5, nullable: true })
  agg_car_seats: number | null;

  @ApiPropertyOptional({ example: '2026-06-10T10:00:00.000Z', nullable: true })
  agg_computed_at: string | null;

  @ApiPropertyOptional({
    example: false,
    nullable: true,
    description:
      'true when the stored snapshot no longer matches the live guest data; null when there is no snapshot',
  })
  agg_stale: boolean | null;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}
