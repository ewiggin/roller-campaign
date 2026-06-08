import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PresignUploadRequestDto {
  @ApiProperty({ example: 'documents/2024/report.pdf' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  contentType: string;

  @ApiPropertyOptional({
    example: 300,
    description: 'Presigned URL TTL in seconds (default 300)',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  expiresIn?: number;
}
