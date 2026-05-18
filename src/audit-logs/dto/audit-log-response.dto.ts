import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-05-18T10:00:00.000Z' })
  timestamp: Date;

  @ApiPropertyOptional({ example: 'uuid-of-user' })
  actor_id: string | null;

  @ApiPropertyOptional({ example: 'admin@example.com' })
  actor_email: string | null;

  @ApiPropertyOptional({ example: 'superadmin' })
  actor_role: string | null;

  @ApiProperty({ example: 'read' })
  action: string;

  @ApiProperty({ example: 'guest' })
  resource: string;

  @ApiPropertyOptional({ example: 'uuid-of-resource' })
  resource_id: string | null;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  ip_address: string | null;

  @ApiPropertyOptional({ example: 'Mozilla/5.0...' })
  user_agent: string | null;

  @ApiPropertyOptional({ example: null })
  metadata: Record<string, unknown> | null;
}

export class AuditLogPageResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data: AuditLogResponseDto[];

  @ApiProperty({ example: 1250 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 50 })
  limit: number;
}
