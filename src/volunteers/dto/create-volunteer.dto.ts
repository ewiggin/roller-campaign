import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
