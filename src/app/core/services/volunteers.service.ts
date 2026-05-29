import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type {
  Volunteer,
  VolunteerListResponse,
  ImportVolunteerRow,
  ImportVolunteerParseResponse,
  ImportVolunteerCommitResponse,
} from '../models/volunteer.model';

export interface VolunteerListQuery {
  regionId?: string;
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class VolunteersService {
  private readonly http = inject(HttpClient);

  getAll(query: VolunteerListQuery = {}) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.search) params = params.set('search', query.search);
    if (query.is_active !== undefined) params = params.set('is_active', String(query.is_active));
    params = params.set('page', String(query.page ?? 1));
    params = params.set('limit', String(query.limit ?? 50));
    return this.http.get<VolunteerListResponse>('/api/volunteers', { params });
  }

  getOne(id: string) {
    return this.http.get<Volunteer>(`/api/volunteers/${id}`);
  }

  update(id: string, payload: Partial<Volunteer>) {
    return this.http.patch<Volunteer>(`/api/volunteers/${id}`, payload);
  }

  parseImport(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportVolunteerParseResponse>('/api/volunteers/import/parse', form);
  }

  commitImport(rows: ImportVolunteerRow[], regionIds?: string[]) {
    return this.http.post<ImportVolunteerCommitResponse>('/api/volunteers/import/commit', {
      rows,
      ...(regionIds?.length ? { region_ids: regionIds } : {}),
    });
  }

  downloadTemplate() {
    return this.http.get('/api/volunteers/import/template', { responseType: 'blob' });
  }

  exportExcel(query: VolunteerListQuery = {}) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.search) params = params.set('search', query.search);
    if (query.is_active !== undefined) params = params.set('is_active', String(query.is_active));
    return this.http.get('/api/volunteers/export', { params, responseType: 'blob' });
  }
}
