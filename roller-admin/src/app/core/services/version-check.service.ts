import { inject, Injectable, OnDestroy } from '@angular/core';
import { fetch } from '@tauri-apps/plugin-http';
import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';

const VERSION_CHECK_URL = 'https://roller-admin.booringsoftware.com/version.txt';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class VersionCheckService implements OnDestroy {
  private readonly toast = inject(ToastService);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    if (!environment.version) return;
    this.check();
    this.intervalId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  ngOnDestroy() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  }

  private check() {
    console.log('[version-check] fetching...');
    fetch(VERSION_CHECK_URL)
      .then((res) => res.text())
      .then((remoteVersion) => {
        const remote = remoteVersion.trim().replace(/^[a-z]+-v/i, '');
        console.log(`[version-check] local: ${environment.version} — remote: ${remote}`);
        if (remote && remote !== environment.version) {
          this.toast.show(
            `Nueva versión disponible: ${remote}. Descarga la última versión para actualizar.`,
            'info',
          );
        }
      })
      .catch((err) => console.error('[version-check] error:', err));
  }
}
