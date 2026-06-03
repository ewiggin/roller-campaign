import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  binaryParser,
  buildExcelBuffer,
  createTestApp,
  loginAdmin,
  parseExcelResponse,
} from './test-app';

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

      expect(res.body).toMatchObject({
        group_code: 'GRP-001',
        region_id: regionId,
        guest_count: 0,
        available_from: null,
        available_to: null,
        composition: null,
      });
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
        .send({
          group_code: 'GRP-999',
          region_id: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404));

    it('returns 400 for missing group_code', () =>
      request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ region_id: regionId })
        .expect(400));
  });

  describe('GET /api/guest-groups', () => {
    it('returns paginated groups for a region', async () => {
      const res = await request(server)
        .get(`/api/guest-groups?regionId=${regionId}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toHaveProperty('guest_count');
      expect(res.body.data[0]).toHaveProperty('available_from');
      expect(res.body.data[0]).toHaveProperty('composition');
    });
  });

  describe('PATCH /api/guest-groups/:id', () => {
    it('updates group_code', async () => {
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

    it('updates availability dates and composition', async () => {
      const grp = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-AVAIL', region_id: regionId })
        .expect(201);

      const res = await request(server)
        .patch(`/api/guest-groups/${grp.body.id}`)
        .set('Authorization', auth())
        .send({
          available_from: '2024-06-14',
          available_to: '2024-06-21',
          composition: 'mixed',
        })
        .expect(200);

      expect(res.body.available_from).toBe('2024-06-14');
      expect(res.body.available_to).toBe('2024-06-21');
      expect(res.body.composition).toBe('mixed');
    });

    it('returns 400 for invalid composition value', () =>
      request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-BAD-COMP', region_id: regionId })
        .then((grp) =>
          request(server)
            .patch(`/api/guest-groups/${grp.body.id}`)
            .set('Authorization', auth())
            .send({ composition: 'invalid_value' })
            .expect(400),
        ));

    it('clears availability and composition when set to null', async () => {
      const grp = await request(server)
        .post('/api/guest-groups')
        .set('Authorization', auth())
        .send({ group_code: 'GRP-CLEAR', region_id: regionId });

      await request(server)
        .patch(`/api/guest-groups/${grp.body.id}`)
        .set('Authorization', auth())
        .send({ available_from: '2024-06-14', composition: 'men_only' });

      const res = await request(server)
        .patch(`/api/guest-groups/${grp.body.id}`)
        .set('Authorization', auth())
        .send({ available_from: null, composition: null })
        .expect(200);

      expect(res.body.available_from).toBeNull();
      expect(res.body.composition).toBeNull();
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
        .send({
          guest_code: 'G-IN-GROUP',
          group_id: grp.body.id,
          region_id: regionId,
          full_name: 'Test',
        });

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
        .send({
          guest_code: 'G-C1',
          group_id: grp.body.id,
          region_id: regionId,
          full_name: 'A',
        });

      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          guest_code: 'G-C2',
          group_id: grp.body.id,
          region_id: regionId,
          full_name: 'B',
          is_group_contact: true,
        });

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
        .send({
          guest_code: 'G-B',
          group_id: grpB.body.id,
          region_id: regionId,
          full_name: 'B',
        });

      await request(server)
        .patch(`/api/guest-groups/${grpA.body.id}/contact`)
        .set('Authorization', auth())
        .send({ guestId: guestB.body.id })
        .expect(400);
    });
  });

  describe('Import Excel', () => {
    it('GET /api/guest-groups/import/template returns xlsx', async () => {
      const res = await request(server)
        .get('/api/guest-groups/import/template')
        .set('Authorization', auth())
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    });

    it('POST /api/guest-groups/import with regionId creates groups', async () => {
      const file = buildExcelBuffer([
        { group_code: 'IMP-001' },
        { group_code: 'IMP-002' },
      ]);
      const res = await request(server)
        .post(`/api/guest-groups/import?regionId=${regionId}`)
        .set('Authorization', auth())
        .attach('file', file, 'groups.xlsx')
        .expect(200);
      expect(res.body.created).toBe(2);
    });

    it('POST /api/guest-groups/import skips duplicates', async () => {
      const file = buildExcelBuffer([{ group_code: 'IMP-001' }]);
      const res = await request(server)
        .post(`/api/guest-groups/import?regionId=${regionId}`)
        .set('Authorization', auth())
        .attach('file', file, 'groups.xlsx')
        .expect(200);
      expect(res.body.created).toBe(0);
    });

    it('POST /api/guest-groups/import auto-detects region from region_name column', async () => {
      const file = buildExcelBuffer([
        { group_code: 'AUTO-001', region_name: 'Test Region' },
        { group_code: 'AUTO-002', region_name: 'Test Region' },
        { group_code: 'AUTO-BAD', region_name: 'Nonexistent Region' },
      ]);
      const res = await request(server)
        .post('/api/guest-groups/import')
        .set('Authorization', auth())
        .attach('file', file, 'groups.xlsx')
        .expect(200);
      expect(res.body.created).toBe(2);
      expect(res.body.regions_not_found).toBe(1);
    });

    it('POST /api/guest-groups/import returns 400 with no regionId and no region_name column', async () => {
      const file = buildExcelBuffer([{ group_code: 'FAIL-001' }]);
      await request(server)
        .post('/api/guest-groups/import')
        .set('Authorization', auth())
        .attach('file', file, 'groups.xlsx')
        .expect(400);
    });

    it('deleteAbsent=true removes groups absent from Excel and their guests', async () => {
      // Seed GRP-DA-KEEP and GRP-DA-GONE, each with one guest
      const keep = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: 'GRP-DA-KEEP', region_id: regionId })
      ).body;
      const gone = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: 'GRP-DA-GONE', region_id: regionId })
      ).body;

      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          guest_code: 'G-DA-KEEP',
          group_id: keep.id,
          region_id: regionId,
          full_name: 'Keep Guest',
        });
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          guest_code: 'G-DA-GONE',
          group_id: gone.id,
          region_id: regionId,
          full_name: 'Gone Guest',
        });

      // Build Excel with ALL existing groups except GRP-DA-GONE so exactly 1 is absent
      const allGroups = (
        await request(server)
          .get('/api/guest-groups?limit=500')
          .set('Authorization', auth())
      ).body.data as { group_code: string }[];
      const excelRows = allGroups
        .filter((g) => g.group_code !== 'GRP-DA-GONE')
        .map((g) => ({ group_code: g.group_code }));

      const file = buildExcelBuffer(excelRows);
      const res = await request(server)
        .post(`/api/guest-groups/import?regionId=${regionId}&deleteAbsent=true`)
        .set('Authorization', auth())
        .attach('file', file, 'groups.xlsx')
        .expect(200);

      expect(res.body.deleted).toBe(1);

      // GRP-DA-GONE and its guest must be gone
      const groups = (
        await request(server)
          .get(`/api/guest-groups?regionId=${regionId}`)
          .set('Authorization', auth())
      ).body;
      const codes = groups.data.map(
        (g: { group_code: string }) => g.group_code,
      );
      expect(codes).toContain('GRP-DA-KEEP');
      expect(codes).not.toContain('GRP-DA-GONE');

      const guestGone = await request(server)
        .get('/api/guests?search=G-DA-GONE')
        .set('Authorization', auth());
      expect(guestGone.body.total).toBe(0);

      const guestKept = await request(server)
        .get('/api/guests?search=G-DA-KEEP')
        .set('Authorization', auth());
      expect(guestKept.body.total).toBe(1);
    });

    it('deleteAbsent=true with no absent groups omits deleted from response', async () => {
      // Excel includes all groups currently in DB — nothing to delete
      const allGroups = (
        await request(server)
          .get('/api/guest-groups?limit=500')
          .set('Authorization', auth())
      ).body.data as { group_code: string }[];
      const file = buildExcelBuffer(
        allGroups.map((g) => ({ group_code: g.group_code })),
      );

      const res = await request(server)
        .post(`/api/guest-groups/import?regionId=${regionId}&deleteAbsent=true`)
        .set('Authorization', auth())
        .attach('file', file, 'groups.xlsx')
        .expect(200);

      expect(res.body.deleted).toBeUndefined();
    });
  });

  describe('Export Excel', () => {
    it('GET /api/guest-groups/export returns xlsx', async () => {
      const res = await request(server)
        .get(`/api/guest-groups/export?regionId=${regionId}`)
        .set('Authorization', auth())
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
      const rows = parseExcelResponse(res.body as Buffer);
      expect(rows.length).toBeGreaterThan(0);
      expect((rows[0] as Record<string, unknown>)['group_code']).toBeDefined();
    });
  });

  describe('PATCH /api/guest-groups/:id - duplicate group_code', () => {
    it('returns 409 when renaming to an existing group_code', async () => {
      const g1 = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: 'DUP-GG-A', region_id: regionId })
      ).body;
      const g2 = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: 'DUP-GG-B', region_id: regionId })
      ).body;

      await request(server)
        .patch(`/api/guest-groups/${g2.id}`)
        .set('Authorization', auth())
        .send({ group_code: g1.group_code })
        .expect(409);
    });
  });

  describe('region_admin access paths', () => {
    let coordToken: string;

    beforeAll(async () => {
      const userRes = (
        await request(server)
          .post('/api/users')
          .set('Authorization', auth())
          .send({
            email: `coord-gg-${Date.now()}@test.local`,
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

    it('region_admin sees only groups in their region', async () => {
      const res = await request(server)
        .get(`/api/guest-groups?regionId=${regionId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('region_admin can export groups in their region', async () => {
      const res = await request(server)
        .get(`/api/guest-groups/export?regionId=${regionId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    });
  });

  describe('GET /api/guest-groups/:id', () => {
    it('returns a specific group', async () => {
      const grp = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: 'GRP-GETONE', region_id: regionId })
      ).body;
      const res = await request(server)
        .get(`/api/guest-groups/${grp.id}`)
        .set('Authorization', auth())
        .expect(200);
      expect(res.body.id).toBe(grp.id);
      expect(res.body.guest_count).toBe(0);
    });

    it('returns 404 for unknown id', () =>
      request(server)
        .get('/api/guest-groups/00000000-0000-0000-0000-000000000000')
        .set('Authorization', auth())
        .expect(404));
  });

  describe('PATCH /api/guest-groups/:id/host (assignHost)', () => {
    let grpId: string;
    let hostId: string;

    beforeAll(async () => {
      const grp = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: 'GRP-HOST', region_id: regionId })
      ).body;
      grpId = grp.id;

      const host = (
        await request(server)
          .post('/api/hosts')
          .set('Authorization', auth())
          .send({ name: 'Host For Group', region_id: regionId })
      ).body;
      hostId = host.id;
    });

    it('assigns a host to a group', async () => {
      const res = await request(server)
        .patch(`/api/guest-groups/${grpId}/host`)
        .set('Authorization', auth())
        .send({ hostId })
        .expect(200);
      expect(res.body.host_id).toBe(hostId);
    });

    it('unassigns host by passing null', async () => {
      const res = await request(server)
        .patch(`/api/guest-groups/${grpId}/host`)
        .set('Authorization', auth())
        .send({ hostId: null })
        .expect(200);
      expect(res.body.host_id).toBeNull();
    });

    it('returns 400 assigning host from different region', async () => {
      const otherRegion = (
        await request(server)
          .post('/api/regions')
          .set('Authorization', auth())
          .send({ name: 'Other Host Region' })
      ).body;
      const otherHost = (
        await request(server)
          .post('/api/hosts')
          .set('Authorization', auth())
          .send({ name: 'Other Host', region_id: otherRegion.id })
      ).body;

      await request(server)
        .patch(`/api/guest-groups/${grpId}/host`)
        .set('Authorization', auth())
        .send({ hostId: otherHost.id })
        .expect(400);
    });
  });
});
