# Guía de configuración para desarrollo

Cómo dejar funcionando el entorno de desarrollo completo de Roller Campaign en una máquina nueva.

## Visión general

```
roller-campaign/
├── roller-backend/   # REST API NestJS — puerto 3000
├── roller-admin/     # Angular SPA backoffice — puerto 4201 (proxy /api → 3000)
├── roller-desktop/   # Tauri v2: app de escritorio offline (empaqueta admin + backend)
└── forms/
    ├── form-guests/     # Angular: formulario público de invitados — puerto 4200 (proxy /api → 3000)
    └── form-volunteer/  # Angular: formulario público de voluntarios (apunta a Google Sheets)
```

> `roller-client/` (PWA de invitados/voluntarios) aparece en CLAUDE.md pero **no está presente en esta copia de trabajo**; ignora las referencias hasta que se incorpore.

Cada proyecto tiene su propio `package.json`, dependencias y versión. No hay workspace raíz: `npm install` se ejecuta **dentro de cada carpeta**.

## Requisitos

| Herramienta | Versión | Notas |
| --- | --- | --- |
| Node.js | **22.x** | Obligatorio ese major: el backend usa módulos nativos (better-sqlite3) compilados contra el ABI de Node 22, y el sidecar desktop embebe Node 22. |
| npm | ≥ 10 | Incluido con Node 22. |
| Rust (estable) | última | **Solo para roller-desktop.** Instalar con rustup. |

Dependencias de sistema adicionales **solo para roller-desktop** (prerequisitos de Tauri v2):

- **macOS** — Xcode Command Line Tools (`xcode-select --install`).
- **Windows** — Microsoft C++ Build Tools (workload "Desktop development with C++") y WebView2 Runtime (preinstalado en Windows 10/11 actuales).
- **Linux** — `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf` (nombres para Debian/Ubuntu).

No hace falta instalar Angular CLI ni Nest CLI globales: todos los scripts usan los binarios locales.

## 1. Backend (primero — todo lo demás depende de él)

```bash
cd roller-backend
npm install
cp .env.example .env
```

Edita `.env` y rellena al menos:

- `JWT_SECRET` — cualquier string aleatorio largo
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credenciales del superadmin (no pasa por BD; sirven para entrar al admin)

`DATABASE_URL` se deja vacío en desarrollo: con `NODE_ENV=development` se usa SQLite (`DATABASE_PATH`, por defecto `app.db`) con `synchronize: true`, así que el esquema se crea solo. No hay que ejecutar migraciones en dev.

```bash
npm run start:dev      # API en http://localhost:3000/api con hot-reload
```

Verificación:

- `curl http://localhost:3000/api/version` → JSON con nombre y versión
- Swagger en http://localhost:3000/docs
- Tests e2e: `npm test` (no necesitan el servidor levantado; usan SQLite propio)

## 2. roller-admin

```bash
cd roller-admin
npm install
npm start              # http://localhost:4201
```

`ng serve` corre en el puerto **4201** con proxy `/api` → `http://localhost:3000` (`proxy.config.json`), así que el backend debe estar levantado. Entra con el `ADMIN_EMAIL` / `ADMIN_PASSWORD` de tu `.env`.

## 3. forms

```bash
cd forms/form-guests
npm install
npm start              # http://localhost:4200, proxy /api → 3000
```

`form-guests` necesita el backend levantado y un invitado con código de acceso en BD para probar el flujo completo (lookup → formulario → submit).

`form-volunteer` no usa el backend (envía a Google Sheets): `npm install && npm start`.

## 4. roller-desktop (opcional — solo si trabajas en la app de escritorio)

Requiere Rust y las dependencias de sistema de la tabla de requisitos. Flujo:

```bash
# 1. compilar el backend como binario sidecar (de tu plataforma)
cd roller-backend
npm run build:sidecar  # → roller-desktop/src-tauri/binaries/

# 2. dependencias del shell Tauri
cd ../roller-desktop
npm install

# 3a. desarrollo (levanta Angular en :4201 + sidecar + ventana nativa)
npm run dev

# 3b. instalador de tu plataforma
npm run build          # → src-tauri/target/release/bundle/
```

Detalles de arquitectura, credenciales y gotchas: **`roller-desktop/README.md`**.

## Convenciones

Las convenciones de código (Prettier por proyecto, versionado de `package.json`, migraciones obligatorias al tocar entidades, anotación Swagger completa, Angular standalone + signals, naming en inglés) están en **`CLAUDE.md`** en la raíz — léelo antes del primer commit. Resumen mínimo:

- Tras tocar código: `npm run format` en el proyecto afectado.
- Si modificas una entidad TypeORM: migración nueva en el mismo cambio (`src/migrations/`, prefijo timestamp); en dev no la notarás (synchronize), en producción sin ella el deploy rompe.
- Sube la versión del `package.json` del proyecto que cambies.

## Puertos en desarrollo

| Servicio | Puerto |
| --- | --- |
| roller-backend | 3000 |
| roller-admin | 4201 |
| form-guests | 4200 |
| sidecar desktop | dinámico (lo elige el SO; solo en la app empaquetada) |
