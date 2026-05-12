import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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
    enum: ['superadmin', 'region_admin', 'volunteer', 'guest'],
  })
  @IsOptional()
  @IsEnum(['superadmin', 'region_admin', 'volunteer', 'guest'])
  role?: UserRole;
}
