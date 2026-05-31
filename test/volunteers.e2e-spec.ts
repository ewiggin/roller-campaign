import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildExcelBuffer, createTestApp, loginAdmin } from './test-app';

describe('Volunteers (e2e)', () => {
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
      .send({ name: 'Test Region' });
    regionId = region.body.id;
  });

  afterAll(() => app.close());

  const auth = () => `Bearer ${adminToken}`;

  // ── Roles ────────────────────────────────────────────────────────────────

  describe('Volunteer roles', () => {
    let roleId: string;

    it('POST /api/volunteers/roles creates a role', async () => {
      const res = await request(server)
        .post('/api/volunteers/roles')
        .set('Authorization', auth())
        .send({ name: 'Conductor' })
        .expect(201);
      expect(res.body.name).toBe('Conductor');
      roleId = res.body.id;
    });

    it('returns 409 for duplicate role name', () =>
      request(server)
        .post('/api/volunteers/roles')
        .set('Authorization', auth())
        .send({ name: 'Conductor' })
        .expect(409));

    it('GET /api/volunteers/roles returns all roles', async () => {
      const res = await request(server).get('/api/volunteers/roles').set('Authorization', auth()).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /api/volunteers/roles/:id deletes a role', async () => {
      const tmp = await request(server)
        .post('/api/volunteers/roles')
        .set('Authorization', auth())
        .send({ name: 'Temporal' });
      await request(server).delete(`/api/volunteers/roles/${tmp.body.id}`).set('Authorization', auth()).expect(204);
    });
  });

  // ── CRUD ─────────────────────────────────────────────────────────────────

  describe('Volunteer CRUD', () => {
    it('POST /api/volunteers creates a volunteer', async () => {
      const res = await request(server)
        .post('/api/volunteers')
        .set('Authorization', auth())
        .send({ volunteer_code: 'V-001', full_name: 'Carlos López', email: 'carlos@test.local', region_ids: [regionId] })
        .expect(201);
      expect(res.body).toMatchObject({ volunteer_code: 'V-001', full_name: 'Carlos López', is_active: true });
      expect(res.body.regions).toHaveLength(1);
    });

    it('returns 409 for duplicate volunteer_code', () =>
      request(server)
        .post('/api/volunteers')
        .set('Authorization', auth())
        .send({ volunteer_code: 'V-001', full_name: 'Otro' })
        .expect(409));

    it('GET /api/volunteers returns list', async () => {
      const res = await request(server)
        .get(`/api/volunteers?regionId=${regionId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('total');
    });

    it('GET /api/volunteers filters by search', async () => {
      const res = await request(server)
        .get(`/api/volunteers?search=Carlos`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data[0].full_name).toContain('Carlos');
    });

    it('PATCH /api/volunteers/:id updates volunteer', async () => {
      const created = await request(server)
        .post('/api/volunteers')
        .set('Authorization', auth())
        .send({ volunteer_code: 'V-UPD', full_name: 'Original' });

      const res = await request(server)
        .patch(`/api/volunteers/${created.body.id}`)
        .set('Authorization', auth())
        .send({ full_name: 'Actualizado', is_active: false })
        .expect(200);
      expect(res.body.full_name).toBe('Actualizado');
      expect(res.body.is_active).toBe(false);
    });

    it('PATCH /api/volunteers/:id assigns roles', async () => {
      const role = await request(server)
        .post('/api/volunteers/roles')
        .set('Authorization', auth())
        .send({ name: 'Traductor' });

      const vol = await request(server)
        .post('/api/volunteers')
        .set('Authorization', auth())
        .send({ volunteer_code: 'V-ROLE', full_name: 'Con Rol' });

      const res = await request(server)
        .patch(`/api/volunteers/${vol.body.id}`)
        .set('Authorization', auth())
        .send({ role_ids: [role.body.id] })
        .expect(200);
      expect(res.body.roles).toHaveLength(1);
      expect(res.body.roles[0].name).toBe('Traductor');
    });

    it('DELETE /api/volunteers/:id deletes', async () => {
      const vol = await request(server)
        .post('/api/volunteers')
        .set('Authorization', auth())
        .send({ volunteer_code: 'V-DEL', full_name: 'Borrar' });
      await request(server).delete(`/api/volunteers/${vol.body.id}`).set('Authorization', auth()).expect(204);
      await request(server).get(`/api/volunteers/${vol.body.id}`).set('Authorization', auth()).expect(404);
    });
  });

  // ── Availability ──────────────────────────────────────────────────────────

  describe('Volunteer availability', () => {
    let volId: string;

    beforeAll(async () => {
      const v = await request(server)
        .post('/api/volunteers')
        .set('Authorization', auth())
        .send({ volunteer_code: 'V-AVAIL', full_name: 'Disponible', region_ids: [regionId] });
      volId = v.body.id;
    });

    it('PUT /api/volunteers/:id/availability sets dates', async () => {
      const res = await request(server)
        .put(`/api/volunteers/${volId}/availability`)
        .set('Authorization', auth())
        .send({ region_id: regionId, dates: ['2024-06-15', '2024-06-16', '2024-06-17'] })
        .expect(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].date).toBe('2024-06-15');
    });

    it('PUT replaces existing availability for a region', async () => {
      const res = await request(server)
        .put(`/api/volunteers/${volId}/availability`)
        .set('Authorization', auth())
        .send({ region_id: regionId, dates: ['2024-06-20'] })
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].date).toBe('2024-06-20');
    });

    it('PUT with empty dates clears availability', async () => {
      const res = await request(server)
        .put(`/api/volunteers/${volId}/availability`)
        .set('Authorization', auth())
        .send({ region_id: regionId, dates: [] })
        .expect(200);
      expect(res.body).toHaveLength(0);
    });

    it('GET /api/volunteers/:id/availability returns entries', async () => {
      await request(server)
        .put(`/api/volunteers/${volId}/availability`)
        .set('Authorization', auth())
        .send({ region_id: regionId, dates: ['2024-06-18', '2024-06-19'] });

      const res = await request(server)
        .get(`/api/volunteers/${volId}/availability`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.length).toBe(2);
    });
  });

  // ── Import ────────────────────────────────────────────────────────────────

  describe('Volunteer import', () => {
    it('GET /api/volunteers/import/template returns xlsx', async () => {
      const res = await request(server)
        .get('/api/volunteers/import/template')
        .set('Authorization', auth())
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
    });

    it('POST /api/volunteers/import/parse detects existing codes (skip)', async () => {
      const xlsx = buildExcelBuffer([
        { 'Número de identificación': 'V-001', 'Nombre': 'Ya existe' },
        { 'Número de identificación': 'V-NEW-1', 'Nombre': 'Nuevo Uno', 'Email': 'nuevo1@test.com' },
        { 'Número de identificación': 'V-NEW-2', 'Nombre': 'Nuevo Dos' },
      ]);
      const res = await request(server)
        .post('/api/volunteers/import/parse')
        .set('Authorization', auth())
        .attach('file', xlsx, 'voluntarios.xlsx')
        .expect(200);
      expect(res.body.summary.total).toBe(3);
      expect(res.body.summary.to_create).toBe(2);
      expect(res.body.summary.skipped).toBe(1);
      expect(res.body.skipped).toContain('V-001');
    });

    it('POST /api/volunteers/import/commit creates and skips', async () => {
      const res = await request(server)
        .post('/api/volunteers/import/commit')
        .set('Authorization', auth())
        .send({
          region_ids: [regionId],
          rows: [
            { volunteer_code: 'V-NEW-1', full_name: 'Nuevo Uno' },
            { volunteer_code: 'V-NEW-2', full_name: 'Nuevo Dos' },
            { volunteer_code: 'V-001', full_name: 'Ya existe (skip)' },
          ],
        })
        .expect(200);
      expect(res.body.created).toBe(2);
      expect(res.body.skipped).toBe(1);

      const list = await request(server)
        .get(`/api/volunteers?regionId=${regionId}`)
        .set('Authorization', auth());
      const codes = list.body.data.map((v: { volunteer_code: string }) => v.volunteer_code);
      expect(codes).toContain('V-NEW-1');
      expect(codes).toContain('V-NEW-2');
    });
  });

  describe('region_admin access paths', () => {
    let coordToken: string;
    let coordRegionId: string;

    beforeAll(async () => {
      const region = (await request(server).post('/api/regions').set('Authorization', auth())
        .send({ name: `CoordVolReg-${Date.now()}` })).body;
      coordRegionId = region.id;

      const userRes = (await request(server).post('/api/users').set('Authorization', auth())
        .send({ email: `coord-vol-${Date.now()}@test.local`, password: 'pass1234', role: 'region_admin' })).body;

      await request(server).post(`/api/regions/${coordRegionId}/coordinators`)
        .set('Authorization', auth()).send({ userId: userRes.id });

      coordToken = (await request(server).post('/api/auth/login')
        .send({ email: userRes.email, password: 'pass1234' })).body.access_token;

      await request(server).post('/api/volunteers').set('Authorization', auth()).send({
        volunteer_code: `VCRD-${Date.now()}`, full_name: 'Coord Vol', region_ids: [coordRegionId],
      });
    });

    it('region_admin can list volunteers in their region', async () => {
      const res = await request(server)
        .get(`/api/volunteers?regionId=${coordRegionId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Volunteer filters', () => {
    let filterRegionId: string;
    let filterRoleId: string;

    beforeAll(async () => {
      const region = (await request(server).post('/api/regions').set('Authorization', auth())
        .send({ name: `FilterReg-${Date.now()}` })).body;
      filterRegionId = region.id;

      const role = (await request(server).post('/api/volunteers/roles').set('Authorization', auth())
        .send({ name: `FRole-${Date.now()}` })).body;
      filterRoleId = role.id;

      await request(server).post('/api/volunteers').set('Authorization', auth()).send({
        volunteer_code: `VF-${Date.now()}`,
        full_name: 'Filterable Vol',
        region_ids: [filterRegionId],
        role_ids: [filterRoleId],
        is_active: true,
      });

      await request(server).post('/api/volunteers').set('Authorization', auth()).send({
        volunteer_code: `VI-${Date.now()}`,
        full_name: 'Inactive Vol',
        region_ids: [filterRegionId],
        is_active: false,
      });
    });

    it('filters by roleId', async () => {
      const res = await request(server)
        .get(`/api/volunteers?roleId=${filterRoleId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((v: { roles: { id: string }[] }) =>
        v.roles.some((r) => r.id === filterRoleId),
      )).toBe(true);
    });

    it('filters by is_active=false', async () => {
      const res = await request(server)
        .get(`/api/volunteers?regionId=${filterRegionId}&is_active=false`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((v: { is_active: boolean }) => !v.is_active)).toBe(true);
    });
  });

  describe('GET /api/volunteers/:id', () => {
    it('returns a specific volunteer', async () => {
      const created = (await request(server).post('/api/volunteers').set('Authorization', auth())
        .send({ volunteer_code: `VG-${Date.now()}`, full_name: 'Get Vol', region_ids: [] })).body;
      const res = await request(server)
        .get(`/api/volunteers/${created.id}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.id).toBe(created.id);
    });

    it('returns 404 for unknown id', () =>
      request(server).get('/api/volunteers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth()).expect(404));
  });

  describe('Volunteer "me" endpoints (volunteer role)', () => {
    let volunteerToken: string;
    let volunteerId: string;
    let meRegionId: string;

    beforeAll(async () => {
      const region = (await request(server).post('/api/regions').set('Authorization', auth())
        .send({ name: `MeReg-${Date.now()}` })).body;
      meRegionId = region.id;

      const userRes = (await request(server).post('/api/users').set('Authorization', auth())
        .send({ email: `vol-me-${Date.now()}@test.local`, password: 'pass1234', role: 'volunteer' })).body;

      const vol = (await request(server).post('/api/volunteers').set('Authorization', auth()).send({
        volunteer_code: `VOLME-${Date.now()}`,
        full_name: 'Volunteer Me',
        region_ids: [meRegionId],
        user_id: userRes.id,
      })).body;
      volunteerId = vol.id;

      volunteerToken = (await request(server).post('/api/auth/login')
        .send({ email: userRes.email, password: 'pass1234' })).body.access_token;
    });

    it('GET /api/volunteers/me returns the linked volunteer', async () => {
      const res = await request(server)
        .get('/api/volunteers/me')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .expect(200);
      expect(res.body.id).toBe(volunteerId);
    });

    it('GET /api/volunteers/me/availability returns entries', async () => {
      const res = await request(server)
        .get('/api/volunteers/me/availability')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('PUT /api/volunteers/me/availability sets availability', async () => {
      const res = await request(server)
        .put('/api/volunteers/me/availability')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ region_id: meRegionId, dates: ['2026-07-01', '2026-07-02'] })
        .expect(200);
      expect(res.body.length).toBe(2);
    });
  });

  describe('PATCH /api/volunteers/:id with region_ids', () => {
    it('updates region assignments', async () => {
      const r1 = (await request(server).post('/api/regions').set('Authorization', auth()).send({ name: `VR1-${Date.now()}` })).body;
      const r2 = (await request(server).post('/api/regions').set('Authorization', auth()).send({ name: `VR2-${Date.now()}` })).body;
      const vol = (await request(server).post('/api/volunteers').set('Authorization', auth())
        .send({ volunteer_code: `VREG-${Date.now()}`, full_name: 'Region Updater', region_ids: [r1.id] })).body;

      const res = await request(server)
        .patch(`/api/volunteers/${vol.id}`)
        .set('Authorization', auth())
        .send({ region_ids: [r1.id, r2.id] })
        .expect(200);
      expect(res.body.regions.length).toBe(2);
    });
  });
});
