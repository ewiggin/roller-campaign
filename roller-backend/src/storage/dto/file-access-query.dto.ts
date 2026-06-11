import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class FileAccessQueryDto {
  @ApiProperty({ example: 'activities/1749123456789-photo.jpg' })
  @IsString()
  key: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Short-lived signed token issued by the presign endpoints (local storage driver)',
  })
  @IsString()
  token: string;
}
