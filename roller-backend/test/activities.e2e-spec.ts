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
      .send({
        name: 'Turns Region',
        event_start_date: '2024-06-14',
        event_end_date: '2024-06-22',
      });
    regionId = region.body.id;

    const volunteer = await request(server)
      .post('/api/volunteers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        volunteer_code: 'V-T01',
        full_name: 'Voluntario Turno',
        region_ids: [regionId],
      });
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
      expect(res.body).toMatchObject({
        date: '2024-06-15',
        start_time: '09:00',
        end_time: '13:00',
      });
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
      await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-06-20' });

      const res = await request(server)
        .get(`/api/activities?regionId=${regionId}&date=2024-06-20`)
        .set('Authorization', auth())
        .expect(200);
      expect(
        res.body.data.every((t: { date: string }) => t.date === '2024-06-20'),
      ).toBe(true);
    });
  });

  describe('PATCH /api/activities/:id', () => {
    it('updates a turn', async () => {
      const turn = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send(baseTurn());
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
      const turn = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send(baseTurn());
      await request(server)
        .delete(`/api/activities/${turn.body.id}`)
        .set('Authorization', auth())
        .expect(204);
      await request(server)
        .get(`/api/activities/${turn.body.id}`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ── Volunteer assignment ──────────────────────────────────────────────────

  describe('Volunteer assignment', () => {
    let turnId: string;

    beforeAll(async () => {
      const turn = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({
          ...baseTurn(),
          date: '2024-06-16',
          description: 'Turno asignación',
        });
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
        .send({
          volunteer_code: 'V-OTHER',
          full_name: 'Otra Región Vol',
          region_ids: [otherRegion.body.id],
        });

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
        .send({
          email: 'coord.turns@test.local',
          password: 'pass1234',
          role: 'region_admin',
        });

      await request(server)
        .post(`/api/regions/${regionId}/coordinators`)
        .set('Authorization', auth())
        .send({ userId: userRes.body.id });

      const coordToken = (
        await request(server)
          .post('/api/auth/login')
          .send({ email: 'coord.turns@test.local', password: 'pass1234' })
      ).body.access_token;

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

      expect(
        res.body.data.every(
          (t: { region_id: string }) => t.region_id === regionId,
        ),
      ).toBe(true);
    });
  });

  describe('Volunteer role access', () => {
    it('volunteer can list activities they are assigned to', async () => {
      const userRes = (
        await request(server)
          .post('/api/users')
          .set('Authorization', auth())
          .send({
            email: `vol-act-${Date.now()}@test.local`,
            password: 'pass1234',
            role: 'volunteer',
          })
      ).body;

      await request(server)
        .patch(`/api/volunteers/${volunteerId}`)
        .set('Authorization', auth())
        .send({ user_id: userRes.id });

      const volToken = (
        await request(server)
          .post('/api/auth/login')
          .send({ email: userRes.email, password: 'pass1234' })
      ).body.access_token;

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
      const userRes = (
        await request(server)
          .post('/api/users')
          .set('Authorization', auth())
          .send({
            email: `coord-act-${Date.now()}@test.local`,
            password: 'pass1234',
            role: 'region_admin',
          })
      ).body;

      await request(server)
        .post(`/api/regions/${regionId}/coordinators`)
        .set('Authorization', auth())
        .send({ userId: userRes.id });

      coordToken = (
        await request(server)
          .post('/api/auth/login')
          .send({ email: userRes.email, password: 'pass1234' })
      ).body.access_token;
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
      const created = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(baseTurn())
      ).body;
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
      const activity = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(baseTurn())
      ).body;

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

  // ── Host schedule conflict ────────────────────────────────────────────────

  describe('Host schedule conflict', () => {
    // 2024-06-15 is a Saturday → JS getDay()=6 → our convention day 6
    let conflictGroupId: string;
    let noConflictGroupId: string;
    let activityId: string;

    beforeAll(async () => {
      const host = (
        await request(server)
          .post('/api/hosts')
          .set('Authorization', auth())
          .send({
            name: `Sched Host ${Date.now()}`,
            region_id: regionId,
            weekend_meeting_day: 6, // Saturday
            weekend_meeting_time: '10:00', // falls within 09:00-13:00
          })
      ).body;

      const conflictGroup = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({
            group_code: `SCHEDCONF-${Date.now()}`,
            region_id: regionId,
          })
      ).body;
      conflictGroupId = conflictGroup.id;
      // Assign host via dedicated endpoint (host_id is not in CreateGuestGroupDto)
      await request(server)
        .patch(`/api/guest-groups/${conflictGroupId}/host`)
        .set('Authorization', auth())
        .send({ hostId: host.id });

      noConflictGroupId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({
            group_code: `SCHEDNONE-${Date.now()}`,
            region_id: regionId,
          })
      ).body.id;

      activityId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            ...baseTurn(),
            date: '2024-06-15', // Saturday
            start_time: '09:00',
            end_time: '13:00',
          })
      ).body.id;
    });

    it('available-groups includes host_schedule_conflict on every item', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityId}/available-groups`)
        .set('Authorization', auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.every(
          (g: { host_schedule_conflict: boolean }) =>
            typeof g.host_schedule_conflict === 'boolean',
        ),
      ).toBe(true);
    });

    it('flags group whose host meeting overlaps the activity', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityId}/available-groups`)
        .set('Authorization', auth())
        .expect(200);
      const group = res.body.find(
        (g: { id: string }) => g.id === conflictGroupId,
      );
      expect(group).toBeDefined();
      expect(group.host_schedule_conflict).toBe(true);
    });

    it('does not flag group without host', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityId}/available-groups`)
        .set('Authorization', auth())
        .expect(200);
      const group = res.body.find(
        (g: { id: string }) => g.id === noConflictGroupId,
      );
      expect(group).toBeDefined();
      expect(group.host_schedule_conflict).toBe(false);
    });

    it('returns 400 when assigning a group with host schedule conflict', async () => {
      await request(server)
        .post(`/api/activities/${activityId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: conflictGroupId })
        .expect(400);
    });

    it('allows assigning a group without host schedule conflict', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: noConflictGroupId })
        .expect(200);
      expect(
        res.body.guest_groups.some(
          (g: { id: string }) => g.id === noConflictGroupId,
        ),
      ).toBe(true);
    });
  });

  describe('Guest group assignment', () => {
    let activityId: string;
    let groupId: string;

    beforeAll(async () => {
      const act = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(baseTurn())
      ).body;
      activityId = act.id;
      const grp = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `GRPACT-${Date.now()}`, region_id: regionId })
      ).body;
      groupId = grp.id;
    });

    it('POST /api/activities/:id/guest-groups assigns a group', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId })
        .expect(200);
      expect(
        res.body.guest_groups.some((g: { id: string }) => g.id === groupId),
      ).toBe(true);
    });

    it('assigning same group twice is idempotent', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId })
        .expect(200);
      const count = res.body.guest_groups.filter(
        (g: { id: string }) => g.id === groupId,
      ).length;
      expect(count).toBe(1);
    });

    it('DELETE /api/activities/:id/guest-groups/:groupId unassigns', async () => {
      const res = await request(server)
        .delete(`/api/activities/${activityId}/guest-groups/${groupId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(
        res.body.guest_groups.some((g: { id: string }) => g.id === groupId),
      ).toBe(false);
    });

    it('returns 400 assigning group from different region', async () => {
      const otherRegion = (
        await request(server)
          .post('/api/regions')
          .set('Authorization', auth())
          .send({ name: 'Other Act Region' })
      ).body;
      const otherGroup = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({
            group_code: `GRPOTHER-${Date.now()}`,
            region_id: otherRegion.id,
          })
      ).body;

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
      activityId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(baseTurn())
      ).body.id;
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

  // ── Published activity protection ─────────────────────────────────────────

  describe('Published activity cannot be deleted', () => {
    let actId: string;

    beforeAll(async () => {
      actId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(baseTurn())
      ).body.id;
      await request(server)
        .post(`/api/activities/${actId}/publish`)
        .set('Authorization', auth());
    });

    it('returns 400 when deleting a published activity', async () => {
      await request(server)
        .delete(`/api/activities/${actId}`)
        .set('Authorization', auth())
        .expect(400);
    });

    it('can delete after unpublishing', async () => {
      await request(server)
        .post(`/api/activities/${actId}/unpublish`)
        .set('Authorization', auth());
      await request(server)
        .delete(`/api/activities/${actId}`)
        .set('Authorization', auth())
        .expect(204);
    });
  });

  // ── Batch create ──────────────────────────────────────────────────────────

  describe('POST /api/activities/batch', () => {
    it('creates N activities with daily repetition and shared series_id', async () => {
      const res = await request(server)
        .post('/api/activities/batch')
        .set('Authorization', auth())
        .send({
          ...baseTurn(),
          date: '2024-07-01',
          repetition: { type: 'daily', count: 3 },
        })
        .expect(201);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].date).toBe('2024-07-01');
      expect(res.body[1].date).toBe('2024-07-02');
      expect(res.body[2].date).toBe('2024-07-03');
      const seriesId = res.body[0].series_id;
      expect(seriesId).toBeTruthy();
      expect(
        res.body.every((a: { series_id: string }) => a.series_id === seriesId),
      ).toBe(true);
    });

    it('creates N activities with weekly repetition', async () => {
      const res = await request(server)
        .post('/api/activities/batch')
        .set('Authorization', auth())
        .send({
          ...baseTurn(),
          date: '2024-07-08',
          repetition: { type: 'weekly', count: 3 },
        })
        .expect(201);
      expect(res.body[0].date).toBe('2024-07-08');
      expect(res.body[1].date).toBe('2024-07-15');
      expect(res.body[2].date).toBe('2024-07-22');
    });

    it('creates N copies on the same day', async () => {
      const res = await request(server)
        .post('/api/activities/batch')
        .set('Authorization', auth())
        .send({
          ...baseTurn(),
          date: '2024-07-30',
          repetition: { type: 'same_day', count: 3 },
        })
        .expect(201);
      expect(res.body).toHaveLength(3);
      expect(
        res.body.every((a: { date: string }) => a.date === '2024-07-30'),
      ).toBe(true);
    });

    it('returns 400 for count < 2', async () => {
      await request(server)
        .post('/api/activities/batch')
        .set('Authorization', auth())
        .send({ ...baseTurn(), repetition: { type: 'daily', count: 1 } })
        .expect(400);
    });
  });

  // ── Series delete ─────────────────────────────────────────────────────────

  describe('DELETE /api/activities/:id/series-from-here', () => {
    let ids: string[];

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/activities/batch')
        .set('Authorization', auth())
        .send({
          ...baseTurn(),
          date: '2024-08-01',
          repetition: { type: 'daily', count: 5 },
        });
      ids = res.body.map((a: { id: string }) => a.id);
    });

    it('deletes from the given activity onwards, keeps earlier ones', async () => {
      await request(server)
        .delete(`/api/activities/${ids[2]}/series-from-here`)
        .set('Authorization', auth())
        .expect(204);

      await request(server)
        .get(`/api/activities/${ids[0]}`)
        .set('Authorization', auth())
        .expect(200);
      await request(server)
        .get(`/api/activities/${ids[1]}`)
        .set('Authorization', auth())
        .expect(200);
      await request(server)
        .get(`/api/activities/${ids[2]}`)
        .set('Authorization', auth())
        .expect(404);
      await request(server)
        .get(`/api/activities/${ids[4]}`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ── Series update ─────────────────────────────────────────────────────────

  describe('PATCH /api/activities/:id/series-from-here', () => {
    let ids: string[];

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/activities/batch')
        .set('Authorization', auth())
        .send({
          ...baseTurn(),
          date: '2024-09-01',
          name: 'Original',
          repetition: { type: 'daily', count: 3 },
        });
      ids = res.body.map((a: { id: string }) => a.id);
    });

    it('updates name on this and future activities, not past ones', async () => {
      await request(server)
        .patch(`/api/activities/${ids[1]}/series-from-here`)
        .set('Authorization', auth())
        .send({ name: 'Updated' })
        .expect(200);

      const first = await request(server)
        .get(`/api/activities/${ids[0]}`)
        .set('Authorization', auth());
      expect(first.body.name).toBe('Original');

      const second = await request(server)
        .get(`/api/activities/${ids[1]}`)
        .set('Authorization', auth());
      expect(second.body.name).toBe('Updated');

      const third = await request(server)
        .get(`/api/activities/${ids[2]}`)
        .set('Authorization', auth());
      expect(third.body.name).toBe('Updated');
    });

    it('does not change the date of any activity', async () => {
      const res = await request(server)
        .patch(`/api/activities/${ids[0]}/series-from-here`)
        .set('Authorization', auth())
        .send({ start_time: '10:00', end_time: '14:00' })
        .expect(200);
      // date unchanged
      expect(res.body.date).toBe('2024-09-01');
      const second = await request(server)
        .get(`/api/activities/${ids[1]}`)
        .set('Authorization', auth());
      expect(second.body.date).toBe('2024-09-02');
    });
  });

  // ── Available volunteers ──────────────────────────────────────────────────

  describe('GET /api/activities/:id/available-volunteers', () => {
    let activityId: string;
    let conflictingId: string;

    beforeAll(async () => {
      // 2024-10-01 is a Tuesday — enable tuesday_morning so the volunteer passes the shift filter
      await request(server)
        .patch(`/api/volunteers/${volunteerId}`)
        .set('Authorization', auth())
        .send({ tuesday_morning: true });

      activityId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            ...baseTurn(),
            date: '2024-10-01',
            start_time: '09:00',
            end_time: '13:00',
          })
      ).body.id;

      // Overlapping activity that also uses volunteerId
      conflictingId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            ...baseTurn(),
            date: '2024-10-01',
            start_time: '10:00',
            end_time: '14:00',
          })
      ).body.id;
      await request(server)
        .post(`/api/activities/${conflictingId}/volunteers`)
        .set('Authorization', auth())
        .send({ volunteerId });
    });

    it('returns volunteers with already_in_activity flag', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityId}/available-volunteers`)
        .set('Authorization', auth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.every(
          (v: { already_in_activity: boolean }) =>
            typeof v.already_in_activity === 'boolean',
        ),
      ).toBe(true);
    });

    it('marks volunteer already assigned to overlapping activity', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityId}/available-volunteers`)
        .set('Authorization', auth())
        .expect(200);
      const vol = res.body.find((v: { id: string }) => v.id === volunteerId);
      expect(vol?.already_in_activity).toBe(true);
    });

    it('does not include volunteers already assigned to this activity', async () => {
      await request(server)
        .post(`/api/activities/${activityId}/volunteers`)
        .set('Authorization', auth())
        .send({ volunteerId });
      const res = await request(server)
        .get(`/api/activities/${activityId}/available-volunteers`)
        .set('Authorization', auth())
        .expect(200);
      expect(
        res.body.find((v: { id: string }) => v.id === volunteerId),
      ).toBeUndefined();
    });
  });

  // ── Date range and host filters ───────────────────────────────────────────

  describe('GET /api/activities date range and host filters', () => {
    let hostId: string;

    beforeAll(async () => {
      const host = await request(server)
        .post('/api/hosts')
        .set('Authorization', auth())
        .send({ name: 'Test Host', region_id: regionId });
      hostId = host.body.id;

      await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-11-01' });
      await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-11-15' });
      await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-11-30' });
      await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-11-10', host_id: hostId });
    });

    it('filters by dateFrom', async () => {
      const res = await request(server)
        .get('/api/activities')
        .query({ regionId, dateFrom: '2024-11-10' })
        .set('Authorization', auth())
        .expect(200);
      const dates: string[] = res.body.data.map(
        (a: { date: string }) => a.date,
      );
      expect(dates.every((d) => d >= '2024-11-10')).toBe(true);
      expect(dates).not.toContain('2024-11-01');
    });

    it('filters by dateTo', async () => {
      const res = await request(server)
        .get('/api/activities')
        .query({ regionId, dateTo: '2024-11-15' })
        .set('Authorization', auth())
        .expect(200);
      const dates: string[] = res.body.data.map(
        (a: { date: string }) => a.date,
      );
      expect(dates.every((d) => d <= '2024-11-15')).toBe(true);
      expect(dates).not.toContain('2024-11-30');
    });

    it('filters by dateFrom + dateTo range', async () => {
      const res = await request(server)
        .get('/api/activities')
        .query({ regionId, dateFrom: '2024-11-05', dateTo: '2024-11-20' })
        .set('Authorization', auth())
        .expect(200);
      const dates: string[] = res.body.data.map(
        (a: { date: string }) => a.date,
      );
      expect(dates).toContain('2024-11-10');
      expect(dates).toContain('2024-11-15');
      expect(dates).not.toContain('2024-11-01');
      expect(dates).not.toContain('2024-11-30');
    });

    it('filters by hostId', async () => {
      const res = await request(server)
        .get('/api/activities')
        .query({ regionId, hostId })
        .set('Authorization', auth())
        .expect(200);
      expect(
        res.body.data.every((a: { host_id: string }) => a.host_id === hostId),
      ).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by is_preaching_shift=true', async () => {
      await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-11-20', is_preaching_shift: true });

      const res = await request(server)
        .get('/api/activities')
        .query({ regionId, is_preaching_shift: true })
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every(
          (a: { is_preaching_shift: boolean }) => a.is_preaching_shift === true,
        ),
      ).toBe(true);
    });

    it('filters by is_preaching_shift=false', async () => {
      const res = await request(server)
        .get('/api/activities')
        .query({ regionId, is_preaching_shift: false })
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every(
          (a: { is_preaching_shift: boolean }) =>
            a.is_preaching_shift === false,
        ),
      ).toBe(true);
    });
  });

  // ── is_preaching_shift ────────────────────────────────────────────────────

  describe('is_preaching_shift field', () => {
    it('defaults to false when not provided', async () => {
      const res = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send(baseTurn())
        .expect(201);
      expect(res.body.is_preaching_shift).toBe(false);
    });

    it('persists true when provided', async () => {
      const res = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), is_preaching_shift: true })
        .expect(201);
      expect(res.body.is_preaching_shift).toBe(true);
    });

    it('can be toggled via PATCH', async () => {
      const created = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(baseTurn())
      ).body;

      const updated = (
        await request(server)
          .patch(`/api/activities/${created.id}`)
          .set('Authorization', auth())
          .send({ is_preaching_shift: true })
          .expect(200)
      ).body;
      expect(updated.is_preaching_shift).toBe(true);

      const reverted = (
        await request(server)
          .patch(`/api/activities/${created.id}`)
          .set('Authorization', auth())
          .send({ is_preaching_shift: false })
          .expect(200)
      ).body;
      expect(reverted.is_preaching_shift).toBe(false);
    });

    it('is included in batch create', async () => {
      const res = await request(server)
        .post('/api/activities/batch')
        .set('Authorization', auth())
        .send({
          ...baseTurn(),
          date: '2024-12-01',
          is_preaching_shift: true,
          repetition: { type: 'daily', count: 2 },
        })
        .expect(201);
      expect(
        res.body.every(
          (a: { is_preaching_shift: boolean }) => a.is_preaching_shift === true,
        ),
      ).toBe(true);
    });
  });

  // ── Preaching shift group limit ───────────────────────────────────────────

  describe('Preaching shift group limit', () => {
    let groupId: string;
    let preachingActivityIds: string[];

    const preachingTurn = (date: string) => ({
      region_id: regionId,
      name: 'Preaching shift',
      date,
      start_time: '09:00',
      end_time: '11:00',
      is_preaching_shift: true,
    });

    beforeAll(async () => {
      groupId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `PS-GRP-${Date.now()}`, region_id: regionId })
      ).body.id;

      // Create 3 preaching shifts and assign the group to all three
      preachingActivityIds = await Promise.all(
        ['2025-01-10', '2025-01-11', '2025-01-12'].map(async (date) => {
          const act = (
            await request(server)
              .post('/api/activities')
              .set('Authorization', auth())
              .send(preachingTurn(date))
          ).body;
          await request(server)
            .post(`/api/activities/${act.id}/guest-groups`)
            .set('Authorization', auth())
            .send({ groupId });
          return act.id as string;
        }),
      );
    });

    it('available-groups includes preaching_shifts_count on every item', async () => {
      const activity = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(preachingTurn('2025-01-20'))
      ).body;

      const res = await request(server)
        .get(`/api/activities/${activity.id}/available-groups`)
        .set('Authorization', auth())
        .expect(200);

      expect(
        res.body.every(
          (g: { preaching_shifts_count: number }) =>
            typeof g.preaching_shifts_count === 'number',
        ),
      ).toBe(true);
    });

    it('reflects correct count for a group with 3 shifts', async () => {
      const activity = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(preachingTurn('2025-01-21'))
      ).body;

      const res = await request(server)
        .get(`/api/activities/${activity.id}/available-groups`)
        .set('Authorization', auth())
        .expect(200);

      const item = res.body.find((g: { id: string }) => g.id === groupId);
      expect(item).toBeDefined();
      expect(item.preaching_shifts_count).toBe(3);
    });

    it('returns 0 for a group with no preaching shifts', async () => {
      const freshGroup = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `PS-FRESH-${Date.now()}`, region_id: regionId })
      ).body;

      const activity = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(preachingTurn('2025-01-22'))
      ).body;

      const res = await request(server)
        .get(`/api/activities/${activity.id}/available-groups`)
        .set('Authorization', auth())
        .expect(200);

      const item = res.body.find((g: { id: string }) => g.id === freshGroup.id);
      expect(item).toBeDefined();
      expect(item.preaching_shifts_count).toBe(0);
    });

    it('does not count non-preaching-shift activities', async () => {
      const regularGroup = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `PS-REG-${Date.now()}`, region_id: regionId })
      ).body;

      // Assign the group to 3 regular (non-preaching) activities
      await Promise.all(
        ['2025-02-01', '2025-02-02', '2025-02-03'].map(async (date) => {
          const act = (
            await request(server)
              .post('/api/activities')
              .set('Authorization', auth())
              .send({
                region_id: regionId,
                name: 'Regular activity',
                date,
                start_time: '09:00',
                end_time: '11:00',
                is_preaching_shift: false,
              })
          ).body;
          await request(server)
            .post(`/api/activities/${act.id}/guest-groups`)
            .set('Authorization', auth())
            .send({ groupId: regularGroup.id });
        }),
      );

      const preachingActivity = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(preachingTurn('2025-02-10'))
      ).body;

      const res = await request(server)
        .get(`/api/activities/${preachingActivity.id}/available-groups`)
        .set('Authorization', auth())
        .expect(200);

      const item = res.body.find(
        (g: { id: string }) => g.id === regularGroup.id,
      );
      expect(item).toBeDefined();
      expect(item.preaching_shifts_count).toBe(0);
    });

    it('blocks assigning a group that already has 3 preaching shifts', async () => {
      const blocked = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(preachingTurn('2025-01-23'))
      ).body;

      await request(server)
        .post(`/api/activities/${blocked.id}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId })
        .expect(400);
    });

    it('allows assigning to a non-preaching-shift activity regardless of preaching count', async () => {
      const regular = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            region_id: regionId,
            name: 'Regular',
            date: '2025-01-24',
            start_time: '14:00',
            end_time: '16:00',
            is_preaching_shift: false,
          })
      ).body;

      const res = await request(server)
        .post(`/api/activities/${regular.id}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId })
        .expect(200);

      expect(
        res.body.guest_groups.some((g: { id: string }) => g.id === groupId),
      ).toBe(true);
    });

    it('allows a 4th preaching shift after one is unassigned', async () => {
      // Unassign the group from the first of the 3 preaching shifts
      await request(server)
        .delete(
          `/api/activities/${preachingActivityIds[0]}/guest-groups/${groupId}`,
        )
        .set('Authorization', auth())
        .expect(200);

      const newShift = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(preachingTurn('2025-01-25'))
      ).body;

      const res = await request(server)
        .post(`/api/activities/${newShift.id}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId })
        .expect(200);

      expect(
        res.body.guest_groups.some((g: { id: string }) => g.id === groupId),
      ).toBe(true);
    });
  });

  // ── Host-scoped group filter ───────────────────────────────────────────────

  describe('Host-scoped group filter', () => {
    let hostId: string;
    let groupWithHostId: string;
    let groupOtherHostId: string;
    let groupNoHostId: string;
    let activityWithHostId: string;
    let activityNoHostId: string;

    beforeAll(async () => {
      const host = (
        await request(server)
          .post('/api/hosts')
          .set('Authorization', auth())
          .send({ name: `Host-scope-${Date.now()}`, region_id: regionId })
      ).body;
      hostId = host.id;

      const otherHost = (
        await request(server)
          .post('/api/hosts')
          .set('Authorization', auth())
          .send({ name: `Host-other-${Date.now()}`, region_id: regionId })
      ).body;

      groupWithHostId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `HS-A-${Date.now()}`, region_id: regionId })
      ).body.id;
      await request(server)
        .patch(`/api/guest-groups/${groupWithHostId}/host`)
        .set('Authorization', auth())
        .send({ hostId });

      groupOtherHostId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `HS-B-${Date.now()}`, region_id: regionId })
      ).body.id;
      await request(server)
        .patch(`/api/guest-groups/${groupOtherHostId}/host`)
        .set('Authorization', auth())
        .send({ hostId: otherHost.id });

      groupNoHostId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `HS-C-${Date.now()}`, region_id: regionId })
      ).body.id;

      activityWithHostId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({ ...baseTurn(), date: '2025-03-01', host_id: hostId })
      ).body.id;

      activityNoHostId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({ ...baseTurn(), date: '2025-03-02' })
      ).body.id;
    });

    it('shows all region groups regardless of activity host', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityWithHostId}/available-groups`)
        .set('Authorization', auth())
        .expect(200);

      const ids = res.body.map((g: { id: string }) => g.id);
      expect(ids).toContain(groupWithHostId);
      expect(ids).toContain(groupOtherHostId);
      expect(ids).toContain(groupNoHostId);
    });

    it('shows all region groups when activity has no host', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityNoHostId}/available-groups`)
        .set('Authorization', auth())
        .expect(200);

      const ids = res.body.map((g: { id: string }) => g.id);
      expect(ids).toContain(groupWithHostId);
      expect(ids).toContain(groupOtherHostId);
      expect(ids).toContain(groupNoHostId);
    });

    it('allows assigning a group from a different host to the activity', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityWithHostId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: groupOtherHostId })
        .expect(200);

      expect(
        res.body.guest_groups.some(
          (g: { id: string }) => g.id === groupOtherHostId,
        ),
      ).toBe(true);
    });

    it('allows assigning a group with no host to an activity with a host', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityWithHostId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: groupNoHostId })
        .expect(200);

      expect(
        res.body.guest_groups.some(
          (g: { id: string }) => g.id === groupNoHostId,
        ),
      ).toBe(true);
    });

    it('allows assigning a group belonging to the activity host', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityWithHostId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: groupWithHostId })
        .expect(200);

      expect(
        res.body.guest_groups.some(
          (g: { id: string }) => g.id === groupWithHostId,
        ),
      ).toBe(true);
    });

    it('allows assigning any group when activity has no host', async () => {
      const res = await request(server)
        .post(`/api/activities/${activityNoHostId}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: groupNoHostId })
        .expect(200);

      expect(
        res.body.guest_groups.some(
          (g: { id: string }) => g.id === groupNoHostId,
        ),
      ).toBe(true);
    });
  });

  // ── Preaching group carts ──────────────────────────────────────────────────

  describe('Preaching group carts', () => {
    let hostId: string;
    let cartInRegionId: string;
    let cartOtherHostId: string;
    let cartOtherRegionId: string;
    let activityWithHostId: string;
    let activityNoHostId: string;
    let group1Id: string;
    let group2Id: string;

    beforeAll(async () => {
      const host = (
        await request(server)
          .post('/api/hosts')
          .set('Authorization', auth())
          .send({ name: `Cart-host-${Date.now()}`, region_id: regionId })
      ).body;
      hostId = host.id;

      const otherHost = (
        await request(server)
          .post('/api/hosts')
          .set('Authorization', auth())
          .send({ name: `Cart-other-host-${Date.now()}`, region_id: regionId })
      ).body;

      const otherRegion = (
        await request(server)
          .post('/api/regions')
          .set('Authorization', auth())
          .send({
            name: 'Other Cart Region',
            event_start_date: '2024-06-14',
            event_end_date: '2024-06-22',
          })
      ).body;

      cartInRegionId = (
        await request(server)
          .post('/api/carts')
          .set('Authorization', auth())
          .send({ region_id: regionId, host_id: hostId, number: 'C-1' })
      ).body.id;

      cartOtherHostId = (
        await request(server)
          .post('/api/carts')
          .set('Authorization', auth())
          .send({ region_id: regionId, host_id: otherHost.id, number: 'C-2' })
      ).body.id;

      cartOtherRegionId = (
        await request(server)
          .post('/api/carts')
          .set('Authorization', auth())
          .send({ region_id: otherRegion.id, number: 'C-3' })
      ).body.id;

      activityWithHostId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            ...baseTurn(),
            date: '2025-04-01',
            host_id: hostId,
            is_preaching_shift: true,
          })
      ).body.id;

      activityNoHostId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({ ...baseTurn(), date: '2025-04-02', is_preaching_shift: true })
      ).body.id;

      const withGroups = (
        await request(server)
          .post(`/api/activities/${activityWithHostId}/preaching-groups`)
          .set('Authorization', auth())
          .send({ name: 'Grupo A' })
      ).body;
      group1Id = withGroups.preaching_groups[0].id;

      const withGroups2 = (
        await request(server)
          .post(`/api/activities/${activityWithHostId}/preaching-groups`)
          .set('Authorization', auth())
          .send({ name: 'Grupo B' })
      ).body;
      group2Id = withGroups2.preaching_groups[1].id;
    });

    it('available-carts only includes carts matching the activity region and host', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityWithHostId}/available-carts`)
        .set('Authorization', auth())
        .expect(200);

      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).toContain(cartInRegionId);
      expect(ids).not.toContain(cartOtherHostId);
      expect(ids).not.toContain(cartOtherRegionId);
    });

    it('available-carts includes carts with any host when activity has no host', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityNoHostId}/available-carts`)
        .set('Authorization', auth())
        .expect(200);

      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).toContain(cartInRegionId);
      expect(ids).toContain(cartOtherHostId);
      expect(ids).not.toContain(cartOtherRegionId);
    });

    it('blocks assigning a cart from a different host', async () => {
      await request(server)
        .post(
          `/api/activities/${activityWithHostId}/preaching-groups/${group1Id}/carts`,
        )
        .set('Authorization', auth())
        .send({ cartId: cartOtherHostId })
        .expect(400);
    });

    it('blocks assigning a cart from a different region', async () => {
      await request(server)
        .post(
          `/api/activities/${activityWithHostId}/preaching-groups/${group1Id}/carts`,
        )
        .set('Authorization', auth())
        .send({ cartId: cartOtherRegionId })
        .expect(400);
    });

    it('assigns a matching cart to a preaching group', async () => {
      const res = await request(server)
        .post(
          `/api/activities/${activityWithHostId}/preaching-groups/${group1Id}/carts`,
        )
        .set('Authorization', auth())
        .send({ cartId: cartInRegionId })
        .expect(200);

      const group = res.body.preaching_groups.find(
        (g: { id: string }) => g.id === group1Id,
      );
      expect(
        group.carts.some((c: { id: string }) => c.id === cartInRegionId),
      ).toBe(true);
    });

    it('no longer offers an assigned cart as available', async () => {
      const res = await request(server)
        .get(`/api/activities/${activityWithHostId}/available-carts`)
        .set('Authorization', auth())
        .expect(200);

      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(cartInRegionId);
    });

    it('blocks assigning a cart already assigned to another group of the same activity', async () => {
      await request(server)
        .post(
          `/api/activities/${activityWithHostId}/preaching-groups/${group2Id}/carts`,
        )
        .set('Authorization', auth())
        .send({ cartId: cartInRegionId })
        .expect(400);
    });

    it('removes a cart from a preaching group', async () => {
      const res = await request(server)
        .delete(
          `/api/activities/${activityWithHostId}/preaching-groups/${group1Id}/carts/${cartInRegionId}`,
        )
        .set('Authorization', auth())
        .expect(200);

      const group = res.body.preaching_groups.find(
        (g: { id: string }) => g.id === group1Id,
      );
      expect(
        group.carts.some((c: { id: string }) => c.id === cartInRegionId),
      ).toBe(false);
    });

    it('allows assigning the cart to another group after being removed', async () => {
      const res = await request(server)
        .post(
          `/api/activities/${activityWithHostId}/preaching-groups/${group2Id}/carts`,
        )
        .set('Authorization', auth())
        .send({ cartId: cartInRegionId })
        .expect(200);

      const group = res.body.preaching_groups.find(
        (g: { id: string }) => g.id === group2Id,
      );
      expect(
        group.carts.some((c: { id: string }) => c.id === cartInRegionId),
      ).toBe(true);
    });
  });

  // ── is_food_shift field ───────────────────────────────────────────────────

  describe('is_food_shift field', () => {
    it('defaults to false when not provided', async () => {
      const res = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send(baseTurn())
        .expect(201);
      expect(res.body.is_food_shift).toBe(false);
    });

    it('persists true when provided', async () => {
      const res = await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), is_food_shift: true })
        .expect(201);
      expect(res.body.is_food_shift).toBe(true);
    });

    it('can be toggled via PATCH', async () => {
      const created = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send(baseTurn())
      ).body;

      const updated = (
        await request(server)
          .patch(`/api/activities/${created.id}`)
          .set('Authorization', auth())
          .send({ is_food_shift: true })
          .expect(200)
      ).body;
      expect(updated.is_food_shift).toBe(true);

      const reverted = (
        await request(server)
          .patch(`/api/activities/${created.id}`)
          .set('Authorization', auth())
          .send({ is_food_shift: false })
          .expect(200)
      ).body;
      expect(reverted.is_food_shift).toBe(false);
    });

    it('is included in batch create', async () => {
      const res = await request(server)
        .post('/api/activities/batch')
        .set('Authorization', auth())
        .send({
          ...baseTurn(),
          date: '2024-12-10',
          is_food_shift: true,
          repetition: { type: 'daily', count: 2 },
        })
        .expect(201);
      expect(
        res.body.every((a: { is_food_shift: boolean }) => a.is_food_shift === true),
      ).toBe(true);
    });

    it('filters by is_food_shift=true', async () => {
      await request(server)
        .post('/api/activities')
        .set('Authorization', auth())
        .send({ ...baseTurn(), date: '2024-12-20', is_food_shift: true });

      const res = await request(server)
        .get('/api/activities')
        .query({ regionId, is_food_shift: true })
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every((a: { is_food_shift: boolean }) => a.is_food_shift === true),
      ).toBe(true);
    });

    it('filters by is_food_shift=false', async () => {
      const res = await request(server)
        .get('/api/activities')
        .query({ regionId, is_food_shift: false })
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every((a: { is_food_shift: boolean }) => a.is_food_shift === false),
      ).toBe(true);
    });
  });

  // ── Food shift: available-groups filter ───────────────────────────────────

  describe('Food shift: available-groups morning preaching filter', () => {
    const DATE = '2024-08-15';

    let groupWithMorningShiftId: string;
    let groupWithAfternoonShiftId: string;
    let groupWithShiftDifferentDayId: string;
    let groupWithNoShiftId: string;
    let foodShiftId: string;

    beforeAll(async () => {
      // Create four guest groups
      groupWithMorningShiftId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `FS-MORN-${Date.now()}`, region_id: regionId })
      ).body.id;

      groupWithAfternoonShiftId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `FS-AFT-${Date.now()}`, region_id: regionId })
      ).body.id;

      groupWithShiftDifferentDayId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `FS-OTHER-${Date.now()}`, region_id: regionId })
      ).body.id;

      groupWithNoShiftId = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `FS-NONE-${Date.now()}`, region_id: regionId })
      ).body.id;

      // Morning preaching shift on DATE (09:00 < 12:00) → group qualifies
      const morningShift = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            region_id: regionId,
            name: 'Turno predicación mañana',
            date: DATE,
            start_time: '09:00',
            end_time: '11:00',
            is_preaching_shift: true,
          })
      ).body;
      await request(server)
        .post(`/api/activities/${morningShift.id}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: groupWithMorningShiftId });

      // Afternoon preaching shift on DATE (14:00 >= 12:00) → group does NOT qualify
      const afternoonShift = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            region_id: regionId,
            name: 'Turno predicación tarde',
            date: DATE,
            start_time: '14:00',
            end_time: '16:00',
            is_preaching_shift: true,
          })
      ).body;
      await request(server)
        .post(`/api/activities/${afternoonShift.id}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: groupWithAfternoonShiftId });

      // Morning preaching shift on a DIFFERENT day → group does NOT qualify
      const otherDayShift = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            region_id: regionId,
            name: 'Turno predicación otro día',
            date: '2024-08-16',
            start_time: '09:00',
            end_time: '11:00',
            is_preaching_shift: true,
          })
      ).body;
      await request(server)
        .post(`/api/activities/${otherDayShift.id}/guest-groups`)
        .set('Authorization', auth())
        .send({ groupId: groupWithShiftDifferentDayId });

      // groupWithNoShiftId has no preaching shift at all

      // The food shift we'll query available groups for
      foodShiftId = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            region_id: regionId,
            name: 'Turno de comida',
            date: DATE,
            start_time: '12:30',
            end_time: '14:00',
            is_food_shift: true,
          })
      ).body.id;
    });

    it('includes only the group with a morning preaching shift that day', async () => {
      const res = await request(server)
        .get(`/api/activities/${foodShiftId}/available-groups`)
        .set('Authorization', auth())
        .expect(200);

      const ids: string[] = res.body.map((g: { id: string }) => g.id);
      expect(ids).toContain(groupWithMorningShiftId);
      expect(ids).not.toContain(groupWithAfternoonShiftId);
      expect(ids).not.toContain(groupWithShiftDifferentDayId);
      expect(ids).not.toContain(groupWithNoShiftId);
    });

    it('does not apply morning filter for a regular (non-food-shift) activity', async () => {
      const regularActivity = (
        await request(server)
          .post('/api/activities')
          .set('Authorization', auth())
          .send({
            region_id: regionId,
            name: 'Actividad normal',
            date: DATE,
            start_time: '15:00',
            end_time: '17:00',
          })
      ).body;

      const res = await request(server)
        .get(`/api/activities/${regularActivity.id}/available-groups`)
        .set('Authorization', auth())
        .expect(200);

      const ids: string[] = res.body.map((g: { id: string }) => g.id);
      // All four groups should be eligible (no morning-shift filter)
      expect(ids).toContain(groupWithMorningShiftId);
      expect(ids).toContain(groupWithAfternoonShiftId);
      expect(ids).toContain(groupWithShiftDifferentDayId);
      expect(ids).toContain(groupWithNoShiftId);
    });
  });
});
