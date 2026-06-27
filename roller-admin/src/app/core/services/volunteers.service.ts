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

  getAll(
    query: {
      regionId?: string;
      roleId?: string;
      hostId?: string;
      noHost?: boolean;
      search?: string;
      is_active?: boolean;
      min_car_seats?: number;
      available_slots?: string[];
      terms_accepted?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.roleId) params = params.set('roleId', query.roleId);
    if (query.noHost) params = params.set('noHost', 'true');
    else if (query.hostId) params = params.set('hostId', query.hostId);
    if (query.search) params = params.set('search', query.search);
    if (query.is_active !== undefined) params = params.set('is_active', String(query.is_active));
    if (query.min_car_seats !== undefined)
      params = params.set('min_car_seats', String(query.min_car_seats));
    for (const s of query.available_slots ?? []) params = params.append('available_slots', s);
    if (query.terms_accepted !== undefined)
      params = params.set('terms_accepted', String(query.terms_accepted));
    if (query.page) params = params.set('page', String(query.page));
    params = params.set('limit', String(query.limit ?? 50));
    return this.http.get<VolunteerListResponse>('/api/volunteers', { params });
  }

  getOne(id: string) {
    return this.http.get<Volunteer>(`/api/volunteers/${id}`);
  }

  create(dto: {
    volunteer_code: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    is_active?: boolean;
    role_ids?: string[];
    region_ids?: string[];
  }) {
    return this.http.post<Volunteer>('/api/volunteers', dto);
  }

  update(id: string, dto: Partial<Volunteer> & { role_ids?: string[]; region_ids?: string[] }) {
    return this.http.patch<Volunteer>(`/api/volunteers/${id}`, dto);
  }

  getRoles() {
    return this.http.get<VolunteerRole[]>('/api/volunteers/roles');
  }

  createRole(name: string) {
    return this.http.post<VolunteerRole>('/api/volunteers/roles', { name });
  }

  deleteRole(id: string) {
    return this.http.delete<void>(`/api/volunteers/roles/${id}`);
  }

  exportExcel(
    query: {
      regionId?: string;
      roleId?: string;
      hostId?: string;
      search?: string;
      min_car_seats?: number;
      available_slots?: string[];
      terms_accepted?: boolean;
    } = {},
  ) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.roleId) params = params.set('roleId', query.roleId);
    if (query.hostId) params = params.set('hostId', query.hostId);
    if (query.search) params = params.set('search', query.search);
    if (query.min_car_seats !== undefined)
      params = params.set('min_car_seats', String(query.min_car_seats));
    for (const s of query.available_slots ?? []) params = params.append('available_slots', s);
    if (query.terms_accepted !== undefined)
      params = params.set('terms_accepted', String(query.terms_accepted));
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

  truncate() {
    return this.http.delete<{ deleted: number }>('/api/volunteers/truncate');
  }

  commitImport(
    rows: ImportVolunteerRow[],
    updateRows?: ImportVolunteerRow[],
    deleteAbsent?: boolean,
    partialUpdate?: boolean,
    columns?: string[],
    toDeleteCodes?: string[],
  ) {
    return this.http.post<ImportVolunteerCommitResponse>('/api/volunteers/import/commit', {
      rows,
      ...(updateRows?.length ? { updateRows } : {}),
      ...(deleteAbsent ? { deleteAbsent: true } : {}),
      ...(partialUpdate ? { partialUpdate: true } : {}),
      ...(columns?.length ? { columns } : {}),
      ...(toDeleteCodes?.length ? { toDeleteCodes } : {}),
    });
  }
}
