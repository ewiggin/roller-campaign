export type GroupComposition = 'men_only' | 'mixed' | 'women_only';

export interface GuestGroup {
  id: string;
  group_code: string;
  region_id: string;
  host_id: string | null;
  host_name: string | null;
  guest_count: number;
  languages: string[];
  total_car_seats: number;
  car_count: number | null;
  available_from: string | null;
  available_to: string | null;
  composition: GroupComposition | null;
  agg_guest_count: number | null;
  agg_minor_count: number | null;
  agg_status_counts: Record<string, number> | null;
  agg_avg_lat: number | null;
  agg_avg_lng: number | null;
  agg_languages: string[] | null;
  agg_speaks_english: boolean | null;
  agg_car_seats: number | null;
  agg_computed_at: string | null;
  agg_stale: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface RecomputeAggregatesResult {
  groups_updated: number;
  computed_at: string;
}

export interface GuestGroupListResponse {
  data: GuestGroup[];
  total: number;
  page: number;
  limit: number;
  available_languages: string[];
}

export interface CreateGuestGroupPayload {
  group_code: string;
  region_id: string;
}

export interface UpdateGuestGroupPayload {
  available_from?: string | null;
  available_to?: string | null;
  composition?: GroupComposition | null;
  car_count?: number | null;
}
