import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { LocationPointDto } from '../../activities/dto/location-point.dto';

export class CreateCartDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  host_id?: string | null;

  @ApiProperty({ example: '1' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ type: LocationPointDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationPointDto)
  primary_location?: LocationPointDto | null;

  @ApiPropertyOptional({ type: LocationPointDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationPointDto)
  secondary_location?: LocationPointDto | null;

  @ApiPropertyOptional({
    example: 'carts/images/1234-photo.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  image_key?: string | null;
}
