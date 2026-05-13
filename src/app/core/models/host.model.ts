export interface Host {
  id: string;
  name: string;
  region_id: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  weekday_meeting_day: number | null;
  weekday_meeting_time: string | null;
  weekend_meeting_day: number | null;
  weekend_meeting_time: string | null;
  group_count: number;
  guest_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateHostPayload {
  name: string;
  region_id: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  weekday_meeting_day?: number | null;
  weekday_meeting_time?: string | null;
  weekend_meeting_day?: number | null;
  weekend_meeting_time?: string | null;
}

export interface UpdateHostPayload {
  name?: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  weekday_meeting_day?: number | null;
  weekday_meeting_time?: string | null;
  weekend_meeting_day?: number | null;
  weekend_meeting_time?: string | null;
}

export interface GroupSuggestion {
  id: string;
  group_code: string;
  guest_count: number;
  distance_km: number | null;
}

export interface GroupSuggestionsResponse {
  assigned: GroupSuggestion[];
  available: GroupSuggestion[];
}
