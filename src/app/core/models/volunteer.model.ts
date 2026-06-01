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
}

export interface VolunteerListResponse {
  data: Volunteer[];
  total: number;
  page: number;
  limit: number;
}

export interface ImportVolunteerRow {
  volunteer_code: string;
  full_name: string;
  email?: string;
  phone?: string;
}

export interface ImportVolunteerParseResponse {
  to_create: ImportVolunteerRow[];
  skipped: string[];
  summary: { total: number; to_create: number; skipped: number };
}

export interface ImportVolunteerCommitResponse {
  created: number;
  skipped: number;
}
