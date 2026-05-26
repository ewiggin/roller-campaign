import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateActivityDto } from './create-activity.dto';

export class UpdateActivityDto extends PartialType(CreateActivityDto) {
  @ApiPropertyOptional({ example: true, description: 'If true, removes this activity from its series' })
  @IsOptional()
  @IsBoolean()
  detach_from_series?: boolean;
}
