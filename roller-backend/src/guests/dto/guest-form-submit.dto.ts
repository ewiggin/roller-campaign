import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class GuestFormSubmitDto {
  @ApiProperty({ example: 'Juan García López' })
  @IsString()
  full_name: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Madrid' })
  @IsString()
  origin_city: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  car_seats: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  speaks_english: boolean;

  @ApiPropertyOptional({ example: ['Inglés', 'Catalán'], nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  other_languages?: string[] | null;

  @ApiProperty({ example: '2024-06-14' })
  @IsString()
  real_arrival: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  real_arrival_time: string;

  @ApiProperty({ example: '2024-06-21' })
  @IsString()
  real_departure: string;

  @ApiProperty({ example: '16:00' })
  @IsString()
  real_departure_time: string;

  @ApiProperty({ example: 'Calle Mayor 1, Barcelona' })
  @IsString()
  hosting_address: string;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  @IsOptional()
  @IsNumber()
  lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  @IsOptional()
  @IsNumber()
  lng: number | null;

  @ApiProperty({ example: 'Avión' })
  @IsString()
  transport_mode: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  arrival_other_transport: string | null;

  @ApiPropertyOptional({ example: 'IB1234', nullable: true })
  @IsOptional()
  @IsString()
  arrival_flight: string | null;

  @ApiProperty({ example: false })
  @IsBoolean()
  needs_airport_transfer: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  terms_accepted: boolean;

  @ApiProperty({ example: '1.0' })
  @IsString()
  terms_version: string;
}
