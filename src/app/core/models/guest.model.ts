export type GuestStatus = 'pending' | 'confirmed' | 'cancelled' | 'arrived' | 'blocked';

export interface CreateGuestPayload {
  guest_code: string;
  group_id: string;
  region_id: string;
  full_name: string;
  is_minor?: boolean;
  native_language?: string | null;
  origin_city?: string | null;
  email?: string | null;
  branch?: string | null;
  is_group_contact?: boolean;
  is_special_servant?: boolean;
}
export type TransportMode = 'car' | 'bus' | 'train' | 'plane' | 'ferry' | 'motorbike' | 'other';

export interface Guest {
  id: string;
  guest_code: string;
  group_id: string;
  region_id: string;
  full_name: string;
  is_minor: boolean;
  status: GuestStatus;
  branch: string | null;
  is_group_contact: boolean;
  native_language: string | null;
  other_languages: string[] | null;
  speaks_english: boolean;
  is_special_servant: boolean;
  origin_city: string | null;
  email: string | null;
  available_from: string | null;
  available_to: string | null;
  arrival_transport: TransportMode | null;
  arrival_other_transport: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  arrival_place: string | null;
  arrival_airport: string | null;
  arrival_airline: string | null;
  arrival_flight: string | null;
  real_arrival: string | null;
  real_arrival_time: string | null;
  needs_airport_transfer: boolean;
  departure_transport: TransportMode | null;
  departure_other_transport: string | null;
  departure_date: string | null;
  departure_time: string | null;
  departure_place: string | null;
  departure_airport: string | null;
  departure_airline: string | null;
  departure_flight: string | null;
  real_departure: string | null;
  real_departure_time: string | null;
  accommodation: string | null;
  checkin_date: string | null;
  checkout_date: string | null;
  needs_special_accommodation: boolean;
  hosting_address: string | null;
  maps_link: string | null;
  lat: number | null;
  lng: number | null;
  transport_mode: string | null;
  car_seats: number | null;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  terms_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestListResponse {
  data: Guest[];
  total: number;
  page: number;
  limit: number;
}

export interface GuestListQuery {
  regionId?: string;
  groupId?: string;
  status?: GuestStatus;
  search?: string;
  termsAccepted?: boolean;
  page?: number;
  limit?: number;
}

export interface ImportGuestRow {
  guest_code: string;
  group_code: string;
  full_name: string;
  [key: string]: unknown;
}

export interface ImportError {
  row: number;
  guest_code: string;
  reason: string;
}

export interface ImportParseResponse {
  valid: ImportGuestRow[];
  errors: ImportError[];
  duplicates: string[];
  duplicateRows: ImportGuestRow[];
  summary: { total: number; valid: number; errors: number; duplicates: number };
}

export interface ImportCommitResponse {
  created_guests: number;
  updated_guests: number;
  created_groups: number;
  total: number;
  groups_not_found?: number;
  groups_not_found_rows?: ImportGuestRow[];
}
