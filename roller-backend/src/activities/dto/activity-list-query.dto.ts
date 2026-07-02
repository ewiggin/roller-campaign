import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ActivityListQueryDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ example: 'Campaign kickoff' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: '2024-06-15' })
  @IsOptional()
  @IsISO8601({ strict: true })
  date?: string;

  @ApiPropertyOptional({ example: '2024-06-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2024-06-30' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateTo?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  hostId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  volunteerId?: string;

  @ApiPropertyOptional({ example: 'published', enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_preaching_shift?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_food_shift?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
