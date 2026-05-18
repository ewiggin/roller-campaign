import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  function setup(authenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isAuthenticated: signal(authenticated) },
        },
      ],
    });
  }

  it('returns true when authenticated', () => {
    setup(true);
    const result = TestBed.runInInjectionContext(authGuard);
    expect(result).toBe(true);
  });

  it('returns UrlTree to /login when not authenticated', () => {
    setup(false);
    const result = TestBed.runInInjectionContext(authGuard);
    expect(result).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
