import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationPointDto } from '../../activities/dto/location-point.dto';

export class CartResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  host_id: string | null;

  @ApiPropertyOptional({ example: 'Congregación Norte', nullable: true })
  host_name: string | null;

  @ApiProperty({ example: '1' })
  number: string;

  @ApiPropertyOptional({ type: LocationPointDto, nullable: true })
  primary_location: LocationPointDto | null;

  @ApiPropertyOptional({ type: LocationPointDto, nullable: true })
  secondary_location: LocationPointDto | null;

  @ApiPropertyOptional({
    example: 'carts/images/1234-photo.jpg',
    nullable: true,
  })
  image_key: string | null;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  updated_at: Date;
}
