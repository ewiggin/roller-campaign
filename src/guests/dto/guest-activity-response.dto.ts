import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LocationPoint,
  LocationPointDto,
} from '../../activities/dto/location-point.dto';

export class GuestActivityVolunteerDto {
  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 'carlos@example.com', nullable: true })
  email: string | null;
}

export class GuestActivityResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Airport pickup' })
  name: string;

  @ApiPropertyOptional({ example: '✈️', nullable: true })
  icon: string | null;

  @ApiPropertyOptional({
    example: 'Traslado desde el aeropuerto',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: '2024-06-15' })
  date: string;

  @ApiProperty({ example: '09:00' })
  start_time: string;

  @ApiProperty({ example: '13:00' })
  end_time: string;

  @ApiPropertyOptional({ type: [LocationPointDto], nullable: true })
  activity_locations: LocationPoint[] | null;

  @ApiProperty({ type: [GuestActivityVolunteerDto] })
  volunteers: GuestActivityVolunteerDto[];
}
