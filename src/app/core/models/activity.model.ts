export type ActivityStatus = 'draft' | 'published';

export interface ActivityVolunteer {
  id: string;
  volunteer_code: string;
  full_name: string;
}

export interface ActivityGuestGroup {
  id: string;
  group_code: string;
  guest_count: number;
}

export interface Activity {
  id: string;
  region_id: string;
  date: string;
  start_time: string;
  end_time: string;
  description: string | null;
  status: ActivityStatus;
  lat: number | null;
  lng: number | null;
  volunteers: ActivityVolunteer[];
  volunteer_count: number;
  guest_groups: ActivityGuestGroup[];
  total_guests_assigned: number;
  created_at: string;
  updated_at: string;
}

export interface AvailableGroupForActivity {
  id: string;
  group_code: string;
  host_id: string | null;
  host_name: string | null;
  host_lat: number | null;
  host_lng: number | null;
  distance_km: number | null;
  guest_count: number;
}

export interface ActivityListResponse {
  data: Activity[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateActivityPayload {
  region_id: string;
  date: string;
  start_time: string;
  end_time: string;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
}
