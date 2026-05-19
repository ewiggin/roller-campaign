import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ActivitiesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll makes GET /api/activities', () => {
    service.getAll().subscribe();
    http.expectOne(r => r.url === '/api/activities' && r.method === 'GET').flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes regionId and date params', () => {
    service.getAll({ regionId: 'r1', date: '2026-07-01' }).subscribe();
    const req = http.expectOne(r =>
      r.url === '/api/activities' &&
      r.params.get('regionId') === 'r1' &&
      r.params.get('date') === '2026-07-01',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getOne makes GET /api/activities/:id', () => {
    service.getOne('a1').subscribe();
    http.expectOne(r => r.url === '/api/activities/a1' && r.method === 'GET').flush({});
  });

  it('create makes POST /api/activities', () => {
    service.create({ region_id: 'r1', name: 'Test activity', date: '2026-07-01', start_time: '09:00', end_time: '13:00' }).subscribe();
    const req = http.expectOne('/api/activities');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('update makes PATCH /api/activities/:id', () => {
    service.update('a1', { description: 'Updated' }).subscribe();
    const req = http.expectOne('/api/activities/a1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove makes DELETE /api/activities/:id', () => {
    service.remove('a1').subscribe();
    http.expectOne(r => r.url === '/api/activities/a1' && r.method === 'DELETE').flush(null);
  });

  it('assignVolunteer makes POST /api/activities/:id/volunteers', () => {
    service.assignVolunteer('a1', 'v1').subscribe();
    const req = http.expectOne('/api/activities/a1/volunteers');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ volunteerId: 'v1' });
    req.flush({});
  });

  it('unassignVolunteer makes DELETE /api/activities/:id/volunteers/:vid', () => {
    service.unassignVolunteer('a1', 'v1').subscribe();
    http.expectOne(r => r.url === '/api/activities/a1/volunteers/v1' && r.method === 'DELETE').flush({});
  });

  it('getAvailableGroups makes GET /api/activities/:id/available-groups', () => {
    service.getAvailableGroups('a1').subscribe();
    http.expectOne(r => r.url === '/api/activities/a1/available-groups').flush([]);
  });

  it('assignGuestGroup makes POST /api/activities/:id/guest-groups', () => {
    service.assignGuestGroup('a1', 'grp1').subscribe();
    const req = http.expectOne('/api/activities/a1/guest-groups');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ groupId: 'grp1' });
    req.flush({});
  });

  it('unassignGuestGroup makes DELETE /api/activities/:id/guest-groups/:gid', () => {
    service.unassignGuestGroup('a1', 'grp1').subscribe();
    http.expectOne(r => r.url === '/api/activities/a1/guest-groups/grp1' && r.method === 'DELETE').flush({});
  });

  it('publish makes POST /api/activities/:id/publish', () => {
    service.publish('a1').subscribe();
    const req = http.expectOne('/api/activities/a1/publish');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('unpublish makes POST /api/activities/:id/unpublish', () => {
    service.unpublish('a1').subscribe();
    const req = http.expectOne('/api/activities/a1/unpublish');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('createBatch makes POST /api/activities/batch', () => {
    service.createBatch({
      region_id: 'r1', name: 'Batch', date: '2026-07-01', start_time: '09:00', end_time: '13:00',
      repetition: { type: 'daily', count: 3 },
    }).subscribe();
    const req = http.expectOne('/api/activities/batch');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.repetition).toEqual({ type: 'daily', count: 3 });
    req.flush([{}, {}, {}]);
  });

  it('updateSeriesFromDate makes PATCH /api/activities/:id/series-from-here', () => {
    service.updateSeriesFromDate('a1', { name: 'Updated' }).subscribe();
    const req = http.expectOne('/api/activities/a1/series-from-here');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Updated' });
    req.flush({});
  });

  it('removeSeriesFromDate makes DELETE /api/activities/:id/series-from-here', () => {
    service.removeSeriesFromDate('a1').subscribe();
    const req = http.expectOne('/api/activities/a1/series-from-here');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getAvailableVolunteers makes GET /api/activities/:id/available-volunteers', () => {
    service.getAvailableVolunteers('a1').subscribe();
    http.expectOne(r => r.url === '/api/activities/a1/available-volunteers' && r.method === 'GET').flush([]);
  });

  it('getAll passes dateFrom and dateTo params', () => {
    service.getAll({ dateFrom: '2026-06-01', dateTo: '2026-06-30' }).subscribe();
    const req = http.expectOne(r =>
      r.url === '/api/activities' &&
      r.params.get('dateFrom') === '2026-06-01' &&
      r.params.get('dateTo') === '2026-06-30',
    );
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('getAll passes hostId param', () => {
    service.getAll({ hostId: 'h1' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/activities' && r.params.get('hostId') === 'h1');
    req.flush({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('update sends detach_from_series flag', () => {
    service.update('a1', { name: 'Solo', detach_from_series: true }).subscribe();
    const req = http.expectOne('/api/activities/a1');
    expect(req.request.body.detach_from_series).toBe(true);
    req.flush({});
  });
});
