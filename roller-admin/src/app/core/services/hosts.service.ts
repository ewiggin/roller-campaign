import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  Host,
  CreateHostPayload,
  UpdateHostPayload,
  GroupSuggestionsResponse,
  ImportHostRow,
  ImportHostParseResponse,
  ImportHostCommitResponse,
} from '../models/host.model';

@Injectable({ providedIn: 'root' })
export class HostsService {
  private readonly http = inject(HttpClient);

  getAll(regionId?: string) {
    const qs = regionId ? `?regionId=${regionId}` : '';
    return this.http.get<Host[]>(`/api/hosts${qs}`);
  }

  getOne(id: string) {
    return this.http.get<Host>(`/api/hosts/${id}`);
  }

  getGroupSuggestions(id: string) {
    return this.http.get<GroupSuggestionsResponse>(`/api/hosts/${id}/group-suggestions`);
  }

  create(payload: CreateHostPayload) {
    return this.http.post<Host>('/api/hosts', payload);
  }

  update(id: string, payload: UpdateHostPayload) {
    return this.http.patch<Host>(`/api/hosts/${id}`, payload);
  }

  downloadGuestsExcel(id: string) {
    return this.http.get(`/api/hosts/${id}/guests/export`, { responseType: 'blob' });
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/hosts/${id}`);
  }

  exportExcel(regionId?: string) {
    const qs = regionId ? `?regionId=${regionId}` : '';
    return this.http.get(`/api/hosts/export${qs}`, { responseType: 'blob' });
  }

  exportAssignedGroupsPdf(regionId: string) {
    return this.http.get(`/api/hosts/export/assigned-groups/pdf?regionId=${regionId}`, {
      responseType: 'blob',
    });
  }

  downloadTemplate() {
    return this.http.get('/api/hosts/import/template', { responseType: 'blob' });
  }

  parseImport(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportHostParseResponse>('/api/hosts/import/parse', form);
  }

  commitImport(rows: ImportHostRow[], updateRows?: ImportHostRow[]) {
    return this.http.post<ImportHostCommitResponse>('/api/hosts/import/commit', {
      rows,
      ...(updateRows?.length ? { updateRows } : {}),
    });
  }
}
