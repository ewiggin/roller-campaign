[![Desktop Release](https://github.com/ewiggin/roller-campaign/actions/workflows/desktop-release.yml/badge.svg?branch=main&event=release)](https://github.com/ewiggin/roller-campaign/actions/workflows/desktop-release.yml)

# Roller Campaign

Platform for managing volunteers and guests of a special evangelism campaign
distributed across multiple geographic regions. Each region runs the event on
its own dates, with its own volunteers, guests, hosts, and activity shifts.

## Monorepo layout

```
roller-campaign/
├── roller-backend/          # NestJS 11 REST API (TypeORM, SQLite/PostgreSQL)
├── roller-admin/             # Angular 21 SPA — backoffice for admins and region coordinators
├── roller-desktop/           # Tauri v2 — offline desktop bundle (roller-admin + backend sidecar)
└── forms/
    ├── form-guests/          # Angular — public guest travel/accommodation form
    └── form-volunteer/        # Angular — public volunteer sign-up form
```

| App | Description | Docs |
| --- | --- | --- |
| [`roller-backend`](roller-backend/README.md) | REST API: regions, hosts, guest groups, guests, volunteers, activities, auth | NestJS 11 · TypeORM · SQLite (dev) / PostgreSQL (prod) |
| [`roller-admin`](roller-admin/README.md) | Backoffice SPA for superadmins and region coordinators | Angular 21 · Tailwind CSS v4 |
| [`roller-desktop`](roller-desktop/README.md) | Offline desktop installer (Windows `.msi`, macOS `.dmg`, Linux `.AppImage`) bundling `roller-admin` + `roller-backend` + local SQLite | Tauri v2 |
| [`forms/form-guests`](forms/form-guests/README.md) | Public form for guests to submit travel and accommodation details | Angular 21 |
| `forms/form-volunteer` | Public form for volunteer sign-up (currently backed by Google Sheets) | Angular 21 |

## Getting started

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full local development setup
(requirements, environment variables, run order for each app).

Quick reference once everything is configured:

```bash
# 1. Backend — required by every other app
cd roller-backend && npm install && npm run start:dev   # http://localhost:3000/api

# 2. Admin backoffice
cd roller-admin && npm install && npm start              # http://localhost:4201

# 3. Desktop app (optional, offline bundle)
cd roller-backend && npm run build:sidecar
cd roller-desktop && npm install && npm run dev
```

## Documentation

- [`SPEC.md`](SPEC.md) — domain model and feature specification
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development environment setup
- [`claude.md`](claude.md) — project conventions for AI-assisted development
