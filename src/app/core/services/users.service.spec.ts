import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll makes GET /api/users', () => {
    service.getAll().subscribe();
    http.expectOne((r) => r.url === '/api/users' && r.method === 'GET').flush([]);
  });

  it('create makes POST /api/users', () => {
    service.create({ email: 'a@b.com', password: 'pass', role: 'region_admin' }).subscribe();
    const req = http.expectOne('/api/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ email: 'a@b.com', role: 'region_admin' });
    req.flush({});
  });

  it('update makes PATCH /api/users/:id', () => {
    service.update('u1', { email: 'new@b.com' }).subscribe();
    const req = http.expectOne('/api/users/u1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove makes DELETE /api/users/:id', () => {
    service.remove('u1').subscribe();
    http.expectOne((r) => r.url === '/api/users/u1' && r.method === 'DELETE').flush(null);
  });
});
