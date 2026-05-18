import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HostsService } from './hosts.service';

describe('HostsService', () => {
  let service: HostsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HostsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll makes GET /api/hosts', () => {
    service.getAll().subscribe();
    http.expectOne(r => r.url === '/api/hosts' && r.method === 'GET').flush([]);
  });

  it('getAll with regionId appends query string', () => {
    service.getAll('r1').subscribe();
    http.expectOne(r => r.url === '/api/hosts?regionId=r1').flush([]);
  });

  it('getOne makes GET /api/hosts/:id', () => {
    service.getOne('h1').subscribe();
    http.expectOne(r => r.url === '/api/hosts/h1' && r.method === 'GET').flush({});
  });

  it('getGroupSuggestions makes GET /api/hosts/:id/group-suggestions', () => {
    service.getGroupSuggestions('h1').subscribe();
    http.expectOne(r => r.url === '/api/hosts/h1/group-suggestions').flush({ assigned: [], available: [] });
  });

  it('create makes POST /api/hosts', () => {
    service.create({ name: 'Casa López', region_id: 'r1' }).subscribe();
    const req = http.expectOne('/api/hosts');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('update makes PATCH /api/hosts/:id', () => {
    service.update('h1', { name: 'Updated' }).subscribe();
    const req = http.expectOne('/api/hosts/h1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove makes DELETE /api/hosts/:id', () => {
    service.remove('h1').subscribe();
    http.expectOne(r => r.url === '/api/hosts/h1' && r.method === 'DELETE').flush(null);
  });

  it('exportExcel makes GET /api/hosts/export', () => {
    service.exportExcel().subscribe();
    http.expectOne(r => r.url === '/api/hosts/export').flush(new Blob());
  });

  it('downloadTemplate makes GET /api/hosts/import/template', () => {
    service.downloadTemplate().subscribe();
    http.expectOne(r => r.url === '/api/hosts/import/template').flush(new Blob());
  });

  it('parseImport makes POST /api/hosts/import/parse', () => {
    service.parseImport(new File([], 'hosts.xlsx')).subscribe();
    const req = http.expectOne('/api/hosts/import/parse');
    expect(req.request.method).toBe('POST');
    req.flush({ valid: [], errors: [], duplicateRows: [], summary: { total: 0, valid: 0, duplicates: 0, errors: 0 } });
  });

  it('commitImport makes POST /api/hosts/import/commit', () => {
    service.commitImport([{ name: 'Casa López', region_name: 'Madrid' }]).subscribe();
    const req = http.expectOne('/api/hosts/import/commit');
    expect(req.request.method).toBe('POST');
    req.flush({ created: 1, updated: 0, total: 1 });
  });

  it('downloadGuestsExcel makes GET /api/hosts/:id/guests/export', () => {
    service.downloadGuestsExcel('h1').subscribe();
    http.expectOne(r => r.url === '/api/hosts/h1/guests/export').flush(new Blob());
  });
});
