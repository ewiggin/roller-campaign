import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  SmtpSettings,
  UpdateSmtpSettingsPayload,
  RolePermissions,
  UpdatePermissionsPayload,
  DatabaseImportResult,
} from '../models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);

  getSmtp() {
    return this.http.get<SmtpSettings>('/api/settings/smtp');
  }

  updateSmtp(payload: UpdateSmtpSettingsPayload) {
    return this.http.patch<SmtpSettings>('/api/settings/smtp', payload);
  }

  testSmtp(to: string) {
    return this.http.post<void>('/api/settings/smtp/test', { to });
  }

  getPermissions() {
    return this.http.get<RolePermissions>('/api/settings/permissions');
  }

  updatePermissions(payload: UpdatePermissionsPayload) {
    return this.http.patch<RolePermissions>('/api/settings/permissions', payload);
  }

  exportDatabase() {
    return this.http.get('/api/settings/database/export', { responseType: 'blob' });
  }

  importDatabase(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DatabaseImportResult>('/api/settings/database/import', formData);
  }

  resetDatabase() {
    return this.http.post<void>('/api/settings/database/reset', {});
  }
}
