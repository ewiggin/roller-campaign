import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateActivityDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;

  @ApiProperty({ example: '2024-06-15' })
  @IsISO8601({ strict: true })
  date: string;

  @ApiProperty({ example: '09:00' })
  @Matches(TIME_REGEX, { message: 'start_time debe tener formato HH:MM' })
  start_time: string;

  @ApiProperty({ example: '13:00' })
  @Matches(TIME_REGEX, { message: 'end_time debe tener formato HH:MM' })
  end_time: string;

  @ApiPropertyOptional({ example: 'Actividad de bienvenida en el aeropuerto' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string | null;
}
