import { ApiProperty } from '@nestjs/swagger';

export class VersionResponseDto {
  @ApiProperty({ example: 'roller-backend' })
  name: string;

  @ApiProperty({ example: '0.27.0' })
  version: string;

  @ApiProperty({ example: 'production' })
  environment: string;
}
