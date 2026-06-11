import { ApiProperty } from '@nestjs/swagger';

export class GroupLookupResponseDto {
  @ApiProperty({ example: 'GRUPO-001' })
  group_code: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  group_id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  region_id: string;

  @ApiProperty({ example: 'Madrid' })
  region_name: string;
}
