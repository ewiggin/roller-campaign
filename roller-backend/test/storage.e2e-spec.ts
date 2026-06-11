import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { binaryParser, createTestApp, loginAdmin } from './test-app';

/** Strips the absolute base URL a presigned local URL carries. */
function toServerPath(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
}

describe('Storage local driver (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let token: string;
  let storageDir: string;

  const PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);

  beforeAll(async () => {
    storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roller-storage-'));
    process.env['STORAGE_PATH'] = storageDir;
    // The dev .env may carry real bucket credentials; an empty value wins over
    // the .env file (dotenv never overrides existing vars) and forces the
    // local-disk driver, which is what this suite exercises.
    process.env['RAILWAY_BUCKET_NAME'] = '';
    app = await createTestApp();
    server = app.getHttpServer();
    token = await loginAdmin(server);
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(storageDir, { recursive: true, force: true });
    delete process.env['STORAGE_PATH'];
  });

  const presignUpload = (key: string, expiresIn?: number) =>
    request(server)
      .post('/api/storage/presign/upload')
      .set('Authorization', `Bearer ${token}`)
      .send({ key, contentType: 'image/png', ...(expiresIn && { expiresIn }) });

  const presignDownload = (key: string) =>
    request(server)
      .get('/api/storage/presign/download')
      .set('Authorization', `Bearer ${token}`)
      .query({ key });

  describe('presign endpoints', () => {
    it('require auth', async () => {
      await request(server)
        .post('/api/storage/presign/upload')
        .send({ key: 'a.png', contentType: 'image/png' })
        .expect(401);
      await request(server)
        .get('/api/storage/presign/download')
        .query({ key: 'a.png' })
        .expect(401);
    });

    it('return URLs pointing at the local files endpoint', async () => {
      const res = await presignUpload('activities/test.png').expect(201);
      expect(res.body.url).toContain('/api/storage/files?key=');
      expect(res.body.url).toContain('token=');
      expect(res.body.key).toBe('activities/test.png');
    });

    it('reject traversal keys before signing', async () => {
      await presignUpload('../evil.png').expect(400);
      await presignUpload('a/../../evil.png').expect(400);
      await presignUpload('/etc/passwd').expect(400);
    });
  });

  describe('upload + download roundtrip', () => {
    const key = 'activities/roundtrip.png';

    it('stores and serves the exact bytes with the right content type', async () => {
      const up = await presignUpload(key).expect(201);
      const putRes = await request(server)
        .put(toServerPath(up.body.url))
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(200);
      expect(putRes.body).toEqual({ key, size: PNG.length });

      const down = await presignDownload(key).expect(200);
      const file = await request(server)
        .get(toServerPath(down.body.url))
        .buffer()
        .parse(binaryParser)
        .expect(200);
      expect(Buffer.compare(file.body as Buffer, PNG)).toBe(0);
      expect(file.headers['content-type']).toContain('image/png');
    });

    it('persists the file under STORAGE_PATH', () => {
      expect(fs.existsSync(path.join(storageDir, key))).toBe(true);
    });
  });

  describe('file token enforcement', () => {
    const key = 'activities/protected.png';

    it('rejects uploads with a garbage token', () =>
      request(server)
        .put(`/api/storage/files?key=${encodeURIComponent(key)}&token=garbage`)
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(403));

    it('rejects a download token used for upload (op mismatch)', async () => {
      const down = await presignDownload(key).expect(200);
      await request(server)
        .put(toServerPath(down.body.url))
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(403);
    });

    it('rejects a token bound to a different key', async () => {
      const up = await presignUpload('activities/other.png').expect(201);
      const parsed = new URL(up.body.url);
      parsed.searchParams.set('key', key);
      await request(server)
        .put(parsed.pathname + parsed.search)
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(403);
    });

    it('rejects an expired token', async () => {
      const up = await presignUpload(key, 1).expect(201);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await request(server)
        .put(toServerPath(up.body.url))
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(403);
    });
  });

  describe('download of missing file', () => {
    it('returns 404 for a key that was never uploaded', async () => {
      const down = await presignDownload('activities/missing.png').expect(200);
      await request(server).get(toServerPath(down.body.url)).expect(404);
    });
  });
});
