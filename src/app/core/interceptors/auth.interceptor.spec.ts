import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

function setup(token: string | null) {
  const mockAuthService = {
    getToken: vi.fn().mockReturnValue(token),
    logout: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: mockAuthService },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    mock: TestBed.inject(HttpTestingController),
    authService: mockAuthService,
  };
}

describe('authInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('adds Authorization header when token exists', () => {
    const { http, mock } = setup('my-token');
    http.get('/test').subscribe();
    const req = mock.expectOne('/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('does not add Authorization header when no token', () => {
    const { http, mock } = setup(null);
    http.get('/test').subscribe();
    const req = mock.expectOne('/test');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('calls logout on 401 response', () => {
    const { http, mock, authService } = setup('token');
    http.get('/test').subscribe({ error: () => {} });
    mock.expectOne('/test').flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    expect(authService.logout).toHaveBeenCalled();
  });

  it('does not call logout on non-401 errors', () => {
    const { http, mock, authService } = setup('token');
    http.get('/test').subscribe({ error: () => {} });
    mock.expectOne('/test').flush('Not Found', { status: 404, statusText: 'Not Found' });
    expect(authService.logout).not.toHaveBeenCalled();
  });
});
