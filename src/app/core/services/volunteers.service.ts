import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type {
  ImportVolunteerCommitResponse,
  ImportVolunteerParseResponse,
  ImportVolunteerRow,
  Volunteer,
  VolunteerListResponse,
  VolunteerRole,
} from '../models/volunteer.model';

@Injectable({ providedIn: 'root' })
export class VolunteersService {
  private readonly http = inject(HttpClient);

  getAll(query: {
    regionId?: string;
    roleId?: string;
    search?: string;
    is_active?: boolean;
    min_car_seats?: number;
    available_slots?: string[];
    page?: number;
    limit?: number;
  } = {}) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.roleId) params = params.set('roleId', query.roleId);
    if (query.search) params = params.set('search', query.search);
    if (query.is_active !== undefined) params = params.set('is_active', String(query.is_active));
    if (query.min_car_seats !== undefined) params = params.set('min_car_seats', String(query.min_car_seats));
    for (const s of query.available_slots ?? []) params = params.append('available_slots', s);
    if (query.page) params = params.set('page', String(query.page));
    params = params.set('limit', String(query.limit ?? 50));
    return this.http.get<VolunteerListResponse>('/api/volunteers', { params });
  }

  getOne(id: string) {
    return this.http.get<Volunteer>(`/api/volunteers/${id}`);
  }

  update(id: string, dto: Partial<Volunteer> & { role_ids?: string[]; region_ids?: string[] }) {
    return this.http.patch<Volunteer>(`/api/volunteers/${id}`, dto);
  }

  getRoles() {
    return this.http.get<VolunteerRole[]>('/api/volunteers/roles');
  }

  exportExcel(query: {
    regionId?: string;
    roleId?: string;
    search?: string;
    min_car_seats?: number;
    available_slots?: string[];
  } = {}) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.roleId) params = params.set('roleId', query.roleId);
    if (query.search) params = params.set('search', query.search);
    if (query.min_car_seats !== undefined) params = params.set('min_car_seats', String(query.min_car_seats));
    for (const s of query.available_slots ?? []) params = params.append('available_slots', s);
    return this.http.get('/api/volunteers/export', { params, responseType: 'blob' });
  }

  downloadTemplate() {
    return this.http.get('/api/volunteers/import/template', { responseType: 'blob' });
  }

  parseImport(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportVolunteerParseResponse>('/api/volunteers/import/parse', form);
  }

  commitImport(rows: ImportVolunteerRow[]) {
    return this.http.post<ImportVolunteerCommitResponse>('/api/volunteers/import/commit', { rows });
  }
}
