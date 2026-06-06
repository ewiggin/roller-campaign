import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
  description?: string | null;
}

export class LocationPointDto {
  @ApiProperty({ example: 'Calle Gran Vía 1, Madrid' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 40.4168 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: -3.7038 })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 'Terminal 4', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;
}
