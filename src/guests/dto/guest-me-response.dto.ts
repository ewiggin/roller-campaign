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

export class GuestTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiProperty({ example: 'http://localhost:4300/access?token=eyJ...' })
  access_url: string;
}

export class GuestMeResponseDto extends GuestResponseDto {
  @ApiProperty({ type: GuestMeRegionDto })
  region: GuestMeRegionDto;
}
