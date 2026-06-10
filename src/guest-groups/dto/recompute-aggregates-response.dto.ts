import { ApiProperty } from '@nestjs/swagger';

export class RecomputeAggregatesResponseDto {
  @ApiProperty({ example: 42 })
  groups_updated: number;

  @ApiProperty({ example: '2026-06-10T10:00:00.000Z' })
  computed_at: string;
}
