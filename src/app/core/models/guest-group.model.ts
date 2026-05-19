export type GroupComposition = 'men_only' | 'mixed' | 'women_only';

export interface GuestGroup {
  id: string;
  group_code: string;
  region_id: string;
  host_id: string | null;
  host_name: string | null;
  guest_count: number;
  available_from: string | null;
  available_to: string | null;
  composition: GroupComposition | null;
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

export interface UpdateGuestGroupPayload {
  available_from?: string | null;
  available_to?: string | null;
  composition?: GroupComposition | null;
}
