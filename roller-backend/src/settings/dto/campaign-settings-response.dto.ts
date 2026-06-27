import { ApiProperty } from '@nestjs/swagger';

export class CampaignSettingsResponseDto {
  @ApiProperty({ example: 3 })
  max_activities_per_group: number;

  @ApiProperty({ example: 3 })
  max_preaching_shifts_per_group: number;

  @ApiProperty()
  updated_at: Date;
}
