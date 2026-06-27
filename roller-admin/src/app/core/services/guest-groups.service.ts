import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  CreateGuestGroupPayload,
  GuestGroup,
  GuestGroupListResponse,
  ImportGroupCommitResponse,
  ImportGroupParseResponse,
  ImportGroupRow,
  RecomputeAggregatesResult,
  UpdateGuestGroupPayload,
} from '../models/guest-group.model';
export type { GuestGroup };
export type { ImportGroupCommitResponse as ImportGroupResult };

@Injectable({ providedIn: 'root' })
export class GuestGroupsService {
  private readonly http = inject(HttpClient);

  getOne(id: string) {
    return this.http.get<GuestGroup>(`/api/guest-groups/${id}`);
  }

  getAll(
    query: {
      regionId?: string;
      page?: number;
      limit?: number;
      search?: string;
      minCarSeats?: number;
      languages?: string[];
      compositions?: string[];
      hasCars?: boolean;
      hostId?: string;
      noHost?: boolean;
    } = {},
  ) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    if (query.search) params = params.set('search', query.search);
    if (query.minCarSeats) params = params.set('minCarSeats', String(query.minCarSeats));
    if (query.languages?.length) params = params.set('languages', query.languages.join(','));
    if (query.compositions?.length)
      params = params.set('compositions', query.compositions.join(','));
    if (query.hasCars !== undefined) params = params.set('hasCars', String(query.hasCars));
    if (query.noHost) params = params.set('noHost', 'true');
    else if (query.hostId) params = params.set('hostId', query.hostId);
    return this.http.get<GuestGroupListResponse>('/api/guest-groups', { params });
  }

  create(payload: CreateGuestGroupPayload) {
    return this.http.post<GuestGroup>('/api/guest-groups', payload);
  }

  update(id: string, payload: UpdateGuestGroupPayload) {
    return this.http.patch<GuestGroup>(`/api/guest-groups/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/guest-groups/${id}`);
  }

  setContact(groupId: string, guestId: string) {
    return this.http.patch<void>(`/api/guest-groups/${groupId}/contact`, { guestId });
  }

  assignHost(groupId: string, hostId: string | null) {
    return this.http.patch<GuestGroup>(`/api/guest-groups/${groupId}/host`, { hostId });
  }

  parseImport(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportGroupParseResponse>('/api/guest-groups/import/parse', form);
  }

  commitImport(
    rows: ImportGroupRow[],
    updateRows?: ImportGroupRow[],
    regionId?: string,
    deleteAbsent?: boolean,
    partialUpdate?: boolean,
    columns?: string[],
    toDeleteCodes?: string[],
    fileColumns?: string[],
  ) {
    return this.http.post<ImportGroupCommitResponse>('/api/guest-groups/import/commit', {
      rows,
      ...(updateRows?.length ? { updateRows } : {}),
      ...(regionId ? { regionId } : {}),
      ...(deleteAbsent ? { deleteAbsent: true } : {}),
      ...(toDeleteCodes?.length ? { toDeleteCodes } : {}),
      ...(partialUpdate && columns?.length ? { partialUpdate: true, columns } : {}),
      ...(fileColumns?.length ? { fileColumns } : {}),
    });
  }

  importFromExcel(file: File, regionId?: string, deleteAbsent?: boolean) {
    const form = new FormData();
    form.append('file', file);
    const parts: string[] = [];
    if (regionId) parts.push(`regionId=${regionId}`);
    if (deleteAbsent) parts.push('deleteAbsent=true');
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.http.post<ImportGroupCommitResponse>(`/api/guest-groups/import${qs}`, form);
  }

  exportExcel(regionId?: string) {
    const qs = regionId ? `?regionId=${regionId}` : '';
    return this.http.get(`/api/guest-groups/export${qs}`, { responseType: 'blob' });
  }

  downloadTemplate() {
    return this.http.get('/api/guest-groups/import/template', { responseType: 'blob' });
  }

  recomputeAggregates() {
    return this.http.post<RecomputeAggregatesResult>('/api/guest-groups/recompute-aggregates', {});
  }

  truncate() {
    return this.http.delete<{ deleted_guests: number; deleted_groups: number }>(
      '/api/guest-groups/truncate',
    );
  }

  deleteFiltered(query: { regionId?: string; search?: string; hostId?: string; noHost?: boolean }) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.search) params = params.set('search', query.search);
    if (query.noHost) params = params.set('noHost', 'true');
    else if (query.hostId) params = params.set('hostId', query.hostId);
    return this.http.delete<{ deleted_guests: number; deleted_groups: number }>(
      '/api/guest-groups/delete-filtered',
      { params },
    );
  }
}
