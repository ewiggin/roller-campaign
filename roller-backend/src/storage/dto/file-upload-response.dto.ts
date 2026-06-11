import { ApiProperty } from '@nestjs/swagger';

export class FileUploadResponseDto {
  @ApiProperty({ example: 'activities/1749123456789-photo.jpg' })
  key: string;

  @ApiProperty({ example: 245760, description: 'Stored file size in bytes' })
  size: number;
}
