import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuestResponseDto } from './guest-response.dto';

export class GuestMeRegionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Madrid Norte' })
  name: string;

  @ApiPropertyOptional({ example: '2024-06-15', nullable: true })
  event_start_date: string | null;

  @ApiPropertyOptional({ example: '2024-06-22', nullable: true })
  event_end_date: string | null;
}

export class GuestMeHostDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Congregación Norte' })
  name: string;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Madrid', nullable: true })
  address: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  lng: number | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description: '1=Mon…7=Sun',
  })
  weekday_meeting_day: number | null;

  @ApiPropertyOptional({ example: '19:30', nullable: true })
  weekday_meeting_time: string | null;

  @ApiPropertyOptional({
    example: 6,
    nullable: true,
    description: '1=Mon…7=Sun',
  })
  weekend_meeting_day: number | null;

  @ApiPropertyOptional({ example: '10:00', nullable: true })
  weekend_meeting_time: string | null;
}

export class GuestTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiProperty({ example: 'http://localhost:4300/access?token=eyJ...' })
  access_url: string;
}

export class GuestMeResponseDto extends GuestResponseDto {
  @ApiProperty({ type: GuestMeRegionDto })
  region: GuestMeRegionDto;

  @ApiPropertyOptional({ type: GuestMeHostDto, nullable: true })
  host: GuestMeHostDto | null;
}
