import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSmtpSettingsDto {
  @ApiPropertyOptional({ example: 'smtp.gmail.com' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @ApiPropertyOptional({ example: 'user@gmail.com' })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional({ example: 'secret' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'Roller Campaign' })
  @IsOptional()
  @IsString()
  from_name?: string;

  @ApiPropertyOptional({ example: 'noreply@example.com' })
  @IsOptional()
  @IsString()
  from_email?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
