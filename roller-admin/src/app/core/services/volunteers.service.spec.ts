import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VolunteersService } from './volunteers.service';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VolunteersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll makes GET /api/volunteers with default limit 50', () => {
    service.getAll().subscribe();
    const req = http.expectOne(
      (r) => r.url === '/api/volunteers' && r.params.get('limit') === '50',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, page: 1, limit: 50 });
  });

  it('getAll passes regionId param', () => {
    service.getAll({ regionId: 'r1' }).subscribe();
    const req = http.expectOne(
      (r) => r.url === '/api/volunteers' && r.params.get('regionId') === 'r1',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 50 });
  });

  it('getAll passes custom limit', () => {
    service.getAll({ limit: 50 }).subscribe();
    const req = http.expectOne(
      (r) => r.url === '/api/volunteers' && r.params.get('limit') === '50',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 50 });
  });
});
