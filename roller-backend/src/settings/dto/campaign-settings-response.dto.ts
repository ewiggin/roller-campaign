import { ApiProperty } from '@nestjs/swagger';

export class CampaignSettingsResponseDto {
  @ApiProperty({ example: 3 })
  max_activities_per_group: number;

  @ApiProperty({ example: 3 })
  max_preaching_shifts_per_group: number;

  @ApiProperty({ example: 3 })
  max_guests_per_preaching_group: number;

  @ApiProperty()
  updated_at: Date;
}
