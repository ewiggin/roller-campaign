import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateVolunteerDto {
  @ApiProperty({ example: 'V-001' })
  @IsString()
  @IsNotEmpty()
  volunteer_code: string;

  @ApiProperty({ example: 'Carlos López' })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiPropertyOptional({ example: 'carlos@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: '+34 600 000 000' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  user_id?: string | null;

  @ApiPropertyOptional({ example: ['123e4567-e89b-12d3-a456-426614174000'] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  role_ids?: string[];

  @ApiPropertyOptional({ example: ['123e4567-e89b-12d3-a456-426614174000'] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  region_ids?: string[];

  @ApiPropertyOptional({ example: 'Passatge Bernat Metge, 14, 17800 Olot' })
  @IsOptional()
  @IsString()
  hosting_address?: string | null;

  @ApiPropertyOptional({ example: 42.1837 })
  @IsOptional()
  @IsNumber()
  lat?: number | null;

  @ApiPropertyOptional({ example: 2.4775 })
  @IsOptional()
  @IsNumber()
  lng?: number | null;

  @ApiPropertyOptional({ example: 'https://www.google.com/maps?q=42.18,2.47' })
  @IsOptional()
  @IsString()
  maps_link?: string | null;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  car_seats?: number | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  monday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  monday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  tuesday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  tuesday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  wednesday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  wednesday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  thursday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  thursday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  friday_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  friday_afternoon?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  saturday_morning?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  saturday_afternoon?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  sunday_morning?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  sunday_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  saturday_prev_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  saturday_prev_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  sunday_prev_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  sunday_prev_afternoon?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  monday_next_morning?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  monday_next_afternoon?: boolean;
}
