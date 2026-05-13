export interface RegionCoordinator {
  id: string;
  email: string;
  role: string;
}

export interface Region {
  id: string;
  name: string;
  event_start_date: string | null;
  event_end_date: string | null;
  coordinators: RegionCoordinator[];
  created_at: string;
  updated_at: string;
}

export interface CreateRegionPayload {
  name: string;
  event_start_date?: string | null;
  event_end_date?: string | null;
}

export type UpdateRegionPayload = Partial<CreateRegionPayload>;
