import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type {
  Guest,
  GuestListResponse,
  GuestListQuery,
  ImportParseResponse,
  ImportCommitResponse,
  ImportGuestRow,
} from '../models/guest.model';

@Injectable({ providedIn: 'root' })
export class GuestsService {
  private readonly http = inject(HttpClient);

  getAll(query: GuestListQuery = {}) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.groupId) params = params.set('groupId', query.groupId);
    if (query.status) params = params.set('status', query.status);
    if (query.search) params = params.set('search', query.search);
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    return this.http.get<GuestListResponse>('/api/guests', { params });
  }

  getOne(id: string) {
    return this.http.get<Guest>(`/api/guests/${id}`);
  }

  update(id: string, payload: Partial<Guest>) {
    return this.http.patch<Guest>(`/api/guests/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/guests/${id}`);
  }

  migrate(id: string, targetGroupId: string) {
    return this.http.post<Guest>(`/api/guests/${id}/migrate`, { targetGroupId });
  }

  generateToken(id: string) {
    return this.http.get<{ token: string; access_url: string }>(`/api/guests/${id}/token`);
  }

  parseImport(file: File, regionId?: string) {
    const form = new FormData();
    form.append('file', file);
    const qs = regionId ? `?regionId=${regionId}` : '';
    return this.http.post<ImportParseResponse>(`/api/guests/import/parse${qs}`, form);
  }

  commitImport(rows: ImportGuestRow[], updateRows?: ImportGuestRow[], regionId?: string) {
    return this.http.post<ImportCommitResponse>('/api/guests/import/commit', {
      ...(regionId ? { regionId } : {}),
      rows,
      ...(updateRows?.length ? { updateRows } : {}),
    });
  }

  exportExcel(query: GuestListQuery = {}) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.groupId) params = params.set('groupId', query.groupId);
    if (query.status) params = params.set('status', query.status);
    if (query.search) params = params.set('search', query.search);
    return this.http.get('/api/guests/export', { params, responseType: 'blob' });
  }

  downloadTemplate() {
    return this.http.get('/api/guests/import/template', { responseType: 'blob' });
  }

  exportNotFound(rows: ImportGuestRow[]) {
    return this.http.post('/api/guests/import/export-not-found', { rows }, { responseType: 'blob' });
  }
}
