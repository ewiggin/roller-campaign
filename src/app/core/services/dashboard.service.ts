import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface RegionSummary {
  region_id: string;
  region_name: string;
  event_start_date: string | null;
  event_end_date: string | null;
  guestCount: number;
  volunteerCount: number;
  turnCount: number;
  coveredTurns: number;
}

interface RegionStatsDto {
  region_id: string;
  region_name: string;
  event_start_date: string | null;
  event_end_date: string | null;
  guest_count: number;
  volunteer_count: number;
  turn_count: number;
  covered_turns: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getStats() {
    return this.http.get<RegionStatsDto[]>('/api/regions/stats');
  }
}
