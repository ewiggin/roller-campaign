import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAdmin } from './test-app';

describe('Turns (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;
  let regionId: string;
  let volunteerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    adminToken = await loginAdmin(server);

    const region = await request(server)
      .post('/api/regions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Turns Region', event_start_date: '2024-06-14', event_end_date: '2024-06-22' });
    regionId = region.body.id;

    const volunteer = await request(server)
      .post('/api/volunteers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ volunteer_code: 'V-T01', full_name: 'Voluntario Turno', region_ids: [regionId] });
    volunteerId = volunteer.body.id;
  });

  afterAll(() => app.close());

  const auth = () => `Bearer ${adminToken}`;

  const baseTurn = () => ({
    region_id: regionId,
    date: '2024-06-15',
    start_time: '09:00',
    end_time: '13:00',
    description: 'Turno mañana',
  });

  // ── CRUD ─────────────────────────────────────────────────────────────────

  describe('POST /api/turns', () => {
    it('creates a turn', async () => {
      const res = await request(server)
        .post('/api/turns')
        .set('Authorization', auth())
        .send(baseTurn())
        .expect(201);
      expect(res.body).toMatchObject({ date: '2024-06-15', start_time: '09:00', end_time: '13:00' });
      expect(res.body.volunteers).toEqual([]);
      expect(res.body.volunteer_count).toBe(0);
    });

    it('returns 400 for invalid time format', () =>
      request(server)
        .post('/api/turns')
        .set('Authorization', auth())
        .send({ ...baseTurn(), start_time: '9:00' })
        .expect(400));

    it('returns 400 for invalid date', () =>
      request(server)
        .post('/api/turns')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '15-06-2024' })
        .expect(400));
  });

  describe('GET /api/turns', () => {
    it('returns paginated list for region', async () => {
      const res = await request(server)
        .get(`/api/turns?regionId=${regionId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by date', async () => {
      await request(server).post('/api/turns').set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-06-20' });

      const res = await request(server)
        .get(`/api/turns?regionId=${regionId}&date=2024-06-20`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.every((t: { date: string }) => t.date === '2024-06-20')).toBe(true);
    });
  });

  describe('PATCH /api/turns/:id', () => {
    it('updates a turn', async () => {
      const turn = await request(server).post('/api/turns').set('Authorization', auth()).send(baseTurn());
      const res = await request(server)
        .patch(`/api/turns/${turn.body.id}`)
        .set('Authorization', auth())
        .send({ description: 'Descripción actualizada' })
        .expect(200);
      expect(res.body.description).toBe('Descripción actualizada');
    });
  });

  describe('DELETE /api/turns/:id', () => {
    it('deletes a turn', async () => {
      const turn = await request(server).post('/api/turns').set('Authorization', auth()).send(baseTurn());
      await request(server).delete(`/api/turns/${turn.body.id}`).set('Authorization', auth()).expect(204);
      await request(server).get(`/api/turns/${turn.body.id}`).set('Authorization', auth()).expect(404);
    });
  });

  // ── Volunteer assignment ──────────────────────────────────────────────────

  describe('Volunteer assignment', () => {
    let turnId: string;

    beforeAll(async () => {
      const turn = await request(server)
        .post('/api/turns')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-06-16', description: 'Turno asignación' });
      turnId = turn.body.id;
    });

    it('POST /api/turns/:id/volunteers assigns a volunteer', async () => {
      const res = await request(server)
        .post(`/api/turns/${turnId}/volunteers`)
        .set('Authorization', auth())
        .send({ volunteerId })
        .expect(200);
      expect(res.body.volunteers).toHaveLength(1);
      expect(res.body.volunteers[0].id).toBe(volunteerId);
      expect(res.body.volunteer_count).toBe(1);
    });

    it('assigning same volunteer twice is idempotent', async () => {
      const res = await request(server)
        .post(`/api/turns/${turnId}/volunteers`)
        .set('Authorization', auth())
        .send({ volunteerId })
        .expect(200);
      expect(res.body.volunteers).toHaveLength(1);
    });

    it('GET /api/turns filters by volunteerId', async () => {
      const res = await request(server)
        .get(`/api/turns?volunteerId=${volunteerId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /api/turns/:id/volunteers/:volunteerId unassigns', async () => {
      const res = await request(server)
        .delete(`/api/turns/${turnId}/volunteers/${volunteerId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.volunteers).toHaveLength(0);
      expect(res.body.volunteer_count).toBe(0);
    });

    it('returns 400 assigning a volunteer from a different region', async () => {
      const otherRegion = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Otra Región' });

      const otherVol = await request(server)
        .post('/api/volunteers')
        .set('Authorization', auth())
        .send({ volunteer_code: 'V-OTHER', full_name: 'Otra Región Vol', region_ids: [otherRegion.body.id] });

      await request(server)
        .post(`/api/turns/${turnId}/volunteers`)
        .set('Authorization', auth())
        .send({ volunteerId: otherVol.body.id })
        .expect(400);
    });
  });

  // ── Access control ────────────────────────────────────────────────────────

  describe('Access control', () => {
    it('region_admin can only see turns of their regions', async () => {
      const userRes = await request(server)
        .post('/api/users')
        .set('Authorization', auth())
        .send({ email: 'coord.turns@test.local', password: 'pass1234', role: 'region_admin' });

      await request(server)
        .post(`/api/regions/${regionId}/coordinators`)
        .set('Authorization', auth())
        .send({ userId: userRes.body.id });

      const coordToken = (await request(server)
        .post('/api/auth/login')
        .send({ email: 'coord.turns@test.local', password: 'pass1234' })).body.access_token;

      const otherRegion = await request(server)
        .post('/api/regions')
        .set('Authorization', auth())
        .send({ name: 'Region Sin Acceso' });

      await request(server)
        .post('/api/turns')
        .set('Authorization', auth())
        .send({ ...baseTurn(), region_id: otherRegion.body.id });

      const res = await request(server)
        .get('/api/turns')
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      expect(res.body.data.every((t: { region_id: string }) => t.region_id === regionId)).toBe(true);
    });
  });
});
