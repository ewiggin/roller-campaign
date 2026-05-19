import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { CreateActivityDto } from './create-activity.dto';

export type RepeatType = 'daily' | 'weekly' | 'same_day';

export class RepetitionDto {
  @ApiProperty({ example: 'daily', enum: ['daily', 'weekly', 'same_day'] })
  @IsIn(['daily', 'weekly', 'same_day'])
  type: RepeatType;

  @ApiProperty({ example: 5, description: 'Total occurrences including the first one (2–30)' })
  @IsInt()
  @Min(2)
  @Max(30)
  count: number;
}

export class CreateActivityBatchDto extends CreateActivityDto {
  @ApiProperty({ type: RepetitionDto })
  @ValidateNested()
  @Type(() => RepetitionDto)
  repetition: RepetitionDto;
}
