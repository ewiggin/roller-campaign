import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { SmtpSettings, UpdateSmtpSettingsPayload } from '../models/settings.model';

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
}
