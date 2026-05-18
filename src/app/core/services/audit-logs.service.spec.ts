import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuditLogsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll makes GET /api/audit-logs', () => {
    service.getAll().subscribe();
    http.expectOne(r => r.url === '/api/audit-logs' && r.method === 'GET').flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes resource param', () => {
    service.getAll({ resource: 'guest' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/audit-logs' && r.params.get('resource') === 'guest');
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes action param', () => {
    service.getAll({ action: 'create' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/audit-logs' && r.params.get('action') === 'create');
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes actor_email param', () => {
    service.getAll({ actor_email: 'admin@test.com' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/audit-logs' && r.params.get('actor_email') === 'admin@test.com');
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes date range params', () => {
    service.getAll({ from: '2026-01-01', to: '2026-12-31' }).subscribe();
    const req = http.expectOne(r =>
      r.url === '/api/audit-logs' &&
      r.params.get('from') === '2026-01-01' &&
      r.params.get('to') === '2026-12-31',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('exportCsv calls getAll with limit 5000 and page 1', () => {
    service.exportCsv({ resource: 'guest' }).subscribe();
    const req = http.expectOne(r =>
      r.url === '/api/audit-logs' &&
      r.params.get('limit') === '5000' &&
      r.params.get('page') === '1' &&
      r.params.get('resource') === 'guest',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 5000 });
  });
});
