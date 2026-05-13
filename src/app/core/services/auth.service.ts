import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import type { LoginRequest, LoginResponse, JwtPayload } from '../models/auth.model';

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
}
