import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as XLSX from 'xlsx';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import request from 'supertest';
import { AppModule } from '../src/app.module';

export const TEST_ADMIN = { email: 'admin@test.local', password: 'testpass123' };

export async function createTestApp(): Promise<INestApplication> {
  // Each call gets a unique temp DB file so concurrent/sequential specs don't share state
  const dbPath = path.join(os.tmpdir(), `roller-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

  process.env['NODE_ENV'] = 'development';
  process.env['DATABASE_PATH'] = dbPath;
  process.env['JWT_SECRET'] = 'test-jwt-secret-long-enough-for-hs256';
  process.env['JWT_EXPIRES_IN'] = '1h';
  process.env['ADMIN_EMAIL'] = TEST_ADMIN.email;
  process.env['ADMIN_PASSWORD'] = TEST_ADMIN.password;
  process.env['CLIENT_URL'] = 'http://localhost:4300';

  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  // Clean up the temp DB file when the app closes
  const originalClose = app.close.bind(app);
  app.close = async () => {
    await originalClose();
    fs.rmSync(dbPath, { force: true });
  };

  return app;
}

export async function loginAdmin(server: ReturnType<INestApplication['getHttpServer']>): Promise<string> {
  const res = await request(server)
    .post('/api/auth/login')
    .send(TEST_ADMIN)
    .expect(200);
  return res.body.access_token as string;
}

export function buildExcelBuffer(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Invitados');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
