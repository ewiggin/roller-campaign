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
        { volunteer_code: 'V-001', full_name: 'Ya existe' },
        { volunteer_code: 'V-NEW-1', full_name: 'Nuevo Uno', email: 'nuevo1@test.com' },
        { volunteer_code: 'V-NEW-2', full_name: 'Nuevo Dos' },
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
});
