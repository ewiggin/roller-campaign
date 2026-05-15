import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { binaryParser, buildExcelBuffer, createTestApp, loginAdmin, parseExcelHeaders, parseExcelResponse } from './test-app';

describe('Hosts (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;
  let regionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    adminToken = await loginAdmin(server);

    const region = await request(server)
      .post('/api/regions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Hosts Region', event_start_date: '2026-07-01', event_end_date: '2026-07-07' })
      .expect(201);
    regionId = region.body.id;
  });

  afterAll(() => app.close());

  const auth = () => `Bearer ${adminToken}`;

  const baseHost = () => ({
    name: `Congregación ${Date.now()}`,
    region_id: regionId,
    address: 'Calle Mayor 1, Girona',
    lat: 41.9794,
    lng: 2.8214,
    weekday_meeting_day: 2,
    weekday_meeting_time: '19:30',
    weekend_meeting_day: 7,
    weekend_meeting_time: '10:00',
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  describe('POST /api/hosts', () => {
    it('creates a host', async () => {
      const res = await request(server)
        .post('/api/hosts')
        .set('Authorization', auth())
        .send(baseHost())
        .expect(201);
      expect(res.body).toMatchObject({
        region_id: regionId,
        weekday_meeting_day: 2,
        weekday_meeting_time: '19:30',
        group_count: 0,
      });
      expect(res.body.id).toBeDefined();
    });

    it('returns 404 for non-existent region', () =>
      request(server)
        .post('/api/hosts')
        .set('Authorization', auth())
        .send({ ...baseHost(), region_id: '00000000-0000-0000-0000-000000000000' })
        .expect(404));

    it('returns 400 for missing name', () =>
      request(server)
        .post('/api/hosts')
        .set('Authorization', auth())
        .send({ region_id: regionId })
        .expect(400));

    it('returns 401 without auth', () =>
      request(server).post('/api/hosts').send(baseHost()).expect(401));
  });

  describe('GET /api/hosts', () => {
    it('returns list of hosts for region', async () => {
      const res = await request(server)
        .get(`/api/hosts?regionId=${regionId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('group_count');
    });

    it('returns all hosts for superadmin without filter', async () => {
      const res = await request(server)
        .get('/api/hosts')
        .set('Authorization', auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/hosts/:id', () => {
    it('returns a specific host', async () => {
      const created = (await request(server)
        .post('/api/hosts').set('Authorization', auth()).send(baseHost())).body;
      const res = await request(server)
        .get(`/api/hosts/${created.id}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.region_id).toBe(regionId);
    });

    it('returns 404 for unknown id', () =>
      request(server)
        .get('/api/hosts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .expect(404));
  });

  describe('PATCH /api/hosts/:id', () => {
    it('updates host fields', async () => {
      const created = (await request(server)
        .post('/api/hosts').set('Authorization', auth()).send(baseHost())).body;
      const res = await request(server)
        .patch(`/api/hosts/${created.id}`)
        .set('Authorization', auth())
        .send({ address: 'Nueva Dirección 42', weekday_meeting_day: 3 })
        .expect(200);
      expect(res.body.address).toBe('Nueva Dirección 42');
      expect(res.body.weekday_meeting_day).toBe(3);
    });

    it('returns 404 for unknown id', () =>
      request(server)
        .patch('/api/hosts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .send({ address: 'X' })
        .expect(404));
  });

  describe('DELETE /api/hosts/:id', () => {
    it('deletes a host', async () => {
      const created = (await request(server)
        .post('/api/hosts').set('Authorization', auth()).send(baseHost())).body;
      await request(server)
        .delete(`/api/hosts/${created.id}`)
        .set('Authorization', auth())
        .expect(204);
      await request(server)
        .get(`/api/hosts/${created.id}`)
        .set('Authorization', auth())
        .expect(404);
    });

    it('returns 404 for unknown id', () =>
      request(server)
        .delete('/api/hosts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .expect(404));
  });

  // ── Group suggestions ──────────────────────────────────────────────────────

  describe('GET /api/hosts/:id/group-suggestions', () => {
    it('returns assigned and available groups', async () => {
      const host = (await request(server)
        .post('/api/hosts').set('Authorization', auth()).send(baseHost())).body;

      // Create a group without a host (available)
      await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: `SUGG-${Date.now()}`, region_id: regionId });

      const res = await request(server)
        .get(`/api/hosts/${host.id}/group-suggestions`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body).toHaveProperty('assigned');
      expect(res.body).toHaveProperty('available');
      expect(Array.isArray(res.body.assigned)).toBe(true);
      expect(Array.isArray(res.body.available)).toBe(true);
    });
  });

  // ── Import / Export Excel ──────────────────────────────────────────────────

  describe('Import / Export Excel', () => {
    it('GET /api/hosts/import/template returns xlsx with correct headers', async () => {
      const res = await request(server)
        .get('/api/hosts/import/template')
        .set('Authorization', auth())
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
      const headers = parseExcelHeaders(res.body as Buffer);
      expect(headers).toContain('name');
      expect(headers).toContain('region_name');
      expect(headers).toContain('weekday_meeting_day');
    });

    it('POST /api/hosts/import/parse returns preview', async () => {
      const file = buildExcelBuffer([
        { name: 'Congregación Parse', region_name: 'Hosts Region', address: 'Calle Test 1' },
        { name: 'Congregación Sin Región', region_name: 'Región Inexistente' },
        { name: '', region_name: 'Hosts Region' },
      ]);
      const res = await request(server)
        .post('/api/hosts/import/parse')
        .set('Authorization', auth())
        .attach('file', file, 'hosts.xlsx')
        .expect(200);
      expect(res.body.summary.total).toBe(3);
      expect(res.body.summary.valid).toBe(1);
      expect(res.body.summary.errors).toBe(2);
      expect(res.body.valid[0].name).toBe('Congregación Parse');
    });

    it('POST /api/hosts/import/commit creates hosts', async () => {
      const rows = [
        { name: `Import Host ${Date.now()}`, region_name: 'Hosts Region', address: 'Calle Import 1' },
      ];
      const res = await request(server)
        .post('/api/hosts/import/commit')
        .set('Authorization', auth())
        .send({ rows })
        .expect(200);
      expect(res.body.created).toBe(1);
      expect(res.body.updated).toBe(0);
    });

    it('POST /api/hosts/import/commit skips duplicates', async () => {
      const name = `Dup Host ${Date.now()}`;
      await request(server)
        .post('/api/hosts').set('Authorization', auth())
        .send({ name, region_id: regionId });

      const res = await request(server)
        .post('/api/hosts/import/commit')
        .set('Authorization', auth())
        .send({ rows: [{ name, region_name: 'Hosts Region' }] })
        .expect(200);
      expect(res.body.created).toBe(0);
    });

    it('GET /api/hosts/:id/guests/export returns xlsx with guest data', async () => {
      const host = (await request(server).post('/api/hosts').set('Authorization', auth()).send(baseHost())).body;

      const grp = (await request(server).post('/api/guest-groups').set('Authorization', auth())
        .send({ group_code: `HEXP-${Date.now()}`, region_id: regionId })).body;

      await request(server).patch(`/api/guest-groups/${grp.id}/host`).set('Authorization', auth()).send({ hostId: host.id });

      await request(server).post('/api/guests').set('Authorization', auth()).send({
        guest_code: `GEXP-${Date.now()}`, group_id: grp.id, region_id: regionId, full_name: 'Export Guest',
      });

      const res = await request(server)
        .get(`/api/hosts/${host.id}/guests/export`)
        .set('Authorization', auth())
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
      const rows = parseExcelResponse(res.body as Buffer);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('GET /api/hosts/export returns xlsx with host data', async () => {
      const res = await request(server)
        .get(`/api/hosts/export?regionId=${regionId}`)
        .set('Authorization', auth())
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
      const rows = parseExcelResponse(res.body as Buffer);
      expect(rows.length).toBeGreaterThan(0);
      const row = rows[0] as Record<string, unknown>;
      expect(row['name']).toBeDefined();
      expect(row['region_name']).toBeDefined();
    });
  });

  describe('Import commit with updateRows', () => {
    it('updates existing hosts via updateRows', async () => {
      const name = `Update Existing ${Date.now()}`;
      await request(server).post('/api/hosts').set('Authorization', auth())
        .send({ name, region_id: regionId, address: 'Original Address' });

      const res = await request(server)
        .post('/api/hosts/import/commit')
        .set('Authorization', auth())
        .send({ rows: [], updateRows: [{ name, region_name: 'Hosts Region', address: 'Updated Address' }] })
        .expect(200);
      expect(res.body.updated).toBe(1);
    });
  });

  // ── Access control ────────────────────────────────────────────────────────

  describe('Access control', () => {
    it('region_admin can only see hosts in their region', async () => {
      const userRes = await request(server)
        .post('/api/users')
        .set('Authorization', auth())
        .send({ email: 'admin.hosts@test.local', password: 'pass1234', role: 'region_admin' });

      await request(server)
        .post(`/api/regions/${regionId}/coordinators`)
        .set('Authorization', auth())
        .send({ userId: userRes.body.id });

      const coordToken = (await request(server)
        .post('/api/auth/login')
        .send({ email: 'admin.hosts@test.local', password: 'pass1234' })).body.access_token;

      const otherRegion = (await request(server)
        .post('/api/regions').set('Authorization', auth())
        .send({ name: 'Other Region Hosts' })).body;

      await request(server)
        .post('/api/hosts').set('Authorization', auth())
        .send({ ...baseHost(), name: 'Hidden Host', region_id: otherRegion.id });

      const res = await request(server)
        .get('/api/hosts')
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      const hostIds = res.body.map((h: { region_id: string }) => h.region_id);
      expect(hostIds.every((id: string) => id === regionId)).toBe(true);
    });
  });
});
