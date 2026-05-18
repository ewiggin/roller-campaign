import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiUrlInterceptor } from './api-url.interceptor';
import { environment } from '../../../environments/environment';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiUrlInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    mock: TestBed.inject(HttpTestingController),
  };
}

describe('apiUrlInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('transforms /api/... URL to environment.apiUrl + path', () => {
    const { http, mock } = setup();
    http.get('/api/users').subscribe();
    const req = mock.expectOne(`${environment.apiUrl}/users`);
    expect(req.request.url).toBe(`${environment.apiUrl}/users`);
    req.flush([]);
  });

  it('transforms /api/ root URL', () => {
    const { http, mock } = setup();
    http.get('/api/').subscribe();
    mock.expectOne(`${environment.apiUrl}/`).flush({});
  });

  it('does not transform non-/api/ URLs', () => {
    const { http, mock } = setup();
    http.get('/other/path').subscribe();
    mock.expectOne('/other/path').flush({});
  });
});
