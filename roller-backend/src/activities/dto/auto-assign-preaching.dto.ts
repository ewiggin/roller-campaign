import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class AutoAssignPreachingDto {
  @ApiPropertyOptional({
    enum: ['distance', 'group_size'],
    default: 'distance',
  })
  @IsOptional()
  @IsIn(['distance', 'group_size'])
  sort_by?: 'distance' | 'group_size';
}
