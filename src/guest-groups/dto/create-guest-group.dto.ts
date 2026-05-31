import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateGuestGroupDto {
  @ApiProperty({ example: 'GRP-001' })
  @IsString()
  @IsNotEmpty()
  group_code: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;

  @ApiPropertyOptional({ example: '2024-06-14', nullable: true })
  @IsOptional()
  @IsString()
  available_from?: string | null;

  @ApiPropertyOptional({ example: '2024-06-21', nullable: true })
  @IsOptional()
  @IsString()
  available_to?: string | null;

  @ApiPropertyOptional({
    example: 'mixed',
    enum: ['men_only', 'mixed', 'women_only'],
    nullable: true,
  })
  @IsOptional()
  @IsIn(['men_only', 'mixed', 'women_only'])
  composition?: 'men_only' | 'mixed' | 'women_only' | null;
}
