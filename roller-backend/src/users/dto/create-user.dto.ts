import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import type { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'coordinador@roller.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'contraseña-segura' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 'region_admin',
    enum: [
      'superadmin',
      'region_admin',
      'volunteer',
      'volunteer_manager',
      'guest_manager',
      'host_manager',
      'guest',
    ],
  })
  @IsOptional()
  @IsEnum([
    'superadmin',
    'region_admin',
    'volunteer',
    'volunteer_manager',
    'guest_manager',
    'host_manager',
    'guest',
  ])
  role?: UserRole;

  @ApiPropertyOptional({ example: ['uuid1', 'uuid2'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  region_ids?: string[];
}
