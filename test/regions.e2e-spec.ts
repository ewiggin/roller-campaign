import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAdmin } from './test-app';

describe('Regions (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    adminToken = await loginAdmin(server);
  });

  afterAll(() => app.close());

  const auth = () => `Bearer ${adminToken}`;

  describe('POST /api/regions', () => {
    it('creates a region as superadmin', async () => {
      const res = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({
          name: 'Madrid Norte',
          event_start_date: '2024-06-15',
          event_end_date: '2024-06-22',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Madrid Norte',
        event_start_date: '2024-06-15',
        event_end_date: '2024-06-22',
        coordinators: [],
      });
      expect(res.body.id).toBeDefined();
    });

    it('returns 409 for duplicate region name', () =>
      request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Madrid Norte' })
        .expect(409));

    it('returns 400 for missing name', () =>
      request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ event_start_date: '2024-06-15' })
        .expect(400));

    it('returns 401 without auth', () =>
      request(server).post('/api/regions').send({ name: 'X' }).expect(401));
  });

  describe('CRUD lifecycle', () => {
    let regionId: string;

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Barcelona Este' })
        .expect(201);
      regionId = res.body.id;
    });

    it('GET /api/regions returns all regions for superadmin', async () => {
      const res = await request(server)
        .get('/api/regions')
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/regions/:id returns a specific region', async () => {
      const res = await request(server)
        .get(`/api/regions/${regionId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.name).toBe('Barcelona Este');
    });

    it('GET /api/regions/:id returns 404 for unknown id', () =>
      request(server)
        .get('/api/regions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .expect(404));

    it('PATCH /api/regions/:id updates a region', async () => {
      const res = await request(server)
        .patch(`/api/regions/${regionId}`)
        .set('Authorization', auth())
        .send({ event_start_date: '2024-07-01', event_end_date: '2024-07-07' })
        .expect(200);

      expect(res.body.event_start_date).toBe('2024-07-01');
    });

    it('DELETE /api/regions/:id deletes a region', async () => {
      const del = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Temporal' });

      await request(server)
        .delete(`/api/regions/${del.body.id}`)
        .set('Authorization', auth())
        .expect(204);

      await request(server)
        .get(`/api/regions/${del.body.id}`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  describe('Coordinator management', () => {
    let regionId: string;
    let regionAdminToken: string;
    let userId: string;

    beforeAll(async () => {
      const regionRes = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Sevilla Sur' });
      regionId = regionRes.body.id;

      const userRes = await request(server)
        .post('/api/users')
        .set('Authorization', auth())
        .send({
          email: 'coord@test.local',
          password: 'pass1234',
          role: 'region_admin',
        });
      userId = userRes.body.id;

      const loginRes = await request(server)
        .post('/api/auth/login')
        .send({ email: 'coord@test.local', password: 'pass1234' });
      regionAdminToken = loginRes.body.access_token;
    });

    it('POST /api/regions/:id/coordinators assigns a coordinator', async () => {
      const res = await request(server)
        .post(`/api/regions/${regionId}/coordinators`)
        .set('Authorization', auth())
        .send({ userId })
        .expect(200);

      expect(res.body.coordinators).toHaveLength(1);
      expect(res.body.coordinators[0].id).toBe(userId);
    });

    it('region_admin can only see their own regions', async () => {
      const res = await request(server)
        .get('/api/regions')
        .set('Authorization', `Bearer ${regionAdminToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(regionId);
    });

    it('region_admin gets 403 accessing a region they do not coordinate', async () => {
      const other = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Valencia Norte' });

      await request(server)
        .get(`/api/regions/${other.body.id}`)
        .set('Authorization', `Bearer ${regionAdminToken}`)
        .expect(403);
    });

    it('DELETE /api/regions/:id/coordinators/:userId removes coordinator', async () => {
      const res = await request(server)
        .delete(`/api/regions/${regionId}/coordinators/${userId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.coordinators).toHaveLength(0);
    });

    it('returns 400 assigning a non-region_admin user as coordinator', async () => {
      const volRes = await request(server)
        .post('/api/users')
        .set('Authorization', auth())
        .send({
          email: 'vol@test.local',
          password: 'pass1234',
          role: 'volunteer',
        });

      await request(server)
        .post(`/api/regions/${regionId}/coordinators`)
        .set('Authorization', auth())
        .send({ userId: volRes.body.id })
        .expect(400);
    });
  });
});
