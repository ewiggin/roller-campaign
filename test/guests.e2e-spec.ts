import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildExcelBuffer, createTestApp, loginAdmin } from './test-app';

describe('Guests (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;
  let regionId: string;
  let groupId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    adminToken = await loginAdmin(server);

    const region = await request(server)
      .post('/api/regions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Region',
        event_start_date: '2024-06-15',
        event_end_date: '2024-06-22',
      });
    regionId = region.body.id;

    const group = await request(server)
      .post('/api/guest-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ group_code: 'GRP-001', region_id: regionId });
    groupId = group.body.id;
  });

  afterAll(() => app.close());

  const auth = () => `Bearer ${adminToken}`;

  const baseGuest = () => ({
    guest_code: `G-${Date.now()}`,
    group_id: groupId,
    region_id: regionId,
    full_name: 'Juan García',
    status: 'pending' as const,
  });

  // ---------------------------------------------------------------------------
  describe('POST /api/guests', () => {
    it('creates a guest with all required fields', async () => {
      const body = {
        ...baseGuest(),
        arrival_transport: 'plane',
        arrival_date: '2024-06-14',
      };
      const res = await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send(body)
        .expect(201);

      expect(res.body).toMatchObject({
        full_name: 'Juan García',
        arrival_transport: 'plane',
        status: 'pending',
      });
      expect(res.body.id).toBeDefined();
    });

    it('returns 409 for duplicate guest_code', async () => {
      const body = { ...baseGuest(), guest_code: 'G-DUPE' };
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send(body)
        .expect(201);
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send(body)
        .expect(409);
    });

    it('returns 400 for invalid transport value', () =>
      request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ ...baseGuest(), arrival_transport: 'helicopter' })
        .expect(400));

    it('returns 400 if group belongs to a different region', async () => {
      const otherRegion = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Other Region' });

      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ ...baseGuest(), region_id: otherRegion.body.id })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('GET /api/guests (list + filters)', () => {
    beforeAll(async () => {
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          ...baseGuest(),
          guest_code: 'G-LIST-1',
          full_name: 'Ana Martín',
          status: 'confirmed',
        });
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          ...baseGuest(),
          guest_code: 'G-LIST-2',
          full_name: 'Pedro Sánchez',
          status: 'pending',
        });
    });

    it('returns paginated list', async () => {
      const res = await request(server)
        .get(`/api/guests?regionId=${regionId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('filters by status', async () => {
      const res = await request(server)
        .get(`/api/guests?regionId=${regionId}&status=confirmed`)
        .set('Authorization', auth())
        .expect(200);

      expect(
        res.body.data.every(
          (g: { status: string }) => g.status === 'confirmed',
        ),
      ).toBe(true);
    });

    it('filters by search (name)', async () => {
      const res = await request(server)
        .get(`/api/guests?regionId=${regionId}&search=Pedro`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].full_name).toContain('Pedro');
    });

    it('filters by groupId', async () => {
      const res = await request(server)
        .get(`/api/guests?groupId=${groupId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(
        res.body.data.every(
          (g: { group_id: string }) => g.group_id === groupId,
        ),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  describe('PATCH /api/guests/:id', () => {
    it('updates guest fields', async () => {
      const created = await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ ...baseGuest(), guest_code: 'G-UPD' });

      const res = await request(server)
        .patch(`/api/guests/${created.body.id}`)
        .set('Authorization', auth())
        .send({ status: 'confirmed', accommodation: 'Hotel Test' })
        .expect(200);

      expect(res.body.status).toBe('confirmed');
      expect(res.body.accommodation).toBe('Hotel Test');
    });
  });

  // ---------------------------------------------------------------------------
  describe('POST /api/guests/:id/migrate', () => {
    it('migrates a guest to another group in the same region', async () => {
      const targetGroup = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-TARGET', region_id: regionId });

      const guest = await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ ...baseGuest(), guest_code: 'G-MIGRATE' });

      const res = await request(server)
        .post(`/api/guests/${guest.body.id}/migrate`)
        .set('Authorization', auth())
        .send({ targetGroupId: targetGroup.body.id })
        .expect(200);

      expect(res.body.group_id).toBe(targetGroup.body.id);
    });

    it('returns 400 migrating to a group in a different region', async () => {
      const otherRegion = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Region For Migration Test' });

      const otherGroup = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({
          group_code: 'GRP-OTHER-REGION',
          region_id: otherRegion.body.id,
        });

      const guest = await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ ...baseGuest(), guest_code: 'G-NO-MIGRATE' });

      await request(server)
        .post(`/api/guests/${guest.body.id}/migrate`)
        .set('Authorization', auth())
        .send({ targetGroupId: otherGroup.body.id })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Excel import (parse + commit)', () => {
    it('GET /api/guests/import/template returns xlsx file', async () => {
      const res = await request(server)
        .get('/api/guests/import/template')
        .set('Authorization', auth())
        .expect(200);

      expect(res.headers['content-type']).toContain('spreadsheetml');
    });

    it('POST /api/guests/import/parse returns preview with valid/errors/duplicates', async () => {
      // Pre-create G-EXISTS to trigger duplicate detection
      const grp = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-IMPORT', region_id: regionId });
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          guest_code: 'G-EXISTS',
          group_id: grp.body.id,
          region_id: regionId,
          full_name: 'Existente',
        });

      const xlsx = buildExcelBuffer([
        {
          guest_code: 'G-NEW-1',
          group_code: 'GRP-IMPORT',
          full_name: 'Nuevo Uno',
          status: 'pending',
        },
        {
          guest_code: 'G-NEW-2',
          group_code: 'GRP-IMPORT',
          full_name: 'Nuevo Dos',
          status: 'confirmed',
        },
        {
          guest_code: 'G-EXISTS',
          group_code: 'GRP-IMPORT',
          full_name: 'Duplicado',
          status: 'pending',
        },
        {
          guest_code: '',
          group_code: 'GRP-IMPORT',
          full_name: 'Sin código',
          status: 'pending',
        },
      ]);

      const res = await request(server)
        .post(`/api/guests/import/parse?regionId=${regionId}`)
        .set('Authorization', auth())
        .attach('file', xlsx, 'test.xlsx')
        .expect(200);

      expect(res.body.summary.total).toBe(4);
      expect(res.body.summary.valid).toBe(2);
      expect(res.body.summary.errors).toBe(1);
      expect(res.body.summary.duplicates).toBe(1);
      expect(res.body.duplicates).toContain('G-EXISTS');
      expect(res.body.errors[0].reason).toMatch(/guest_code/i);
    });

    it('POST /api/guests/import/commit persists valid rows and creates groups', async () => {
      const res = await request(server)
        .post('/api/guests/import/commit')
        .set('Authorization', auth())
        .send({
          regionId,
          rows: [
            {
              guest_code: 'G-COMMIT-1',
              group_code: 'GRP-NEW-AUTO',
              full_name: 'Committed One',
            },
            {
              guest_code: 'G-COMMIT-2',
              group_code: 'GRP-NEW-AUTO',
              full_name: 'Committed Two',
            },
          ],
        })
        .expect(200);

      expect(res.body.created_guests).toBe(2);
      expect(res.body.created_groups).toBe(1);
      expect(res.body.total).toBe(2);

      // Verify they exist in DB
      const list = await request(server)
        .get(`/api/guests?regionId=${regionId}&search=Committed`)
        .set('Authorization', auth());
      expect(list.body.total).toBe(2);
    });

    it('commit is idempotent: skips already-existing guest_codes', async () => {
      const res = await request(server)
        .post('/api/guests/import/commit')
        .set('Authorization', auth())
        .send({
          regionId,
          rows: [
            {
              guest_code: 'G-COMMIT-1',
              group_code: 'GRP-NEW-AUTO',
              full_name: 'Repeated',
            },
          ],
        })
        .expect(200);

      expect(res.body.created_guests).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Guest access token', () => {
    let guestId: string;
    let guestToken: string;

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          ...baseGuest(),
          guest_code: 'G-TOKEN-TEST',
          full_name: 'Token Guest',
          accommodation: 'Hotel Prueba',
          arrival_transport: 'plane',
        });
      guestId = res.body.id;
    });

    it('GET /api/guests/:id/token generates a token and access_url', async () => {
      const res = await request(server)
        .get(`/api/guests/${guestId}/token`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('access_url');
      expect(res.body.access_url).toContain('token=');
      guestToken = res.body.token;
    });

    it('GET /api/guest-access/me returns guest data with region', async () => {
      const res = await request(server)
        .get(`/api/guest-access/me?token=${guestToken}`)
        .expect(200);

      expect(res.body.full_name).toBe('Token Guest');
      expect(res.body.accommodation).toBe('Hotel Prueba');
      expect(res.body.region).toMatchObject({
        name: 'Test Region',
        event_start_date: '2024-06-15',
        event_end_date: '2024-06-22',
      });
    });

    it('GET /api/guest-access/me returns 401 with invalid token', () =>
      request(server)
        .get('/api/guest-access/me?token=not-a-valid-token')
        .expect(401));

    it('GET /api/guest-access/me returns 401 with a user JWT (wrong type)', async () => {
      await request(server)
        .get(`/api/guest-access/me?token=${adminToken}`)
        .expect(401);
    });

    it('GET /api/guest-access/me returns 401 with no token', () =>
      request(server).get('/api/guest-access/me').expect(401));

    it('same guest always generates the same token sub (deterministic)', async () => {
      const res2 = await request(server)
        .get(`/api/guests/${guestId}/token`)
        .set('Authorization', auth());

      // Both tokens should give access to the same guest
      const me1 = await request(server).get(
        `/api/guest-access/me?token=${guestToken}`,
      );
      const me2 = await request(server).get(
        `/api/guest-access/me?token=${res2.body.token}`,
      );
      expect(me1.body.id).toBe(me2.body.id);
    });
  });

  // ---------------------------------------------------------------------------
  describe('DELETE /api/guests/:id', () => {
    it('deletes a guest (superadmin only)', async () => {
      const guest = await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ ...baseGuest(), guest_code: 'G-TO-DELETE' });

      await request(server)
        .delete(`/api/guests/${guest.body.id}`)
        .set('Authorization', auth())
        .expect(204);

      await request(server)
        .get(`/api/guests/${guest.body.id}`)
        .set('Authorization', auth())
        .expect(404);
    });
  });
});
