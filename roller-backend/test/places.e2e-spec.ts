import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAdmin } from './test-app';

const AUTOCOMPLETE_FIXTURE = {
  status: 'OK',
  predictions: [
    { place_id: 'place-1', description: 'Calle Mayor, Madrid, Spain' },
    { place_id: 'place-2', description: 'Calle Mayor 5, Madrid, Spain' },
  ],
};

const DETAILS_FIXTURE = {
  status: 'OK',
  result: {
    formatted_address: 'Calle Mayor, Madrid, Spain',
    geometry: { location: { lat: 40.4168, lng: -3.7038 } },
  },
};

describe('Places (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env['GOOGLE_MAPS_API_KEY'] = 'test-key';
    app = await createTestApp();
    server = app.getHttpServer();
    adminToken = await loginAdmin(server);
  });

  afterAll(() => app.close());

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(AUTOCOMPLETE_FIXTURE),
    } as Response);
  });

  afterEach(() => fetchSpy.mockRestore());

  const auth = () => `Bearer ${adminToken}`;

  // ── autocomplete ─────────────────────────────────────────────────────────

  describe('GET /api/places/autocomplete', () => {
    it('requires auth', async () => {
      await request(server)
        .get('/api/places/autocomplete')
        .query({ input: 'Madrid' })
        .expect(401);
    });

    it('requires input param', async () => {
      await request(server)
        .get('/api/places/autocomplete')
        .set('Authorization', auth())
        .expect(400);
    });

    it('returns predictions from Google', async () => {
      const res = await request(server)
        .get('/api/places/autocomplete')
        .set('Authorization', auth())
        .query({ input: 'Calle Mayor' })
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({
        place_id: 'place-1',
        description: 'Calle Mayor, Madrid, Spain',
      });
    });

    it('returns empty array on ZERO_RESULTS', async () => {
      fetchSpy.mockResolvedValue({
        json: () =>
          Promise.resolve({ status: 'ZERO_RESULTS', predictions: [] }),
      } as Response);

      const res = await request(server)
        .get('/api/places/autocomplete')
        .set('Authorization', auth())
        .query({ input: 'xyzzy12345' })
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns empty array on API error status', async () => {
      fetchSpy.mockResolvedValue({
        json: () => Promise.resolve({ status: 'REQUEST_DENIED' }),
      } as Response);

      const res = await request(server)
        .get('/api/places/autocomplete')
        .set('Authorization', auth())
        .query({ input: 'Madrid' })
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  // ── details ───────────────────────────────────────────────────────────────

  describe('GET /api/places/details', () => {
    it('requires auth', async () => {
      await request(server)
        .get('/api/places/details')
        .query({ place_id: 'place-1' })
        .expect(401);
    });

    it('requires place_id param', async () => {
      await request(server)
        .get('/api/places/details')
        .set('Authorization', auth())
        .expect(400);
    });

    it('returns address and coordinates', async () => {
      fetchSpy.mockResolvedValue({
        json: () => Promise.resolve(DETAILS_FIXTURE),
      } as Response);

      const res = await request(server)
        .get('/api/places/details')
        .set('Authorization', auth())
        .query({ place_id: 'place-1' })
        .expect(200);

      expect(res.body).toEqual({
        address: 'Calle Mayor, Madrid, Spain',
        lat: 40.4168,
        lng: -3.7038,
      });
    });

    it('returns 404 when Google returns not found', async () => {
      fetchSpy.mockResolvedValue({
        json: () => Promise.resolve({ status: 'NOT_FOUND' }),
      } as Response);

      await request(server)
        .get('/api/places/details')
        .set('Authorization', auth())
        .query({ place_id: 'invalid-id' })
        .expect(404);
    });
  });
});
