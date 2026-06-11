export type AuditAction =
  | 'login'
  | 'list'
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'import'
  | 'migrate'
  | 'generate_token'
  | 'form_lookup'
  | 'form_submit';

export type AuditResource =
  | 'auth'
  | 'user'
  | 'region'
  | 'guest_group'
  | 'guest'
  | 'host'
  | 'volunteer'
  | 'activity';

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: AuditAction;
  resource: AuditResource;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditLogPage {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  resource?: string;
  action?: string;
  actor_email?: string;
  from?: string;
  to?: string;
}
