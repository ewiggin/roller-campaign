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
  series_id: string | null;
  name: string;
  icon: string | null;
  description: string | null;
  status: ActivityStatus;
  host_id: string | null;
  host_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  activity_address: string | null;
  activity_lat: number | null;
  activity_lng: number | null;
  departure_address: string | null;
  departure_lat: number | null;
  departure_lng: number | null;
  volunteers: ActivityVolunteer[];
  volunteer_count: number;
  guest_groups: ActivityGuestGroup[];
  total_guests_assigned: number;
  created_at: string;
  updated_at: string;
}

export interface AvailableVolunteerForActivity {
  id: string;
  volunteer_code: string;
  full_name: string;
  already_in_activity: boolean;
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
  already_in_activity: boolean;
}

export interface ActivityListResponse {
  data: Activity[];
  total: number;
  page: number;
  limit: number;
}

export type RepeatType = 'daily' | 'weekly' | 'same_day';

export interface RepetitionPayload {
  type: RepeatType;
  count: number;
}

export interface CreateActivityBatchPayload extends CreateActivityPayload {
  repetition: RepetitionPayload;
}

export interface UpdateActivityPayload extends Partial<CreateActivityPayload> {
  detach_from_series?: boolean;
}

export interface CreateActivityPayload {
  region_id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  host_id?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  activity_address?: string | null;
  activity_lat?: number | null;
  activity_lng?: number | null;
  departure_address?: string | null;
  departure_lat?: number | null;
  departure_lng?: number | null;
}
