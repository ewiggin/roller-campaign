export type ActivityStatus = 'draft' | 'published';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
  description?: string | null;
}

export interface ActivityVolunteer {
  id: string;
  volunteer_code: string;
  full_name: string;
  role_id: string | null;
  role_name: string | null;
  available_roles: { id: string; name: string }[];
}

export interface ActivityGuestGroup {
  id: string;
  group_code: string;
  guest_count: number;
  host_name: string | null;
  distance_km: number | null;
}

export interface ActivityAttendanceRequest {
  request_id: string;
  group_id: string;
  group_code: string;
  guest_count: number;
  preference: number;
}

export interface AvailableCartForActivity {
  id: string;
  number: string;
  host_id: string | null;
  host_name: string | null;
}

export interface ActivityCart {
  id: string;
  number: string;
}

export interface PreachingGroupVolunteer {
  id: string;
  volunteer_code: string;
  full_name: string;
  role_id: string | null;
  role_name: string | null;
  available_roles: { id: string; name: string }[];
  description: string | null;
}

export interface PreachingGroup {
  id: string;
  name: string | null;
  territory_key: string | null;
  position: number;
  volunteers: PreachingGroupVolunteer[];
  guest_groups: ActivityGuestGroup[];
  carts: ActivityCart[];
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
  activity_locations: LocationPoint[] | null;
  image_key: string | null;
  is_preaching_shift: boolean;
  request_attendance: boolean;
  volunteers: ActivityVolunteer[];
  volunteer_count: number;
  required_volunteers: number | null;
  guest_groups: ActivityGuestGroup[];
  total_guests_assigned: number;
  preaching_groups: PreachingGroup[];
  requests: ActivityAttendanceRequest[];
  max_guests: number | null;
  created_at: string;
  updated_at: string;
}

export interface AvailableVolunteerForActivity {
  id: string;
  volunteer_code: string;
  full_name: string;
  roles: { id: string; name: string }[];
  already_in_activity: boolean;
  distance_km: number | null;
  distance_from_congregation: boolean;
  congregation_name: string | null;
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
  host_schedule_conflict: boolean;
  preaching_shifts_count: number;
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
  id?: string;
  region_id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  host_id?: string | null;
  required_volunteers?: number | null;
  max_guests?: number | null;
  date: string;
  start_time: string;
  end_time: string;
  activity_locations?: LocationPoint[] | null;
  image_key?: string | null;
  is_preaching_shift?: boolean;
  request_attendance?: boolean;
}
