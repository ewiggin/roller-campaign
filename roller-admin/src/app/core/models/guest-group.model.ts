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

export interface ImportGroupRow {
  group_code: string;
  region_name?: string | null;
  host_name?: string | null;
  available_from?: string | null;
  available_to?: string | null;
  composition?: string | null;
  car_count?: number | null;
}

export interface ImportGroupParseResponse {
  valid: ImportGroupRow[];
  errors: { row: number; group_code: string; reason: string }[];
  duplicates: string[];
  duplicateRows: ImportGroupRow[];
  toDelete: string[];
  summary: { total: number; valid: number; errors: number; duplicates: number; to_delete: number };
  columns: string[];
}

export interface ImportGroupCommitResponse {
  created: number;
  updated: number;
  total: number;
  regions_not_found?: number;
  hosts_not_found?: number;
  deleted?: number;
}

export interface CreateGuestGroupPayload {
  group_code: string;
  region_id: string;
}

export interface UpdateGuestGroupPayload {
  region_id?: string;
  available_from?: string | null;
  available_to?: string | null;
  composition?: GroupComposition | null;
  car_count?: number | null;
}
