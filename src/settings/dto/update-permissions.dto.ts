import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdatePermissionsDto {
  @ApiPropertyOptional({ example: ['dashboard', 'regions', 'guests'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  region_admin?: string[];

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  volunteer?: string[];

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  volunteer_manager?: string[];

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guest_manager?: string[];

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  host_manager?: string[];
}
