export interface GuestGroup {
  id: string;
  group_code: string;
  region_id: string;
  host_id: string | null;
  host_name: string | null;
  guest_count: number;
  created_at: string;
  updated_at: string;
}

export interface GuestGroupListResponse {
  data: GuestGroup[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateGuestGroupPayload {
  group_code: string;
  region_id: string;
}
