export interface CartLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface Cart {
  id: string;
  region_id: string;
  host_id: string | null;
  host_name: string | null;
  number: string;
  primary_location: CartLocation | null;
  secondary_location: CartLocation | null;
  image_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCartDto {
  region_id: string;
  host_id?: string | null;
  number: string;
  primary_location?: CartLocation | null;
  secondary_location?: CartLocation | null;
  image_key?: string | null;
}

export type UpdateCartDto = Partial<CreateCartDto>;

export interface ImportCartRow {
  region_name: string;
  host_name?: string | null;
  number: string;
  primary_address?: string | null;
  primary_lat?: number | null;
  primary_lng?: number | null;
  secondary_address?: string | null;
  secondary_lat?: number | null;
  secondary_lng?: number | null;
}

export interface ImportCartError {
  row: number;
  number: string;
  reason: string;
}

export interface ImportCartParseResponse {
  valid: ImportCartRow[];
  errors: ImportCartError[];
  summary: { total: number; valid: number; errors: number };
}

export interface ImportCartCommitResponse {
  created: number;
  total: number;
}
