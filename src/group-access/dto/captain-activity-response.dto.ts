import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationPoint } from '../../activities/dto/location-point.dto';

export class CaptainActivityResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Airport pickup' })
  name: string;

  @ApiPropertyOptional({ example: '✈️', nullable: true })
  icon: string | null;

  @ApiPropertyOptional({ example: 'Actividad de bienvenida', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2024-06-15' })
  date: string;

  @ApiProperty({ example: '09:00' })
  start_time: string;

  @ApiProperty({ example: '13:00' })
  end_time: string;

  @ApiPropertyOptional({ nullable: true })
  activity_locations: LocationPoint[] | null;

  @ApiPropertyOptional({ example: 50, nullable: true })
  max_guests: number | null;

  @ApiProperty({ example: 12 })
  enrolled_count: number;

  @ApiProperty({ example: false })
  is_enrolled: boolean;
}
