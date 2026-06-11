# roller-backend

REST API for the Roller Campaign platform — volunteer and guest management across multiple geographic regions.

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (strict mode, Node 22) |
| Database | SQLite (`better-sqlite3`) in dev · PostgreSQL in production |
| ORM | TypeORM with migration support |
| Auth | Passport + JWT (6 h tokens) |
| Validation | class-validator / class-transformer (global whitelist pipeline) |
| API Docs | Swagger (`/docs`, disabled in production) |
| Logging | Morgan (colorized method, status, response time, IP, user, origin) |

## Modules

| Module | Responsibility |
|---|---|
| `auth` | Email + password login, JWT, env-based superadmin, guest tokens |
| `users` | User account CRUD (superadmin only) |
| `regions` | Regions, event dates, coordinators, Excel import/export |
| `guest-groups` | Groups, guest counters, Excel import |
| `guests` | CRUD, pagination, filters, group migration, Excel import/export |
| `hosts` | Hosts, group suggestions, Excel import/export |
| `volunteers` | CRUD, calendar availability, Excel import |
| `activities` | Shifts per region, volunteer assignment |

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` \| `production` |
| `PORT` | HTTP port (default `3000`) |
| `DATABASE_PATH` | SQLite file path (dev only) |
| `DATABASE_URL` | PostgreSQL connection string (production) |
| `JWT_SECRET` | Secret key for signing tokens |
| `JWT_EXPIRES_IN` | Token TTL (e.g. `6h`) |
| `ADMIN_EMAIL` | Superadmin email (no database record needed) |
| `ADMIN_PASSWORD` | Superadmin password |

### 3. Run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build && npm run start:prod
```

The API is available at `http://localhost:3000/api`.  
Swagger UI is available at `http://localhost:3000/docs` (development only).

## Scripts

| Script | Action |
|---|---|
| `npm run start:dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled build |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:cov` | Test coverage report |

## Authentication

All protected endpoints require a Bearer token obtained from `POST /api/auth/login`.

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "secret" }
```

Response: `{ "access_token": "<jwt>" }`

Public endpoints (no token required):

- `GET /api/guest-access/lookup?code=X`
- `PATCH /api/guest-access/submit?code=X`

## Deployment

In production the API runs against PostgreSQL and automatically applies pending TypeORM migrations on startup. Set `NODE_ENV=production` and `DATABASE_URL` before starting.
