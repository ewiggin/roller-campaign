import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Region, CreateRegionPayload, UpdateRegionPayload } from '../models/region.model';
import type { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class RegionsService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<Region[]>('/api/regions');
  }

  getOne(id: string) {
    return this.http.get<Region>(`/api/regions/${id}`);
  }

  create(payload: CreateRegionPayload) {
    return this.http.post<Region>('/api/regions', payload);
  }

  update(id: string, payload: UpdateRegionPayload) {
    return this.http.patch<Region>(`/api/regions/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/regions/${id}`);
  }

  addCoordinator(regionId: string, userId: string) {
    return this.http.post<Region>(`/api/regions/${regionId}/coordinators`, { userId });
  }

  removeCoordinator(regionId: string, userId: string) {
    return this.http.delete<Region>(`/api/regions/${regionId}/coordinators/${userId}`);
  }

  getUsers() {
    return this.http.get<User[]>('/api/users');
  }
}
