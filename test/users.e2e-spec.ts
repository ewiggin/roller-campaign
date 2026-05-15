import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAdmin } from './test-app';

describe('Users (e2e)', () => {
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

  const baseUser = () => ({
    email: `user-${Date.now()}@test.local`,
    password: 'pass1234',
    role: 'region_admin' as const,
  });

  describe('POST /api/users', () => {
    it('creates a user', async () => {
      const payload = baseUser();
      const res = await request(server)
        .post('/api/users')
        .set('Authorization', auth())
        .send(payload)
        .expect(201);
      expect(res.body.email).toBe(payload.email);
      expect(res.body.role).toBe('region_admin');
      expect(res.body.password).toBeUndefined();
    });

    it('returns 409 for duplicate email', async () => {
      const payload = baseUser();
      await request(server).post('/api/users').set('Authorization', auth()).send(payload).expect(201);
      await request(server).post('/api/users').set('Authorization', auth()).send(payload).expect(409);
    });

    it('returns 400 for missing email', () =>
      request(server).post('/api/users').set('Authorization', auth())
        .send({ password: 'pass1234' }).expect(400));

    it('returns 401 without auth', () =>
      request(server).post('/api/users').send(baseUser()).expect(401));
  });

  describe('GET /api/users', () => {
    it('returns list of users', async () => {
      const res = await request(server)
        .get('/api/users')
        .set('Authorization', auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 without auth', () =>
      request(server).get('/api/users').expect(401));
  });

  describe('GET /api/users/:id', () => {
    it('returns a specific user', async () => {
      const created = (await request(server).post('/api/users').set('Authorization', auth()).send(baseUser())).body;
      const res = await request(server)
        .get(`/api/users/${created.id}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.email).toBe(created.email);
    });

    it('returns 404 for unknown id', () =>
      request(server)
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .expect(404));
  });

  describe('PATCH /api/users/:id', () => {
    let userId: string;
    let userEmail: string;

    beforeAll(async () => {
      const payload = baseUser();
      userEmail = payload.email;
      const res = await request(server).post('/api/users').set('Authorization', auth()).send(payload);
      userId = res.body.id;
    });

    it('updates role', async () => {
      const res = await request(server)
        .patch(`/api/users/${userId}`)
        .set('Authorization', auth())
        .send({ role: 'volunteer' })
        .expect(200);
      expect(res.body.role).toBe('volunteer');
    });

    it('updates password (new password works for login)', async () => {
      await request(server)
        .patch(`/api/users/${userId}`)
        .set('Authorization', auth())
        .send({ password: 'newpassword99' })
        .expect(200);
      await request(server)
        .post('/api/auth/login')
        .send({ email: userEmail, password: 'newpassword99' })
        .expect(200);
    });

    it('returns 409 for duplicate email', async () => {
      const other = (await request(server).post('/api/users').set('Authorization', auth()).send(baseUser())).body;
      await request(server)
        .patch(`/api/users/${userId}`)
        .set('Authorization', auth())
        .send({ email: other.email })
        .expect(409);
    });

    it('returns 404 for unknown id', () =>
      request(server)
        .patch('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .send({ role: 'volunteer' })
        .expect(404));
  });

  describe('DELETE /api/users/:id', () => {
    it('deletes a user', async () => {
      const created = (await request(server).post('/api/users').set('Authorization', auth()).send(baseUser())).body;
      await request(server).delete(`/api/users/${created.id}`).set('Authorization', auth()).expect(204);
      await request(server).get(`/api/users/${created.id}`).set('Authorization', auth()).expect(404);
    });

    it('returns 404 for unknown id', () =>
      request(server)
        .delete('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .expect(404));
  });
});
