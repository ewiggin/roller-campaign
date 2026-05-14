export interface VolunteerSummary {
  id: string;
  volunteer_code: string;
  full_name: string;
  is_active: boolean;
}

export interface VolunteerListResponse {
  data: VolunteerSummary[];
  total: number;
  page: number;
  limit: number;
}
