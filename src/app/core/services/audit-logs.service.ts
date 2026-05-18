import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { AuditLogPage, AuditLogQuery } from '../models/audit-log.model';

@Injectable({ providedIn: 'root' })
export class AuditLogsService {
  private readonly http = inject(HttpClient);

  getAll(query: AuditLogQuery = {}) {
    let params = new HttpParams();
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    if (query.resource) params = params.set('resource', query.resource);
    if (query.action) params = params.set('action', query.action);
    if (query.actor_email) params = params.set('actor_email', query.actor_email);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    return this.http.get<AuditLogPage>('/api/audit-logs', { params });
  }

  exportCsv(query: AuditLogQuery = {}) {
    return this.getAll({ ...query, limit: 5000, page: 1 });
  }
}
