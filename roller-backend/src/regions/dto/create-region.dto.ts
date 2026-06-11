import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRegionDto {
  @ApiProperty({ example: 'Madrid Norte' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '2024-06-15' })
  @IsOptional()
  @IsISO8601({ strict: true })
  event_start_date?: string | null;

  @ApiPropertyOptional({ example: '2024-06-22' })
  @IsOptional()
  @IsISO8601({ strict: true })
  event_end_date?: string | null;
}
