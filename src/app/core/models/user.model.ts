export type UserRole =
  | 'superadmin'
  | 'region_admin'
  | 'volunteer'
  | 'volunteer_manager'
  | 'guest_manager'
  | 'host_manager'
  | 'guest';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  role?: UserRole;
}
