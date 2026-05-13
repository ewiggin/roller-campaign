import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Host, CreateHostPayload, UpdateHostPayload, GroupSuggestionsResponse } from '../models/host.model';

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

  remove(id: string) {
    return this.http.delete<void>(`/api/hosts/${id}`);
  }
}
