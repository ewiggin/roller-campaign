import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  binaryParser,
  buildExcelBuffer,
  createTestApp,
  loginAdmin,
  parseExcelResponse,
} from './test-app';

describe('Guests (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;
  let regionId: string;
  let groupId: string;
  let guestCode: string;

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

    // Shared guest used in export and public form endpoint tests
    guestCode = 'FORM-0001';
    await request(server)
      .post('/api/guests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        guest_code: guestCode,
        group_id: groupId,
        region_id: regionId,
        full_name: 'Form Guest',
      });
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
  describe('GET /api/guest-access/lookup', () => {
    let lookupCode: string;

    beforeAll(async () => {
      lookupCode = `LOOKUP-${Date.now()}`;
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          ...baseGuest(),
          guest_code: lookupCode,
          full_name: 'Lookup Guest',
        })
        .expect(201);
    });

    it('returns guest data for a valid code', async () => {
      const res = await request(server)
        .get(`/api/guest-access/lookup?code=${lookupCode}`)
        .expect(200);

      expect(res.body.guest_code).toBe(lookupCode);
      expect(res.body.region_name).toBeDefined();
    });

    it('returns 404 for an unknown code', () =>
      request(server)
        .get('/api/guest-access/lookup?code=DOES-NOT-EXIST')
        .expect(404));
  });

  // ---------------------------------------------------------------------------
  describe('PATCH /api/guest-access/submit', () => {
    let submitCode: string;

    beforeAll(async () => {
      submitCode = `SUBMIT-${Date.now()}`;
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          ...baseGuest(),
          guest_code: submitCode,
          full_name: 'Submit Guest',
        })
        .expect(201);
    });

    const validPayload = () => ({
      full_name: 'Submit Guest',
      email: 'submit@example.com',
      origin_city: 'Madrid',
      car_seats: 0,
      speaks_english: false,
      other_languages: null,
      real_arrival: '2024-06-14',
      real_arrival_time: '10:00',
      real_departure: '2024-06-21',
      real_departure_time: '16:00',
      hosting_address: 'Calle Mayor 1',
      lat: null,
      lng: null,
      transport_mode: 'Coche',
      arrival_other_transport: null,
      arrival_flight: null,
      needs_airport_transfer: false,
      terms_accepted: true,
      terms_version: '1.0',
    });

    it('submits form and saves terms consent', async () => {
      await request(server)
        .patch(`/api/guest-access/submit?code=${submitCode}`)
        .send(validPayload())
        .expect(204);

      const detail = await request(server)
        .get(`/api/guests`)
        .set('Authorization', auth())
        .query({ search: submitCode });

      const guest = detail.body.data.find(
        (g: { guest_code: string }) => g.guest_code === submitCode,
      );
      expect(guest.terms_accepted).toBe(true);
      expect(guest.terms_version).toBe('1.0');
      expect(guest.terms_accepted_at).toBeTruthy();
    });

    it('returns 404 for unknown code', () =>
      request(server)
        .patch('/api/guest-access/submit?code=NO-EXIST')
        .send(validPayload())
        .expect(404));

    it('returns 400 when terms_accepted is missing', () =>
      request(server)
        .patch(`/api/guest-access/submit?code=${submitCode}`)
        .send({
          ...validPayload(),
          terms_accepted: undefined,
          terms_version: undefined,
        })
        .expect(400));
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

  describe('GET /api/guests/export', () => {
    it('returns xlsx with guest data matching current filters', async () => {
      const res = await request(server)
        .get(`/api/guests/export?regionId=${regionId}`)
        .set('Authorization', auth())
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
      const rows = parseExcelResponse(res.body as Buffer);
      expect(rows.length).toBeGreaterThan(0);
      const row = rows[0] as Record<string, unknown>;
      expect(row['guest_code']).toBeDefined();
      expect(row['full_name']).toBeDefined();
      expect(row['region_name']).toBeDefined();
    });
  });

  describe('Public form endpoints (guest-access)', () => {
    it('GET /api/guest-access/lookup returns guest_code and region_name', async () => {
      const res = await request(server)
        .get(`/api/guest-access/lookup?code=${guestCode}`)
        .expect(200);
      expect(res.body.guest_code).toBe(guestCode);
      expect(res.body.region_name).toBeDefined();
    });

    it('GET /api/guest-access/lookup accepts code without dashes', async () => {
      const noDashes = guestCode.replace(/-/g, '');
      const res = await request(server)
        .get(`/api/guest-access/lookup?code=${noDashes}`)
        .expect(200);
      expect(res.body.guest_code).toBe(guestCode);
    });

    it('GET /api/guest-access/lookup returns 404 for unknown code', () =>
      request(server)
        .get('/api/guest-access/lookup?code=ZZZZ-9999')
        .expect(404));

    it('PATCH /api/guest-access/submit updates guest form data', async () => {
      await request(server)
        .patch(`/api/guest-access/submit?code=${guestCode}`)
        .send({
          full_name: 'Updated Name',
          email: 'updated@test.com',
          origin_city: 'Barcelona',
          car_seats: 3,
          speaks_english: true,
          other_languages: null,
          real_arrival: '2026-07-01',
          real_arrival_time: '10:00',
          real_departure: '2026-07-07',
          real_departure_time: '18:00',
          hosting_address: 'Calle Test 1',
          lat: null,
          lng: null,
          transport_mode: 'Coche',
          arrival_other_transport: null,
          arrival_flight: null,
          needs_airport_transfer: false,
          terms_accepted: true,
          terms_version: '1.0',
        })
        .expect(204);
    });

    it('PATCH /api/guest-access/submit returns 404 for unknown code', () =>
      request(server)
        .patch('/api/guest-access/submit?code=ZZZZ-9999')
        .send({
          full_name: 'X',
          email: 'x@x.com',
          origin_city: 'X',
          car_seats: 0,
          speaks_english: false,
          other_languages: null,
          real_arrival: '2026-07-01',
          real_arrival_time: '10:00',
          real_departure: '2026-07-07',
          real_departure_time: '18:00',
          hosting_address: 'X',
          lat: null,
          lng: null,
          transport_mode: 'Coche',
          arrival_other_transport: null,
          arrival_flight: null,
          needs_airport_transfer: false,
          terms_accepted: true,
          terms_version: '1.0',
        })
        .expect(404));
  });

  describe('POST /api/guests/import/export-not-found', () => {
    it('returns xlsx with the provided rows', async () => {
      const rows = [
        {
          guest_code: 'G-NF-01',
          group_code: 'GRP-NF',
          full_name: 'Not Found Guest',
        },
      ];
      const res = await request(server)
        .post('/api/guests/import/export-not-found')
        .set('Authorization', auth())
        .buffer(true)
        .parse(binaryParser)
        .send({ rows })
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
      const parsed = parseExcelResponse(res.body as Buffer);
      expect(parsed.length).toBe(1);
    });
  });

  describe('Import commit mode B (group-based region, no regionId)', () => {
    it('derives region from group_code when no regionId provided', async () => {
      const grp = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: 'GRP-MODEB', region_id: regionId })
      ).body;

      const rows = [
        {
          guest_code: 'G-MODEB-01',
          group_code: grp.group_code,
          full_name: 'Mode B Guest',
        },
      ];
      const res = await request(server)
        .post('/api/guests/import/commit')
        .set('Authorization', auth())
        .send({ rows })
        .expect(200);
      expect(res.body.created_guests).toBe(1);
    });

    it('skips rows whose group is not found', async () => {
      const rows = [
        {
          guest_code: 'G-NFGRP-01',
          group_code: 'GRP-NONEXISTENT',
          full_name: 'Skip Me',
        },
      ];
      const res = await request(server)
        .post('/api/guests/import/commit')
        .set('Authorization', auth())
        .send({ rows })
        .expect(200);
      expect(res.body.created_guests).toBe(0);
      expect(res.body.groups_not_found).toBe(1);
    });
  });

  describe('Import commit with updateRows', () => {
    it('updates existing guests via updateRows', async () => {
      const grp = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: 'GRP-UPDATE-ROWS', region_id: regionId })
      ).body;

      const code = `G-UPD-${Date.now()}`;
      await request(server)
        .post('/api/guests')
        .set('Authorization', auth())
        .send({
          guest_code: code,
          group_id: grp.id,
          region_id: regionId,
          full_name: 'Original Name',
        });

      const updateRows = [
        {
          guest_code: code,
          group_code: grp.group_code,
          full_name: 'Updated Name',
        },
      ];
      const res = await request(server)
        .post('/api/guests/import/commit')
        .set('Authorization', auth())
        .send({ rows: [], updateRows, regionId })
        .expect(200);
      expect(res.body.updated_guests).toBe(1);
    });
  });

  describe('Import deleteAbsent sync', () => {
    // Scenario:  DB has G-KEEP-1, G-KEEP-2, G-ABSENT-1, G-ABSENT-2
    //            Excel has G-KEEP-1 (dup/skip), G-KEEP-2 (dup/skip), G-NEW-DA
    //            toDelete = [G-ABSENT-1, G-ABSENT-2]
    //            After commit: G-ABSENT-* deleted, G-KEEP-* and G-NEW-DA survive

    let grp: { id: string; group_code: string };

    beforeAll(async () => {
      grp = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `GRP-DA-${Date.now()}`, region_id: regionId })
      ).body;

      for (const code of ['G-KEEP-1', 'G-KEEP-2', 'G-ABSENT-1', 'G-ABSENT-2']) {
        await request(server)
          .post('/api/guests')
          .set('Authorization', auth())
          .send({
            guest_code: code,
            group_id: grp.id,
            region_id: regionId,
            full_name: code,
          });
      }
    });

    it('parse returns toDelete = guests absent from the Excel', async () => {
      const xlsx = buildExcelBuffer([
        {
          guest_code: 'G-KEEP-1',
          group_code: grp.group_code,
          full_name: 'Keep One',
        },
        {
          guest_code: 'G-KEEP-2',
          group_code: grp.group_code,
          full_name: 'Keep Two',
        },
        {
          guest_code: 'G-NEW-DA',
          group_code: grp.group_code,
          full_name: 'New DA',
        },
      ]);
      const res = await request(server)
        .post(`/api/guests/import/parse?regionId=${regionId}`)
        .set('Authorization', auth())
        .attach('file', xlsx, 'test.xlsx')
        .expect(200);

      const toDeleteCodes = res.body.toDelete.map(
        (g: { guest_code: string }) => g.guest_code,
      );
      expect(toDeleteCodes).toContain('G-ABSENT-1');
      expect(toDeleteCodes).toContain('G-ABSENT-2');
      expect(toDeleteCodes).not.toContain('G-KEEP-1');
      expect(toDeleteCodes).not.toContain('G-KEEP-2');
      expect(res.body.summary.to_delete).toBe(toDeleteCodes.length);
    });

    it('commit with deleteAbsent deletes only absent guests, not skipped duplicates', async () => {
      const res = await request(server)
        .post('/api/guests/import/commit')
        .set('Authorization', auth())
        .send({
          regionId,
          rows: [
            {
              guest_code: 'G-NEW-DA',
              group_code: grp.group_code,
              full_name: 'New DA',
            },
          ],
          deleteAbsent: true,
          toDeleteCodes: ['G-ABSENT-1', 'G-ABSENT-2'],
        })
        .expect(200);

      expect(res.body.deleted_guests).toBe(2);

      // Absent guests removed
      const list = await request(server)
        .get(`/api/guests?search=G-ABSENT`)
        .set('Authorization', auth());
      expect(list.body.total).toBe(0);

      // Kept guests still present
      const kept = await request(server)
        .get(`/api/guests?search=G-KEEP`)
        .set('Authorization', auth());
      expect(kept.body.total).toBe(2);

      // New guest created
      const created = await request(server)
        .get(`/api/guests?search=G-NEW-DA`)
        .set('Authorization', auth());
      expect(created.body.total).toBe(1);
    });

    it('commit with empty toDeleteCodes does not delete anything', async () => {
      const beforeList = await request(server)
        .get(`/api/guests?regionId=${regionId}`)
        .set('Authorization', auth());
      const before = beforeList.body.total as number;

      await request(server)
        .post('/api/guests/import/commit')
        .set('Authorization', auth())
        .send({
          regionId,
          rows: [],
          deleteAbsent: true,
          toDeleteCodes: [],
        })
        .expect(200);

      const afterList = await request(server)
        .get(`/api/guests?regionId=${regionId}`)
        .set('Authorization', auth());
      expect(afterList.body.total).toBe(before);
    });
  });

  describe('POST /api/guests/:id/migrate - edge cases', () => {
    it('returns 404 when target group does not exist', async () => {
      const guest = (
        await request(server)
          .post('/api/guests')
          .set('Authorization', auth())
          .send({
            guest_code: `MIG-NF-${Date.now()}`,
            group_id: groupId,
            region_id: regionId,
            full_name: 'Migrate NF',
          })
      ).body;

      await request(server)
        .post(`/api/guests/${guest.id}/migrate`)
        .set('Authorization', auth())
        .send({ targetGroupId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('unsets is_group_contact when migrating group contact', async () => {
      const destGroup = (
        await request(server)
          .post('/api/guest-groups')
          .set('Authorization', auth())
          .send({ group_code: `GRP-MGD-${Date.now()}`, region_id: regionId })
      ).body;

      const guest = (
        await request(server)
          .post('/api/guests')
          .set('Authorization', auth())
          .send({
            guest_code: `G-CONTACT-${Date.now()}`,
            group_id: groupId,
            region_id: regionId,
            full_name: 'Contact Guest',
            is_group_contact: true,
          })
      ).body;

      await request(server)
        .post(`/api/guests/${guest.id}/migrate`)
        .set('Authorization', auth())
        .send({ targetGroupId: destGroup.id })
        .expect(200);

      const updated = (
        await request(server)
          .get(`/api/guests/${guest.id}`)
          .set('Authorization', auth())
      ).body;
      expect(updated.is_group_contact).toBe(false);
    });
  });

  describe('Import parse - validation branches', () => {
    it('flags rows with invalid status value', async () => {
      const file = buildExcelBuffer([
        {
          guest_code: 'G-BADSTATUS',
          group_code: 'GRP-001',
          full_name: 'Bad Status',
          status: 'invalid_status',
        },
      ]);
      const res = await request(server)
        .post('/api/guests/import/parse')
        .set('Authorization', auth())
        .attach('file', file, 'guests.xlsx')
        .expect(200);
      const hasError = res.body.errors.some(
        (e: { guest_code: string }) => e.guest_code === 'G-BADSTATUS',
      );
      expect(hasError).toBe(true);
    });

    it('flags rows with duplicate guest_code within the file', async () => {
      const file = buildExcelBuffer([
        { guest_code: 'G-DUP-FILE', group_code: 'GRP-001', full_name: 'First' },
        {
          guest_code: 'G-DUP-FILE',
          group_code: 'GRP-001',
          full_name: 'Duplicate',
        },
      ]);
      const res = await request(server)
        .post('/api/guests/import/parse')
        .set('Authorization', auth())
        .attach('file', file, 'guests.xlsx')
        .expect(200);
      expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
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
            email: `coord-guests-${Date.now()}@test.local`,
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

    it('region_admin can list guests in their region', async () => {
      const res = await request(server)
        .get(`/api/guests?regionId=${regionId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('region_admin gets 403 accessing a region they do not coordinate', async () => {
      const other = (
        await request(server)
          .post('/api/regions')
          .set('Authorization', auth())
          .send({ name: `Other Coord Region ${Date.now()}` })
      ).body;
      await request(server)
        .get(`/api/guests?regionId=${other.id}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403);
    });

    it('region_admin can export guests in their region', async () => {
      const res = await request(server)
        .get(`/api/guests/export?regionId=${regionId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    });
  });

  describe('PATCH /api/guests/:id - duplicate guest_code', () => {
    it('returns 409 when updating to an already-used guest_code', async () => {
      const g1 = (
        await request(server)
          .post('/api/guests')
          .set('Authorization', auth())
          .send({
            guest_code: `DUP-A-${Date.now()}`,
            group_id: groupId,
            region_id: regionId,
            full_name: 'A',
          })
      ).body;
      const g2 = (
        await request(server)
          .post('/api/guests')
          .set('Authorization', auth())
          .send({
            guest_code: `DUP-B-${Date.now()}`,
            group_id: groupId,
            region_id: regionId,
            full_name: 'B',
          })
      ).body;

      await request(server)
        .patch(`/api/guests/${g2.id}`)
        .set('Authorization', auth())
        .send({ guest_code: g1.guest_code })
        .expect(409);
    });
  });

  describe('guest-access missing param edge cases', () => {
    it('GET /api/guest-access/lookup with no code param returns 404', () =>
      request(server).get('/api/guest-access/lookup').expect(404));

    it('PATCH /api/guest-access/submit with no code param returns 404', () =>
      request(server)
        .patch('/api/guest-access/submit')
        .send({
          full_name: 'X',
          email: 'x@x.com',
          origin_city: 'X',
          car_seats: 0,
          speaks_english: false,
          other_languages: null,
          real_arrival: '2026-07-01',
          real_arrival_time: '10:00',
          real_departure: '2026-07-07',
          real_departure_time: '18:00',
          hosting_address: 'X',
          lat: null,
          lng: null,
          transport_mode: 'Coche',
          arrival_other_transport: null,
          arrival_flight: null,
          needs_airport_transfer: false,
          terms_accepted: true,
          terms_version: '1.0',
        })
        .expect(404));

    it('GET /api/guest-access/me with no token param returns 401', () =>
      request(server).get('/api/guest-access/me').expect(401));
  });
});
