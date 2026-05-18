import { SetMetadata } from '@nestjs/common';
import type { AuditAction, AuditResource } from '../entities/audit-log.entity';

export const AUDIT_KEY = 'audit_meta';

export interface AuditMeta {
  action: AuditAction;
  resource: AuditResource;
}

export const Audit = (action: AuditAction, resource: AuditResource) =>
  SetMetadata(AUDIT_KEY, { action, resource });
