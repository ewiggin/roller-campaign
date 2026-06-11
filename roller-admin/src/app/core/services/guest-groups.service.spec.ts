import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GuestGroupsService } from './guest-groups.service';

describe('GuestGroupsService', () => {
  let service: GuestGroupsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GuestGroupsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll makes GET /api/guest-groups', () => {
    service.getAll().subscribe();
    http
      .expectOne((r) => r.url === '/api/guest-groups' && r.method === 'GET')
      .flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes regionId param', () => {
    service.getAll({ regionId: 'r1' }).subscribe();
    const req = http.expectOne(
      (r) => r.url === '/api/guest-groups' && r.params.get('regionId') === 'r1',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('create makes POST /api/guest-groups', () => {
    service.create({ group_code: 'GRP-01', region_id: 'r1' }).subscribe();
    const req = http.expectOne('/api/guest-groups');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ group_code: 'GRP-01', region_id: 'r1' });
    req.flush({});
  });

  it('remove makes DELETE /api/guest-groups/:id', () => {
    service.remove('g1').subscribe();
    http.expectOne((r) => r.url === '/api/guest-groups/g1' && r.method === 'DELETE').flush(null);
  });

  it('setContact makes PATCH /api/guest-groups/:id/contact', () => {
    service.setContact('grp1', 'guest1').subscribe();
    const req = http.expectOne('/api/guest-groups/grp1/contact');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ guestId: 'guest1' });
    req.flush(null);
  });

  it('assignHost makes PATCH /api/guest-groups/:id/host', () => {
    service.assignHost('grp1', 'h1').subscribe();
    const req = http.expectOne('/api/guest-groups/grp1/host');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ hostId: 'h1' });
    req.flush({});
  });

  it('importFromExcel makes POST /api/guest-groups/import', () => {
    service.importFromExcel(new File([], 'groups.xlsx')).subscribe();
    const req = http.expectOne('/api/guest-groups/import');
    expect(req.request.method).toBe('POST');
    req.flush({ created: 1, skipped: 0, total: 1 });
  });

  it('getAll passes hasCars=true param', () => {
    service.getAll({ hasCars: true }).subscribe();
    const req = http.expectOne(
      (r) => r.url === '/api/guest-groups' && r.params.get('hasCars') === 'true',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 50 });
  });

  it('getAll passes hasCars=false param', () => {
    service.getAll({ hasCars: false }).subscribe();
    const req = http.expectOne(
      (r) => r.url === '/api/guest-groups' && r.params.get('hasCars') === 'false',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 50 });
  });

  it('getAll omits hasCars param when undefined', () => {
    service.getAll({ hasCars: undefined }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/guest-groups');
    expect(req.request.params.has('hasCars')).toBe(false);
    req.flush({ data: [], total: 0, page: 1, limit: 50 });
  });

  it('update sends car_count', () => {
    service.update('g1', { car_count: 3 }).subscribe();
    const req = http.expectOne('/api/guest-groups/g1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({ car_count: 3 });
    req.flush({});
  });

  it('recomputeAggregates makes POST /api/guest-groups/recompute-aggregates', () => {
    service.recomputeAggregates().subscribe();
    const req = http.expectOne('/api/guest-groups/recompute-aggregates');
    expect(req.request.method).toBe('POST');
    req.flush({ groups_updated: 2, computed_at: '2026-06-10T10:00:00.000Z' });
  });

  it('exportExcel makes GET /api/guest-groups/export', () => {
    service.exportExcel().subscribe();
    http.expectOne((r) => r.url === '/api/guest-groups/export').flush(new Blob());
  });

  it('downloadTemplate makes GET /api/guest-groups/import/template', () => {
    service.downloadTemplate().subscribe();
    http.expectOne((r) => r.url === '/api/guest-groups/import/template').flush(new Blob());
  });
});
