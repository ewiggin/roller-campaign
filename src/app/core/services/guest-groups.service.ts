import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { GuestGroup, CreateGuestGroupPayload } from '../models/guest-group.model';
export type { GuestGroup };

export interface ImportGroupResult {
  created: number;
  skipped: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class GuestGroupsService {
  private readonly http = inject(HttpClient);

  getAll(regionId?: string) {
    const params = regionId ? `?regionId=${regionId}` : '';
    return this.http.get<GuestGroup[]>(`/api/guest-groups${params}`);
  }

  create(payload: CreateGuestGroupPayload) {
    return this.http.post<GuestGroup>('/api/guest-groups', payload);
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

  importFromExcel(file: File, regionId: string) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportGroupResult>(`/api/guest-groups/import?regionId=${regionId}`, form);
  }

  downloadTemplate() {
    return this.http.get('/api/guest-groups/import/template', { responseType: 'blob' });
  }
}
