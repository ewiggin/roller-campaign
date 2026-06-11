# roller-admin

Backoffice SPA for superadmins and region coordinators of the Roller Campaign platform.

## Stack

| Layer | Technology |
|---|---|
| Framework | Angular 21 (standalone components, signals) |
| Styling | Tailwind CSS v4 (CSS-native config) |
| Auth | JWT stored in `localStorage`, auto-logout on 401 |
| Build | Angular CLI + esbuild |

## Features

- Region management (dates, coordinators, Excel import/export)
- Guest group and guest tracking (pagination, filters, group migration)
- Host management with group suggestions
- Volunteer management with calendar availability
- Activity shifts and volunteer assignment
- Dark mode (persisted in `localStorage`, respects `prefers-color-scheme`)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Run

```bash
npm start
```

Open `http://localhost:4200`. API calls are proxied to `http://localhost:3000` — the backend must be running.

## Scripts

| Script | Action |
|---|---|
| `npm start` | Development server (`localhost:4200`) |
| `npm run build` | Production build → `dist/` |
| `npm run build:staging` | Staging build |
| `npm run build:production` | Production build with production environment |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |

## Environments

| Environment | API URL |
|---|---|
| Development | `http://localhost:3000/api` (proxy) |
| Staging | `https://roller-api-staging.up.railway.app/api` |
| Production | `https://roller-api-production.up.railway.app/api` |

Environment files are located in `src/environments/`.

## Project structure

```
src/app/
├── core/
│   ├── guards/        # Auth guard
│   ├── interceptors/  # API URL rewrite, Bearer token injection, 401 handling
│   ├── models/        # TypeScript interfaces per entity
│   └── services/      # Business logic and API access
├── shared/
│   └── components/    # Reusable UI components (skeleton loader, etc.)
└── features/
    ├── login/
    └── admin/
        ├── layout/    # Header with dark mode toggle and logout
        ├── dashboard/
        ├── regions/
        ├── users/
        ├── hosts/
        ├── guest-groups/
        ├── guests/
        └── activities/
```
