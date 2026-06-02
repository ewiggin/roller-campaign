import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateHostDto {
  @ApiProperty({ example: 'Congregación Norte' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Madrid' })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ example: 40.4168 })
  @IsOptional()
  @IsNumber()
  lat?: number | null;

  @ApiPropertyOptional({ example: -3.7038 })
  @IsOptional()
  @IsNumber()
  lng?: number | null;

  @ApiPropertyOptional({ example: 2, description: '1=Mon … 7=Sun' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekday_meeting_day?: number | null;

  @ApiPropertyOptional({ example: '19:30' })
  @IsOptional()
  @IsString()
  weekday_meeting_time?: string | null;

  @ApiPropertyOptional({ example: 7, description: '1=Mon … 7=Sun' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekend_meeting_day?: number | null;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  weekend_meeting_time?: string | null;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;
}

export class UpdateHostDto {
  @ApiPropertyOptional({ example: 'Congregación Norte' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Madrid' })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ example: 40.4168 })
  @IsOptional()
  @IsNumber()
  lat?: number | null;

  @ApiPropertyOptional({ example: -3.7038 })
  @IsOptional()
  @IsNumber()
  lng?: number | null;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekday_meeting_day?: number | null;

  @ApiPropertyOptional({ example: '19:30' })
  @IsOptional()
  @IsString()
  weekday_meeting_time?: string | null;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekend_meeting_day?: number | null;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  weekend_meeting_time?: string | null;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;
}

export class HostResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Congregación Norte' })
  name: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Madrid', nullable: true })
  address: string | null;

  @ApiPropertyOptional({ example: 40.4168, nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ example: -3.7038, nullable: true })
  lng: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  weekday_meeting_day: number | null;

  @ApiPropertyOptional({ example: '19:30', nullable: true })
  weekday_meeting_time: string | null;

  @ApiPropertyOptional({ example: 7, nullable: true })
  weekend_meeting_day: number | null;

  @ApiPropertyOptional({ example: '10:00', nullable: true })
  weekend_meeting_time: string | null;

  @ApiPropertyOptional({ example: 150, nullable: true })
  capacity: number | null;

  @ApiProperty({ example: 0 })
  group_count: number;

  @ApiProperty({ example: 0 })
  guest_count: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updated_at: Date;
}

export class GroupSuggestionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'GRP-001' })
  group_code: string;

  @ApiProperty({ example: 5 })
  guest_count: number;

  @ApiPropertyOptional({
    example: 2.4,
    nullable: true,
    description: 'Distance in km from host, null if no guest coordinates',
  })
  distance_km: number | null;

  @ApiProperty({ example: ['Spanish', 'English'], type: [String] })
  languages: string[];
}

export class GroupSuggestionsResponseDto {
  @ApiProperty({ type: [GroupSuggestionDto] })
  assigned: GroupSuggestionDto[];

  @ApiProperty({ type: [GroupSuggestionDto] })
  available: GroupSuggestionDto[];
}
