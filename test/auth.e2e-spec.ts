import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_ADMIN } from './test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(() => app.close());

  describe('POST /api/auth/login', () => {
    it('returns access_token for env admin', async () => {
      const res = await request(server)
        .post('/api/auth/login')
        .send(TEST_ADMIN)
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
    });

    it('returns 401 for wrong password', () =>
      request(server)
        .post('/api/auth/login')
        .send({ email: TEST_ADMIN.email, password: 'wrong' })
        .expect(401));

    it('returns 401 for non-existent user', () =>
      request(server)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.local', password: 'pass' })
        .expect(401));

    // LocalAuthGuard (Passport) runs before the NestJS ValidationPipe, so incomplete
    // or malformed credential payloads reach the strategy and get rejected as 401.
    it('returns 401 for missing password (passport rejects before DTO validation)', () =>
      request(server)
        .post('/api/auth/login')
        .send({ email: TEST_ADMIN.email })
        .expect(401));

    it('returns 401 for invalid email format (passport rejects before DTO validation)', () =>
      request(server)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'pass' })
        .expect(401));
  });

  describe('Protected routes', () => {
    it('returns 401 on protected route without token', () =>
      request(server).get('/api/regions').expect(401));

    it('returns 401 on protected route with malformed token', () =>
      request(server)
        .get('/api/regions')
        .set('Authorization', 'Bearer not-a-token')
        .expect(401));

    it('allows access with valid admin token', async () => {
      const loginRes = await request(server).post('/api/auth/login').send(TEST_ADMIN);
      await request(server)
        .get('/api/regions')
        .set('Authorization', `Bearer ${loginRes.body.access_token}`)
        .expect(200);
    });
  });
});
