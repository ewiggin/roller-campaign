import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { VolunteerListResponse, VolunteerSummary } from '../models/volunteer.model';

@Injectable({ providedIn: 'root' })
export class VolunteersService {
  private readonly http = inject(HttpClient);

  getAll(query: { regionId?: string; date?: string; limit?: number } = {}) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.date) params = params.set('date', query.date);
    params = params.set('limit', String(query.limit ?? 200));
    return this.http.get<VolunteerListResponse>('/api/volunteers', { params });
  }
}
