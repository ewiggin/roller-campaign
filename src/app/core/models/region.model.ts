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

export interface ImportRegionRow {
  name: string;
  event_start_date?: string | null;
  event_end_date?: string | null;
}

export interface ImportRegionParseResponse {
  valid: ImportRegionRow[];
  duplicateRows: ImportRegionRow[];
  errors: { row: number; name: string; reason: string }[];
  summary: { total: number; valid: number; duplicates: number; errors: number };
}

export interface ImportRegionCommitResponse {
  created: number;
  updated: number;
  total: number;
}
