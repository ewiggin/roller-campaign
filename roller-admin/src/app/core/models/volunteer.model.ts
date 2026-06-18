export interface VolunteerRole {
  id: string;
  name: string;
}

export interface VolunteerRegion {
  id: string;
  name: string;
}

export interface Volunteer {
  id: string;
  volunteer_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  user_id: string | null;
  roles: VolunteerRole[];
  regions: VolunteerRegion[];
  hosting_address: string | null;
  lat: number | null;
  lng: number | null;
  maps_link: string | null;
  car_seats: number | null;
  monday_morning: boolean;
  monday_afternoon: boolean;
  tuesday_morning: boolean;
  tuesday_afternoon: boolean;
  wednesday_morning: boolean;
  wednesday_afternoon: boolean;
  thursday_morning: boolean;
  thursday_afternoon: boolean;
  friday_morning: boolean;
  friday_afternoon: boolean;
  saturday_morning: boolean;
  saturday_afternoon: boolean;
  sunday_morning: boolean;
  sunday_afternoon: boolean;
  saturday_prev_morning: boolean;
  saturday_prev_afternoon: boolean;
  sunday_prev_morning: boolean;
  sunday_prev_afternoon: boolean;
  monday_next_morning: boolean;
  monday_next_afternoon: boolean;
  terms_accepted: boolean | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface VolunteerSummary {
  id: string;
  volunteer_code: string;
  full_name: string;
  is_active: boolean;
  roles: VolunteerRole[];
  regions: VolunteerRegion[];
  car_seats: number | null;
  monday_morning: boolean;
  monday_afternoon: boolean;
  tuesday_morning: boolean;
  tuesday_afternoon: boolean;
  wednesday_morning: boolean;
  wednesday_afternoon: boolean;
  thursday_morning: boolean;
  thursday_afternoon: boolean;
  friday_morning: boolean;
  friday_afternoon: boolean;
  saturday_morning: boolean;
  saturday_afternoon: boolean;
  sunday_morning: boolean;
  sunday_afternoon: boolean;
  saturday_prev_morning: boolean;
  saturday_prev_afternoon: boolean;
  sunday_prev_morning: boolean;
  sunday_prev_afternoon: boolean;
  monday_next_morning: boolean;
  monday_next_afternoon: boolean;
}

export interface VolunteerListResponse {
  data: Volunteer[];
  total: number;
  page: number;
  limit: number;
}

export interface ImportVolunteerRow {
  volunteer_code: string;
  has_code?: boolean;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  region_name?: string | null;
  role_names?: string | null;
  is_active?: boolean;
  car_seats?: number | null;
  hosting_address?: string | null;
  lat?: number | null;
  lng?: number | null;
  maps_link?: string | null;
  monday_morning?: boolean;
  monday_afternoon?: boolean;
  tuesday_morning?: boolean;
  tuesday_afternoon?: boolean;
  wednesday_morning?: boolean;
  wednesday_afternoon?: boolean;
  thursday_morning?: boolean;
  thursday_afternoon?: boolean;
  friday_morning?: boolean;
  friday_afternoon?: boolean;
  saturday_morning?: boolean;
  saturday_afternoon?: boolean;
  sunday_morning?: boolean;
  sunday_afternoon?: boolean;
  saturday_prev_morning?: boolean;
  saturday_prev_afternoon?: boolean;
  sunday_prev_morning?: boolean;
  sunday_prev_afternoon?: boolean;
  monday_next_morning?: boolean;
  monday_next_afternoon?: boolean;
}

export interface ImportVolunteerParseResponse {
  valid: ImportVolunteerRow[];
  duplicates: string[];
  duplicateRows: ImportVolunteerRow[];
  toDelete: string[];
  columns: string[];
  summary: { total: number; valid: number; duplicates: number; to_delete: number };
}

export interface ImportVolunteerCommitResponse {
  created: number;
  updated?: number;
  skipped: number;
  deleted?: number;
}
