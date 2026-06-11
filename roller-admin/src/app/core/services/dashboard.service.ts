import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface RegionSummary {
  region_id: string;
  region_name: string;
  event_start_date: string | null;
  event_end_date: string | null;
  guestCount: number;
  volunteerCount: number;
  activityCount: number;
  coveredActivities: number;
}

interface RegionStatsDto {
  region_id: string;
  region_name: string;
  event_start_date: string | null;
  event_end_date: string | null;
  guest_count: number;
  volunteer_count: number;
  activity_count: number;
  covered_activities: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getStats() {
    return this.http.get<RegionStatsDto[]>('/api/regions/stats');
  }
}
