import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function setup(initialToken?: string) {
  if (initialToken) {
    localStorage.setItem('admin_token', initialToken);
  } else {
    localStorage.removeItem('admin_token');
  }
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return {
    service: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

describe('AuthService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem('admin_token');
  });

  describe('initial state', () => {
    it('isAuthenticated is false with no token', () => {
      const { service } = setup();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('isAuthenticated is true with existing token', () => {
      const { service } = setup(makeJwt({ sub: '1', email: 'a@b.com', role: 'superadmin', iat: 0, exp: 9999999999 }));
      expect(service.isAuthenticated()).toBe(true);
    });

    it('currentUser is null with no token', () => {
      const { service } = setup();
      expect(service.currentUser()).toBeNull();
    });

    it('currentUser parses JWT payload', () => {
      const payload = { sub: 'u1', email: 'x@y.com', role: 'superadmin', iat: 0, exp: 9999999999 };
      const { service } = setup(makeJwt(payload));
      const user = service.currentUser();
      expect(user?.sub).toBe('u1');
      expect(user?.email).toBe('x@y.com');
      expect(user?.role).toBe('superadmin');
    });

    it('isSuperAdmin is true for superadmin role', () => {
      const { service } = setup(makeJwt({ sub: '1', email: 'a@b.com', role: 'superadmin', iat: 0, exp: 9999999999 }));
      expect(service.isSuperAdmin()).toBe(true);
    });

    it('isSuperAdmin is false for region_admin role', () => {
      const { service } = setup(makeJwt({ sub: '1', email: 'a@b.com', role: 'region_admin', iat: 0, exp: 9999999999 }));
      expect(service.isSuperAdmin()).toBe(false);
    });

    it('getToken returns null when no token', () => {
      const { service } = setup();
      expect(service.getToken()).toBeNull();
    });

    it('getToken returns token when present', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', role: 'superadmin', iat: 0, exp: 9999999999 });
      const { service } = setup(token);
      expect(service.getToken()).toBe(token);
    });
  });

  describe('login()', () => {
    it('makes POST to /api/auth/login with credentials', () => {
      const { service, http } = setup();
      service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
      const req = http.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'a@b.com', password: 'secret' });
      req.flush({ access_token: makeJwt({ sub: '1', email: 'a@b.com', role: 'superadmin' }) });
    });

    it('stores token in localStorage after login', () => {
      const { service, http } = setup();
      const token = makeJwt({ sub: '1', email: 'a@b.com', role: 'superadmin' });
      service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
      http.expectOne('/api/auth/login').flush({ access_token: token });
      expect(localStorage.getItem('admin_token')).toBe(token);
    });

    it('sets isAuthenticated to true after login', () => {
      const { service, http } = setup();
      const token = makeJwt({ sub: '1', email: 'a@b.com', role: 'superadmin' });
      service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
      http.expectOne('/api/auth/login').flush({ access_token: token });
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('logout()', () => {
    it('clears localStorage and sets isAuthenticated to false', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', role: 'superadmin' });
      const { service, http, router } = setup();
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      service.login({ email: 'a@b.com', password: 'pass' }).subscribe();
      http.expectOne('/api/auth/login').flush({ access_token: token });
      service.logout();
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('admin_token')).toBeNull();
    });

    it('navigates to /login', () => {
      const { service, router } = setup();
      const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      service.logout();
      expect(spy).toHaveBeenCalledWith(['/login']);
    });
  });
});
