import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignGroupVolunteerDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  volunteerId: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  role_id?: string | null;

  @ApiPropertyOptional({ example: 'Conduce la furgoneta', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;
}

export class UpdateGroupVolunteerDescriptionDto {
  @ApiPropertyOptional({ example: 'Conduce la furgoneta', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description: string | null;
}
