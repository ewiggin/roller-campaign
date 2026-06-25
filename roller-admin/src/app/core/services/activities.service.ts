import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type {
  Activity,
  ActivityListResponse,
  AvailableCartForActivity,
  AvailableGroupForActivity,
  AvailableVolunteerForActivity,
  CreateActivityBatchPayload,
  CreateActivityPayload,
  UpdateActivityPayload,
} from '../models/activity.model';

@Injectable({ providedIn: 'root' })
export class ActivitiesService {
  private readonly http = inject(HttpClient);

  getAll(
    query: {
      regionId?: string;
      name?: string;
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      hostId?: string;
      is_preaching_shift?: boolean;
      is_food_shift?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ) {
    let params = new HttpParams();
    if (query.regionId) params = params.set('regionId', query.regionId);
    if (query.name) params = params.set('name', query.name);
    if (query.date) params = params.set('date', query.date);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.hostId) params = params.set('hostId', query.hostId);
    if (query.is_preaching_shift !== undefined)
      params = params.set('is_preaching_shift', String(query.is_preaching_shift));
    if (query.is_food_shift !== undefined)
      params = params.set('is_food_shift', String(query.is_food_shift));
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

  update(id: string, payload: UpdateActivityPayload) {
    return this.http.patch<Activity>(`/api/activities/${id}`, payload);
  }

  updateSeriesFromDate(id: string, payload: UpdateActivityPayload) {
    return this.http.patch<Activity>(`/api/activities/${id}/series-from-here`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/activities/${id}`);
  }

  removeSeriesFromDate(id: string) {
    return this.http.delete<void>(`/api/activities/${id}/series-from-here`);
  }

  assignVolunteer(id: string, volunteerId: string, roleId?: string | null) {
    return this.http.post<Activity>(`/api/activities/${id}/volunteers`, {
      volunteerId,
      role_id: roleId ?? null,
    });
  }

  setVolunteerRole(id: string, volunteerId: string, roleId: string | null) {
    return this.http.patch<Activity>(`/api/activities/${id}/volunteers/${volunteerId}/role`, {
      role_id: roleId,
    });
  }

  unassignVolunteer(id: string, volunteerId: string) {
    return this.http.delete<Activity>(`/api/activities/${id}/volunteers/${volunteerId}`);
  }

  getAvailableVolunteers(id: string) {
    return this.http.get<AvailableVolunteerForActivity[]>(
      `/api/activities/${id}/available-volunteers`,
    );
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

  deleteAttendanceRequest(id: string, requestId: string) {
    return this.http.delete<Activity>(`/api/activities/${id}/requests/${requestId}`);
  }

  // ── Preaching groups ──────────────────────────────────────────────────────

  addPreachingGroup(id: string, name?: string | null) {
    return this.http.post<Activity>(`/api/activities/${id}/preaching-groups`, {
      name: name ?? null,
    });
  }

  renamePreachingGroup(id: string, groupId: string, name: string | null) {
    return this.http.patch<Activity>(`/api/activities/${id}/preaching-groups/${groupId}`, {
      name,
    });
  }

  updatePreachingGroupTerritory(id: string, groupId: string, territory_key: string | null) {
    return this.http.patch<Activity>(`/api/activities/${id}/preaching-groups/${groupId}`, {
      territory_key,
    });
  }

  removePreachingGroup(id: string, groupId: string) {
    return this.http.delete<Activity>(`/api/activities/${id}/preaching-groups/${groupId}`);
  }

  assignVolunteerToGroup(
    id: string,
    groupId: string,
    volunteerId: string,
    roleId?: string | null,
    description?: string | null,
  ) {
    return this.http.post<Activity>(
      `/api/activities/${id}/preaching-groups/${groupId}/volunteers`,
      { volunteerId, role_id: roleId ?? null, description: description ?? null },
    );
  }

  updateGroupVolunteerDescription(
    id: string,
    groupId: string,
    volunteerId: string,
    description: string | null,
  ) {
    return this.http.patch<Activity>(
      `/api/activities/${id}/preaching-groups/${groupId}/volunteers/${volunteerId}`,
      { description },
    );
  }

  removeVolunteerFromGroup(id: string, groupId: string, volunteerId: string) {
    return this.http.delete<Activity>(
      `/api/activities/${id}/preaching-groups/${groupId}/volunteers/${volunteerId}`,
    );
  }

  assignGuestGroupToGroup(id: string, groupId: string, guestGroupId: string) {
    return this.http.post<Activity>(
      `/api/activities/${id}/preaching-groups/${groupId}/guest-groups`,
      { groupId: guestGroupId },
    );
  }

  removeGuestGroupFromGroup(id: string, groupId: string, guestGroupId: string) {
    return this.http.delete<Activity>(
      `/api/activities/${id}/preaching-groups/${groupId}/guest-groups/${guestGroupId}`,
    );
  }

  getAvailableCarts(id: string) {
    return this.http.get<AvailableCartForActivity[]>(`/api/activities/${id}/available-carts`);
  }

  assignCartToGroup(id: string, groupId: string, cartId: string) {
    return this.http.post<Activity>(`/api/activities/${id}/preaching-groups/${groupId}/carts`, {
      cartId,
    });
  }

  removeCartFromGroup(id: string, groupId: string, cartId: string) {
    return this.http.delete<Activity>(
      `/api/activities/${id}/preaching-groups/${groupId}/carts/${cartId}`,
    );
  }

  publish(id: string) {
    return this.http.post<Activity>(`/api/activities/${id}/publish`, {});
  }

  unpublish(id: string) {
    return this.http.post<Activity>(`/api/activities/${id}/unpublish`, {});
  }

  // ── Schedule PDF export ───────────────────────────────────────────────────

  exportGroupSchedulePdf(groupId: string) {
    return this.http.get(`/api/activities/export/schedule-pdf?groupId=${groupId}`, {
      responseType: 'blob',
    });
  }

  exportHostSchedulesPdf(hostId: string) {
    return this.http.get(`/api/activities/export/schedule-pdf?hostId=${hostId}`, {
      responseType: 'blob',
    });
  }
}
