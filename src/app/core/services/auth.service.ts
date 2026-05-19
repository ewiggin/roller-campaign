import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of, tap } from 'rxjs';
import type { JwtPayload, LoginRequest, LoginResponse } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem('admin_token'));

  readonly isAuthenticated = computed(() => !!this._token());

  readonly currentUser = computed((): JwtPayload | null => {
    const token = this._token();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload)) as JwtPayload;
    } catch {
      return null;
    }
  });

  readonly isSuperAdmin = computed(() => this.currentUser()?.role === 'superadmin');

  login(credentials: LoginRequest) {
    return this.http.post<LoginResponse>('/api/auth/login', credentials).pipe(
      tap((res) => {
        localStorage.setItem('admin_token', res.access_token);
        this._token.set(res.access_token);
      }),
    );
  }

  logout() {
    localStorage.removeItem('admin_token');
    this._token.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this._token();
  }

  checkSession(): Promise<void> {
    if (!this._token()) return Promise.resolve();
    return firstValueFrom(
      this.http.get('/api/auth/me').pipe(
        catchError(() => {
          localStorage.removeItem('admin_token');
          this._token.set(null);
          return of(null);
        }),
      ),
    ).then(() => undefined);
  }
}
