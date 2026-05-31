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
