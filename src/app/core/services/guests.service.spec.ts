import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GuestsService } from './guests.service';

describe('GuestsService', () => {
  let service: GuestsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GuestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll makes GET /api/guests with no params', () => {
    service.getAll().subscribe();
    http.expectOne(r => r.url === '/api/guests' && r.method === 'GET').flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes regionId param', () => {
    service.getAll({ regionId: 'r1' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/guests' && r.params.get('regionId') === 'r1');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes search param', () => {
    service.getAll({ search: 'Juan' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/guests' && r.params.get('search') === 'Juan');
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getOne makes GET /api/guests/:id', () => {
    service.getOne('g1').subscribe();
    http.expectOne(r => r.url === '/api/guests/g1' && r.method === 'GET').flush({});
  });

  it('update makes PATCH /api/guests/:id', () => {
    service.update('g1', { full_name: 'New Name' }).subscribe();
    const req = http.expectOne('/api/guests/g1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({ full_name: 'New Name' });
    req.flush({});
  });

  it('remove makes DELETE /api/guests/:id', () => {
    service.remove('g1').subscribe();
    http.expectOne(r => r.url === '/api/guests/g1' && r.method === 'DELETE').flush(null);
  });

  it('migrate makes POST /api/guests/:id/migrate', () => {
    service.migrate('g1', 'grp2').subscribe();
    const req = http.expectOne('/api/guests/g1/migrate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetGroupId: 'grp2' });
    req.flush({});
  });

  it('generateToken makes GET /api/guests/:id/token', () => {
    service.generateToken('g1').subscribe();
    http.expectOne(r => r.url === '/api/guests/g1/token' && r.method === 'GET').flush({ token: 't', access_url: 'u' });
  });

  it('parseImport makes POST /api/guests/import/parse', () => {
    service.parseImport(new File([], 'guests.xlsx')).subscribe();
    const req = http.expectOne('/api/guests/import/parse');
    expect(req.request.method).toBe('POST');
    req.flush({ valid: [], errors: [], duplicates: [], duplicateRows: [], summary: { total: 0, valid: 0, errors: 0, duplicates: 0 } });
  });

  it('parseImport passes regionId in query string', () => {
    service.parseImport(new File([], 'guests.xlsx'), 'r1').subscribe();
    http.expectOne(r => r.url === '/api/guests/import/parse?regionId=r1').flush({ valid: [], errors: [], duplicates: [], duplicateRows: [], summary: { total: 0, valid: 0, errors: 0, duplicates: 0 } });
  });

  it('commitImport makes POST /api/guests/import/commit', () => {
    service.commitImport([{ guest_code: 'G1', group_code: 'GRP1', full_name: 'Juan' }]).subscribe();
    const req = http.expectOne('/api/guests/import/commit');
    expect(req.request.method).toBe('POST');
    req.flush({ created_guests: 1, updated_guests: 0, created_groups: 0, total: 1 });
  });

  it('exportExcel makes GET /api/guests/export', () => {
    service.exportExcel().subscribe();
    http.expectOne(r => r.url === '/api/guests/export' && r.method === 'GET').flush(new Blob());
  });

  it('downloadTemplate makes GET /api/guests/import/template', () => {
    service.downloadTemplate().subscribe();
    http.expectOne(r => r.url === '/api/guests/import/template').flush(new Blob());
  });
});
