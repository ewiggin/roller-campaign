import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { DataSource } from 'typeorm';
import morgan from 'morgan';
import { AppModule } from './app.module';

const RESET = '\x1b[0m';
const DIM   = '\x1b[2m';
const BOLD  = '\x1b[1m';
const c = {
  green:   (s: string) => `\x1b[32m${s}${RESET}`,
  yellow:  (s: string) => `\x1b[33m${s}${RESET}`,
  red:     (s: string) => `\x1b[31m${s}${RESET}`,
  cyan:    (s: string) => `\x1b[36m${s}${RESET}`,
  magenta: (s: string) => `\x1b[35m${s}${RESET}`,
  dim:     (s: string) => `${DIM}${s}${RESET}`,
  bold:    (s: string) => `${BOLD}${s}${RESET}`,
};

function colorStatus(status: number): string {
  const s = String(status);
  if (status < 300) return c.green(s);
  if (status < 400) return c.cyan(s);
  if (status < 500) return c.yellow(s);
  return c.red(s);
}

function colorMethod(method: string): string {
  const pad = method.padEnd(7);
  switch (method) {
    case 'GET':    return c.green(pad);
    case 'POST':   return c.cyan(pad);
    case 'PATCH':  return c.yellow(pad);
    case 'PUT':    return c.yellow(pad);
    case 'DELETE': return c.red(pad);
    default:       return c.dim(pad);
  }
}

morgan.token('method-colored', (req) => colorMethod(req.method ?? 'GET'));
morgan.token('status-colored', (_req, res) => colorStatus(res.statusCode));
morgan.token('response-time-colored', (req) => {
  const start: [number, number] | undefined = (req as any)._startAt;
  if (!start) return c.dim('  ?ms');
  const diff = process.hrtime(start);
  const t = diff[0] * 1e3 + diff[1] / 1e6;
  const s = `${t.toFixed(0)}ms`.padStart(6);
  if (t < 100)  return c.green(s);
  if (t < 500)  return c.yellow(s);
  return c.red(s);
});
morgan.token('url-trimmed', (req) => {
  const url = req.url ?? '';
  return url.length > 60 ? url.slice(0, 57) + '…' : url;
});
morgan.token('origin-colored', (req) => {
  const origin = req.headers.origin;
  return origin ? c.magenta(origin) : c.dim('-');
});
morgan.token('ip', (req) => {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]) ?? req.socket.remoteAddress ?? '-';
  return c.cyan(ip.trim());
});
morgan.token('user-colored', (req) => {
  const raw = req.headers.authorization?.split(' ')[1];
  if (!raw) return c.dim('anon');
  try {
    const payload = JSON.parse(Buffer.from(raw.split('.')[1], 'base64url').toString()) as { role?: string; email?: string };
    return c.bold(`${payload.role ?? '?'}`) + c.dim(`:${payload.email ?? '?'}`);
  } catch {
    return c.dim('anon');
  }
});

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const fmt = `${c.dim(':date[iso]')}  :method-colored :url-trimmed ${c.dim('→')} :status-colored :response-time-colored ${c.dim(':res[content-length] bytes')}  :ip  :user-colored  :origin-colored`;
  app.use(morgan(fmt));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  if (process.env.NODE_ENV === 'production') {
    const dataSource = app.get(DataSource);
    const pending = await dataSource.showMigrations();
    if (pending) {
      logger.log('Running pending migrations…');
      const ran = await dataSource.runMigrations({ transaction: 'each' });
      logger.log(`Migrations executed: ${ran.map((m) => m.name).join(', ') || 'none'}`);
    } else {
      logger.log('No pending migrations.');
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Roller Campaign API')
      .setDescription('API para la gestión de la campaña de predicación')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Application running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();
