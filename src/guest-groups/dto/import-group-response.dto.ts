import { ApiProperty } from '@nestjs/swagger';

export class ImportGroupResponseDto {
  @ApiProperty({ example: 12 })
  created: number;

  @ApiProperty({ example: 3 })
  skipped: number;

  @ApiProperty({ example: 15 })
  total: number;
}
