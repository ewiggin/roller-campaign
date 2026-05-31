import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class VolunteerFormSubmitDto {
  @ApiProperty({ example: 'carlos@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Barcelona' })
  @IsOptional()
  @IsString()
  hosting_address?: string;

  @ApiPropertyOptional({ example: 41.3851 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 2.1734 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=41.3851,2.1734' })
  @IsOptional()
  @IsString()
  maps_link?: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(8)
  car_seats: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  monday_morning: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  monday_afternoon: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  tuesday_morning: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  tuesday_afternoon: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  wednesday_morning: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  wednesday_afternoon: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  thursday_morning: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  thursday_afternoon: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  friday_morning: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  friday_afternoon: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  saturday_morning: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  saturday_afternoon: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  sunday_morning: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  sunday_afternoon: boolean;
}
