import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateGuestGroupDto {
  @ApiProperty({ example: 'GRP-001' })
  @IsString()
  @IsNotEmpty()
  group_code: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  region_id: string;
}
