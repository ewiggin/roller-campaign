import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePreachingGroupDto {
  @ApiPropertyOptional({ example: 'Grupo Centro', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;
}

export class UpdatePreachingGroupDto {
  @ApiPropertyOptional({ example: 'Grupo Centro', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @ApiPropertyOptional({
    example: 'territories/activityId-groupId-1749480000000-territory.pdf',
    nullable: true,
    description: 'Storage object key for the territory file',
  })
  @IsOptional()
  @IsString()
  territory_key?: string | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
