import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PresignDownloadRequestDto {
  @ApiProperty({ example: 'documents/2024/report.pdf' })
  @IsString()
  key: string;

  @ApiPropertyOptional({
    example: 3600,
    description: 'Presigned URL TTL in seconds (default 3600)',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  expiresIn?: number;
}
