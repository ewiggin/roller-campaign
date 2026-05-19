import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAdmin } from './test-app';

describe('Activities (e2e)', () => {
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
    name: 'Test activity',
    date: '2024-06-15',
    start_time: '09:00',
    end_time: '13:00',
    description: 'Turno mañana',
  });

  // ── CRUD ─────────────────────────────────────────────────────────────────

  describe('POST /api/activities', () => {
    it('creates a turn', async () => {
      const res = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send(baseTurn())
        .expect(201);
      expect(res.body).toMatchObject({ date: '2024-06-15', start_time: '09:00', end_time: '13:00' });
      expect(res.body.volunteers).toEqual([]);
      expect(res.body.volunteer_count).toBe(0);
    });

    it('returns 400 for invalid time format', () =>
      request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), start_time: '9:00' })
        .expect(400));

    it('returns 400 for invalid date', () =>
      request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '15-06-2024' })
        .expect(400));
  });

  describe('GET /api/activities', () => {
    it('returns paginated list for region', async () => {
      const res = await request(server)
        .get(`/api/activities?regionId=${regionId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by date', async () => {
      await request(server).post('/api/activities').set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-06-20' });

      const res = await request(server)
        .get(`/api/activities?regionId=${regionId}&date=2024-06-20`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.every((t: { date: string }) => t.date === '2024-06-20')).toBe(true);
    });
  });

  describe('PATCH /api/activities/:id', () => {
    it('updates a turn', async () => {
      const turn = await request(server).post('/api/activities').set('Authorization', auth()).send(baseTurn());
      const res = await request(server)
        .patch(`/api/activities/${turn.body.id}`)
        .set('Authorization', auth())
        .send({ description: 'Descripción actualizada' })
        .expect(200);
      expect(res.body.description).toBe('Descripción actualizada');
    });
  });

  describe('DELETE /api/activities/:id', () => {
    it('deletes a turn', async () => {
      const turn = await request(server).post('/api/activities').set('Authorization', auth()).send(baseTurn());
      await request(server).delete(`/api/activities/${turn.body.id}`).set('Authorization', auth()).expect(204);
      await request(server).get(`/api/activities/${turn.body.id}`).set('Authorization', auth()).expect(404);
    });
  });

  // ── Volunteer assignment ──────────────────────────────────────────────────

  describe('Volunteer assignment', () => {
    let turnId: string;

    beforeAll(async () => {
      const turn = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-06-16', description: 'Turno asignación' });
      turnId = turn.body.id;
    });

    it('POST /api/activities/:id/volunteers assigns a volunteer', async () => {
      const res = await request(server)
        .post(`/api/activities/${turnId}/volunteers`)
        .set('Authorization', auth())
        .send({ volunteerId })
        .expect(200);
      expect(res.body.volunteers).toHaveLength(1);
      expect(res.body.volunteers[0].id).toBe(volunteerId);
      expect(res.body.volunteer_count).toBe(1);
    });

    it('assigning same volunteer twice is idempotent', async () => {
      const res = await request(server)
        .post(`/api/activities/${turnId}/volunteers`)
        .set('Authorization', auth())
        .send({ volunteerId })
        .expect(200);
      expect(res.body.volunteers).toHaveLength(1);
    });

    it('GET /api/activities filters by volunteerId', async () => {
      const res = await request(server)
        .get(`/api/activities?volunteerId=${volunteerId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /api/activities/:id/volunteers/:volunteerId unassigns', async () => {
      const res = await request(server)
        .delete(`/api/activities/${turnId}/volunteers/${volunteerId}`)
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
        .post(`/api/activities/${turnId}/volunteers`)
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
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), region_id: otherRegion.body.id });

      const res = await request(server)
        .get('/api/activities')
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      expect(res.body.data.every((t: { region_id: string }) => t.region_id === regionId)).toBe(true);
    });
  });

  describe('Volunteer role access', () => {
    it('volunteer can list activities they are assigned to', async () => {
      const userRes = (await request(server).post('/api/users').set('Authorization', auth())
        .send({ email: `vol-act-${Date.now()}@test.local`, password: 'pass1234', role: 'volunteer' })).body;

      await request(server).patch(`/api/volunteers/${volunteerId}`)
        .set('Authorization', auth()).send({ user_id: userRes.id });

      const volToken = (await request(server).post('/api/auth/login')
        .send({ email: userRes.email, password: 'pass1234' })).body.access_token;

      const res = await request(server)
        .get('/api/activities')
        .set('Authorization', `Bearer ${volToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PATCH /api/activities/:id', () => {
    it('returns 404 for unknown id', () =>
      request(server)
        .patch('/api/activities/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .send({ description: 'x' })
        .expect(404));
  });

  describe('region_admin access paths', () => {
    let coordToken: string;

    beforeAll(async () => {
      const userRes = (await request(server).post('/api/users').set('Authorization', auth())
        .send({ email: `coord-act-${Date.now()}@test.local`, password: 'pass1234', role: 'region_admin' })).body;

      await request(server).post(`/api/regions/${regionId}/coordinators`)
        .set('Authorization', auth()).send({ userId: userRes.id });

      coordToken = (await request(server).post('/api/auth/login')
        .send({ email: userRes.email, password: 'pass1234' })).body.access_token;
    });

    it('region_admin can list activities in their region', async () => {
      const res = await request(server)
        .get(`/api/activities?regionId=${regionId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('region_admin can filter activities by volunteerId', async () => {
      const res = await request(server)
        .get(`/api/activities?volunteerId=${volunteerId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/activities/:id', () => {
    it('returns a specific activity', async () => {
      const created = (await request(server).post('/api/activities').set('Authorization', auth()).send(baseTurn())).body;
      const res = await request(server)
        .get(`/api/activities/${created.id}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.volunteers).toBeDefined();
    });

    it('returns 404 for unknown id', () =>
      request(server)
        .get('/api/activities/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .expect(404));
  });

  describe('GET /api/activities/:id/available-groups', () => {
    it('returns available groups for an activity', async () => {
      const activity = (await request(server).post('/api/activities').set('Authorization', auth()).send(baseTurn())).body;

      await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: `AVAIL-${Date.now()}`, region_id: regionId });

      const res = await request(server)
        .get(`/api/activities/${activity.id}/available-groups`)
        .set('Authorization', auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Guest group assignment', () => {
    let activityId: string;
    let groupId: string;

    beforeAll(async () => {
      const act = (await request(server).post('/api/activities').set('Authorization', auth()).send(baseTurn())).body;
      activityId = act.id;
      const grp = (await request(server).post('/api/guest-groups').set('Authorization', auth())
        .send({ group_code: `GRPACT-${Date.now()}`, region_id: regionId })).body;
      groupId = grp.id;
    });

    it('POST /api/activities/:id/guest-groups assigns a group', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId })
        .expect(200);
      expect(res.body.guest_groups.some((g: { id: string }) => g.id === groupId)).toBe(true);
    });

    it('assigning same group twice is idempotent', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId })
        .expect(200);
      const count = res.body.guest_groups.filter((g: { id: string }) => g.id === groupId).length;
      expect(count).toBe(1);
    });

    it('DELETE /api/activities/:id/guest-groups/:groupId unassigns', async () => {
      const res = await request(server)
        .delete(`/api/activities/${activityId}/guest-groups/${groupId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.guest_groups.some((g: { id: string }) => g.id === groupId)).toBe(false);
    });

    it('returns 400 assigning group from different region', async () => {
      const otherRegion = (await request(server).post('/api/regions').set('Authorization', auth()).send({ name: 'Other Act Region' })).body;
      const otherGroup = (await request(server).post('/api/guest-groups').set('Authorization', auth())
        .send({ group_code: `GRPOTHER-${Date.now()}`, region_id: otherRegion.id })).body;

      await request(server)
        .post(`/api/activities/${activityId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: otherGroup.id })
        .expect(400);
    });
  });

  describe('Publish / Unpublish', () => {
    let activityId: string;

    beforeAll(async () => {
      activityId = (await request(server).post('/api/activities').set('Authorization', auth()).send(baseTurn())).body.id;
    });

    it('POST /api/activities/:id/publish sets status to published', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityId}/publish`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.status).toBe('published');
    });

    it('POST /api/activities/:id/unpublish sets status to draft', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityId}/unpublish`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.status).toBe('draft');
    });
  });
});
