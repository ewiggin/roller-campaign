export type UserRole =
  | 'superadmin'
  | 'region_admin'
  | 'volunteer'
  | 'volunteer_manager'
  | 'guest_manager'
  | 'host_manager'
  | 'guest';

export interface UserRegion {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  regions: UserRegion[];
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: UserRole;
  region_ids?: string[];
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  role?: UserRole;
  region_ids?: string[];
}
