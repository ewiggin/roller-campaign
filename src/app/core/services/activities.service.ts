import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Activity, ActivityListResponse, AvailableGroupForActivity, CreateActivityBatchPayload, CreateActivityPayload } from '../models/activity.model';

@Injectable({ providedIn: 'root' })
export class ActivitiesService {
  private readonly http = inject(HttpClient);

  getAll(query: { regionId?: string; date?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.date) params = params.set('date', query.date);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    return this.http.get<ActivityListResponse>('/api/activities', { params });
  }

  getOne(id: string) {
    return this.http.get<Activity>(`/api/activities/${id}`);
  }

  create(payload: CreateActivityPayload) {
    return this.http.post<Activity>('/api/activities', payload);
  }

  createBatch(payload: CreateActivityBatchPayload) {
    return this.http.post<Activity[]>('/api/activities/batch', payload);
  }

  update(id: string, payload: Partial<CreateActivityPayload>) {
    return this.http.patch<Activity>(`/api/activities/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/activities/${id}`);
  }

  removeSeriesFromDate(id: string) {
    return this.http.delete<void>(`/api/activities/${id}/series-from-here`);
  }

  assignVolunteer(id: string, volunteerId: string) {
    return this.http.post<Activity>(`/api/activities/${id}/volunteers`, { volunteerId });
  }

  unassignVolunteer(id: string, volunteerId: string) {
    return this.http.delete<Activity>(`/api/activities/${id}/volunteers/${volunteerId}`);
  }

  getAvailableGroups(id: string) {
    return this.http.get<AvailableGroupForActivity[]>(`/api/activities/${id}/available-groups`);
  }

  assignGuestGroup(id: string, groupId: string) {
    return this.http.post<Activity>(`/api/activities/${id}/guest-groups`, { groupId });
  }

  unassignGuestGroup(id: string, groupId: string) {
    return this.http.delete<Activity>(`/api/activities/${id}/guest-groups/${groupId}`);
  }

  publish(id: string) {
    return this.http.post<Activity>(`/api/activities/${id}/publish`, {});
  }

  unpublish(id: string) {
    return this.http.post<Activity>(`/api/activities/${id}/unpublish`, {});
  }
}
