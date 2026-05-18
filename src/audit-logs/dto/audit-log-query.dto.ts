import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class AuditLogQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Página (1-indexed)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ example: 'guest', description: 'Filtrar por recurso' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ example: 'read', description: 'Filtrar por acción' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'admin@example.com', description: 'Filtrar por email del actor' })
  @IsOptional()
  @IsString()
  actor_email?: string;

  @ApiPropertyOptional({ example: '2026-05-01', description: 'Desde fecha (ISO)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-05-31', description: 'Hasta fecha (ISO)' })
  @IsOptional()
  @IsString()
  to?: string;
}
