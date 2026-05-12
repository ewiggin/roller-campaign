import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';
import { ImportGuestRowDto } from './import-parse-response.dto';

export class ImportCommitDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  regionId: string;

  // Rows are validated during the parse step; no re-validation here to avoid
  // the whitelist pipe stripping fields from un-decorated ImportGuestRowDto properties.
  @ApiProperty({ type: [ImportGuestRowDto] })
  @IsArray()
  rows: ImportGuestRowDto[];
}

export class ImportCommitResponseDto {
  @ApiProperty({ example: 145 })
  created_guests: number;

  @ApiProperty({ example: 12 })
  created_groups: number;

  @ApiProperty({ example: 145 })
  total: number;
}
