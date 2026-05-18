import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RegionsService } from './regions.service';

describe('RegionsService', () => {
  let service: RegionsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RegionsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll makes GET /api/regions', () => {
    service.getAll().subscribe();
    http.expectOne(r => r.url === '/api/regions' && r.method === 'GET').flush([]);
  });

  it('getOne makes GET /api/regions/:id', () => {
    service.getOne('r1').subscribe();
    http.expectOne(r => r.url === '/api/regions/r1' && r.method === 'GET').flush({});
  });

  it('create makes POST /api/regions', () => {
    service.create({ name: 'Madrid' }).subscribe();
    const req = http.expectOne('/api/regions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ name: 'Madrid' });
    req.flush({});
  });

  it('update makes PATCH /api/regions/:id', () => {
    service.update('r1', { name: 'Updated' }).subscribe();
    const req = http.expectOne('/api/regions/r1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove makes DELETE /api/regions/:id', () => {
    service.remove('r1').subscribe();
    http.expectOne(r => r.url === '/api/regions/r1' && r.method === 'DELETE').flush(null);
  });

  it('addCoordinator makes POST /api/regions/:id/coordinators', () => {
    service.addCoordinator('r1', 'u1').subscribe();
    const req = http.expectOne('/api/regions/r1/coordinators');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'u1' });
    req.flush({});
  });

  it('removeCoordinator makes DELETE /api/regions/:id/coordinators/:uid', () => {
    service.removeCoordinator('r1', 'u1').subscribe();
    http.expectOne(r => r.url === '/api/regions/r1/coordinators/u1' && r.method === 'DELETE').flush({});
  });

  it('exportExcel makes GET /api/regions/export', () => {
    service.exportExcel().subscribe();
    http.expectOne(r => r.url === '/api/regions/export' && r.method === 'GET').flush(new Blob());
  });

  it('downloadTemplate makes GET /api/regions/import/template', () => {
    service.downloadTemplate().subscribe();
    http.expectOne(r => r.url === '/api/regions/import/template' && r.method === 'GET').flush(new Blob());
  });

  it('parseImport makes POST /api/regions/import/parse', () => {
    service.parseImport(new File([], 'test.xlsx')).subscribe();
    const req = http.expectOne('/api/regions/import/parse');
    expect(req.request.method).toBe('POST');
    req.flush({ valid: [], errors: [], duplicateRows: [], summary: { total: 0, valid: 0, duplicates: 0, errors: 0 } });
  });

  it('commitImport makes POST /api/regions/import/commit', () => {
    service.commitImport([{ name: 'Madrid' }]).subscribe();
    const req = http.expectOne('/api/regions/import/commit');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ rows: [{ name: 'Madrid' }] });
    req.flush({ created: 1, updated: 0, total: 1 });
  });
});
