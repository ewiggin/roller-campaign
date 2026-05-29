import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';
import type { RolePermissions } from '../models/settings.model';

const DEFAULT_PERMISSIONS: RolePermissions = {
  region_admin: ['dashboard', 'regions', 'hosts', 'guest-groups', 'guests', 'activities'],
  volunteer: [],
  volunteer_manager: [],
  guest_manager: [],
  host_manager: [],
};

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly auth = inject(AuthService);
  private readonly settingsSvc = inject(SettingsService);

  private readonly _permissions = signal<RolePermissions>(DEFAULT_PERMISSIONS);
  private _loadPromise: Promise<void> | null = null;

  readonly permissions = this._permissions.asReadonly();

  load(): Promise<void> {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = firstValueFrom(
      this.settingsSvc.getPermissions().pipe(
        tap((p) => this._permissions.set(p)),
        catchError(() => of(null)),
      ),
    ).then(() => undefined);
    return this._loadPromise;
  }

  reload(): void {
    this._loadPromise = null;
    this.load();
  }

  canAccess(screen: string): boolean {
    const role = this.auth.currentUser()?.role;
    if (!role || role === 'superadmin') return true;
    const allowed = this._permissions()[role as keyof RolePermissions] ?? [];
    return allowed.includes(screen);
  }
}
