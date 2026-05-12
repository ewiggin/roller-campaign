import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAdmin } from './test-app';

describe('GuestGroups (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;
  let regionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    adminToken = await loginAdmin(server);

    const regionRes = await request(server)
      .post('/api/regions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Region' })
      .expect(201);
    regionId = regionRes.body.id;
  });

  afterAll(() => app.close());

  const auth = () => `Bearer ${adminToken}`;

  describe('POST /api/guest-groups', () => {
    it('creates a group', async () => {
      const res = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-001', region_id: regionId })
        .expect(201);

      expect(res.body).toMatchObject({ group_code: 'GRP-001', region_id: regionId, guest_count: 0 });
    });

    it('returns 409 for duplicate group_code', () =>
      request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-001', region_id: regionId })
        .expect(409));

    it('returns 404 for non-existent region', () =>
      request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-999', region_id: '00000000-0000-0000-0000-000000000000' })
        .expect(404));

    it('returns 400 for missing group_code', () =>
      request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ region_id: regionId })
        .expect(400));
  });

  describe('GET /api/guest-groups', () => {
    it('returns groups for a region', async () => {
      const res = await request(server)
        .get(`/api/guest-groups?regionId=${regionId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('guest_count');
    });
  });

  describe('PATCH /api/guest-groups/:id', () => {
    it('updates a group', async () => {
      const grp = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-UPDATE', region_id: regionId });

      const res = await request(server)
        .patch(`/api/guest-groups/${grp.body.id}`)
        .set('Authorization', auth())
        .send({ group_code: 'GRP-UPDATED' })
        .expect(200);

      expect(res.body.group_code).toBe('GRP-UPDATED');
    });
  });

  describe('DELETE /api/guest-groups/:id', () => {
    it('deletes an empty group', async () => {
      const grp = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-DELETE', region_id: regionId });

      await request(server)
        .delete(`/api/guest-groups/${grp.body.id}`)
        .set('Authorization', auth())
        .expect(204);
    });

    it('returns 400 when group has guests', async () => {
      const grp = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-WITH-GUEST', region_id: regionId });

      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ guest_code: 'G-IN-GROUP', group_id: grp.body.id, region_id: regionId, full_name: 'Test' });

      await request(server)
        .delete(`/api/guest-groups/${grp.body.id}`)
        .set('Authorization', auth())
        .expect(400);
    });
  });

  describe('PATCH /api/guest-groups/:id/contact', () => {
    it('sets the group contact', async () => {
      const grp = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-CONTACT', region_id: regionId });

      const guest1 = await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ guest_code: 'G-C1', group_id: grp.body.id, region_id: regionId, full_name: 'A' });

      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ guest_code: 'G-C2', group_id: grp.body.id, region_id: regionId, full_name: 'B', is_group_contact: true });

      // Set G-C1 as contact
      await request(server)
        .patch(`/api/guest-groups/${grp.body.id}/contact`)
        .set('Authorization', auth())
        .send({ guestId: guest1.body.id })
        .expect(204);

      const gRes = await request(server)
        .get(`/api/guests/${guest1.body.id}`)
        .set('Authorization', auth());
      expect(gRes.body.is_group_contact).toBe(true);
    });

    it('returns 400 if guest does not belong to the group', async () => {
      const grpA = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-A', region_id: regionId });

      const grpB = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-B', region_id: regionId });

      const guestB = await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({ guest_code: 'G-B', group_id: grpB.body.id, region_id: regionId, full_name: 'B' });

      await request(server)
        .patch(`/api/guest-groups/${grpA.body.id}/contact`)
        .set('Authorization', auth())
        .send({ guestId: guestB.body.id })
        .expect(400);
    });
  });
});
