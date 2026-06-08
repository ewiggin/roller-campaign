import { ApiProperty } from '@nestjs/swagger';

export class PresignUploadResponseDto {
  @ApiProperty({
    example:
      'https://bucket.s3.us-east-1.amazonaws.com/documents/report.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&...',
  })
  url: string;

  @ApiProperty({ example: 'documents/2024/report.pdf' })
  key: string;

  @ApiProperty({ example: 300 })
  expiresIn: number;
}
