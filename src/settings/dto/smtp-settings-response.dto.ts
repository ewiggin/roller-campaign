import { ApiProperty } from '@nestjs/swagger';

export class SmtpSettingsResponseDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  host: string | null;

  @ApiProperty({ example: 587 })
  port: number | null;

  @ApiProperty({ example: false })
  secure: boolean;

  @ApiProperty({ example: 'user@gmail.com' })
  user: string | null;

  @ApiProperty({ example: 'Roller Campaign' })
  from_name: string | null;

  @ApiProperty({ example: 'noreply@example.com' })
  from_email: string | null;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updated_at: Date;
}
