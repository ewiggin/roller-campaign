export interface SmtpSettings {
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  from_name: string | null;
  from_email: string | null;
  enabled: boolean;
  updated_at: string;
}

export interface UpdateSmtpSettingsPayload {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from_name?: string;
  from_email?: string;
  enabled?: boolean;
}

export type ScreenKey =
  | 'dashboard'
  | 'regions'
  | 'hosts'
  | 'guest-groups'
  | 'guests'
  | 'activities'
  | 'volunteers'
  | 'carts';

export interface ScreenConfig {
  key: ScreenKey;
  label: string;
}

export const CONFIGURABLE_SCREENS: ScreenConfig[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'regions', label: 'Regions' },
  { key: 'hosts', label: 'Hosts' },
  { key: 'guest-groups', label: 'Guest Groups' },
  { key: 'guests', label: 'Guests' },
  { key: 'activities', label: 'Activities' },
  { key: 'volunteers', label: 'Volunteers' },
  { key: 'carts', label: 'Carts' },
];

export interface RolePermissions {
  region_admin: string[];
  volunteer: string[];
  volunteer_manager: string[];
  guest_manager: string[];
  host_manager: string[];
}

export interface UpdatePermissionsPayload {
  region_admin?: string[];
  volunteer?: string[];
  volunteer_manager?: string[];
  guest_manager?: string[];
  host_manager?: string[];
}

export interface DatabaseImportResult {
  tables: number;
  rows: number;
  importedAt: string;
}
