# Roller Campaign — Monorepo

Aplicación para gestionar voluntarios e invitados de una campaña especial de predicación distribuida en múltiples regiones geográficas.

```
roller-campaign/
├── roller-backend/   # REST API NestJS
├── roller-admin/     # Angular SPA: backoffice para admins y coordinadores
├── roller-client/    # Angular PWA: app para invitados y voluntarios
├── roller-desktop/   # Tauri v2: bundle desktop offline (roller-admin + backend como sidecar)
└── forms/
    ├── form-guests/     # Angular: formulario público de invitados
    └── form-volunteer/  # Angular: formulario público de voluntarios
```

---

## Formato

Después de escribir o modificar código, ejecuta siempre el formateador del proyecto afectado:

```bash
# backend
cd roller-backend && npm run format

# roller-admin
cd roller-admin && npm run format
```

Ambos usan Prettier. El script `format` está definido en cada `package.json`.

---

## Versiones

Cada vez que hagas cambios determina qué versión hay que aplicar a los `package.json` de proyectos según los cambios de cada proyecto. No hay que sincronizar versiones entre proyectos.

---

## backend

### Stack

- **NestJS 11** — strict mode, Node 22
- **TypeORM** — SQLite (`better-sqlite3`) en dev, PostgreSQL en producción
- **Passport + JWT** — autenticación, tokens 6h
- **Swagger** — spec disponible en `/docs` (desactivado en `NODE_ENV=production`)
- **class-validator / class-transformer** — validación global con `whitelist: true, transform: true`
- **Morgan** — logging HTTP coloreado (método, status, tiempo de respuesta)
- **@nestjs/cache-manager** — caché in-memory; invalidar con `cache.clear()` en cualquier escritura
- Prefijo global: `/api`

### Módulos implementados

| Módulo         | Responsabilidad                                                                 |
| -------------- | ------------------------------------------------------------------------------- |
| `auth`         | Login email+password, JWT, superadmin desde .env sin BD, token de invitado     |
| `users`        | CRUD de cuentas (solo superadmin)                                               |
| `regions`      | CRUD de regiones, fechas del evento, coordinadores, import/export Excel         |
| `guest-groups` | CRUD de grupos, contador de invitados, import Excel (auto-detecta region_name)  |
| `guests`       | CRUD, paginación, filtros, migración entre grupos, import/export Excel, token   |
| `hosts`        | CRUD de anfitriones, sugerencias de grupos, import/export Excel                 |
| `volunteers`   | CRUD, disponibilidad en calendario, import Excel                                |
| `activities`   | CRUD de turnos por región, asignación de voluntarios                            |

### Estructura de módulos

```
src/
├── auth/
│   ├── decorators/   current-user.decorator.ts, roles.decorator.ts
│   ├── guards/       jwt-auth.guard.ts, local-auth.guard.ts, roles.guard.ts
│   ├── strategies/   jwt.strategy.ts, local.strategy.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   └── auth.service.ts
├── [modulo]/
│   ├── dto/
│   ├── entities/
│   ├── [modulo].controller.ts
│   ├── [modulo].module.ts
│   └── [modulo].service.ts
├── app.module.ts
└── main.ts
```

### Entidades base

| Entidad | Tabla   | Campos clave                                          |
| ------- | ------- | ----------------------------------------------------- |
| `User`  | `users` | uuid, email (unique), password (bcrypt), role         |

`UserRole`: `'superadmin' | 'region_admin' | 'volunteer' | 'guest'`

### Auth

- `POST /api/auth/login` — body `{ email, password }` → `{ access_token }`
- Credenciales de superadmin por `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) sin pasar por BD
- Usuarios de BD: password hasheado con bcrypt (10 rounds)
- JWT payload: `{ sub: id, email, role }`

Proteger un endpoint:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')    // omitir si cualquier usuario autenticado puede acceder
@ApiBearerAuth()
```

Guards y decoradores exportados desde `AuthModule` — importar el módulo, no los guards directamente.

### Endpoints públicos (sin auth)

- `GET /api/guest-access/lookup?code=X` — lookup invitado por código
- `PATCH /api/guest-access/submit?code=X` — envío formulario de invitado
- `PUT/GET /api/storage/files?key=X&token=Y` — subida/descarga del driver de storage local; el `token` efímero firmado (emitido por los endpoints presign) es la credencial, imitando la semántica de URLs prefirmadas de S3

### Storage (imágenes y archivos)

`StorageService` tiene dos drivers tras el mismo contrato presign (el frontend trata las URLs como opacas):

- **S3** — activo cuando `RAILWAY_BUCKET_NAME` está definido (producción Railway).
- **Disco local** — activo en caso contrario (desktop y dev sin bucket): los presign devuelven URLs hacia la propia API y los archivos viven en `STORAGE_PATH` o, por defecto, en `files/` junto al SQLite (`DATABASE_PATH`).

Al añadir consumo de archivos nuevo, usar siempre los endpoints presign — nunca asumir S3 ni rutas de disco.

### Migraciones (obligatorio)

- Cada vez que modifiques una entidad TypeORM **crea la migración en el mismo commit**. Sin migración, el deploy rompe producción.
- Las migraciones se ubican en `src/migrations/` con timestamp Unix como prefijo (`Date.now()` al crearlas).
- TypeORM usa el glob `migrations/*{.ts,.js}` — no hay que registrarlas manualmente.
- **Nunca modifiques una migración que ya se ejecutó en producción.** TypeORM la marca como ejecutada en la tabla `migrations` y no la vuelve a correr. Crea siempre una migración nueva con timestamp más alto.
- Usa `ADD COLUMN IF NOT EXISTS` y `DROP COLUMN IF EXISTS` para que las migraciones sean idempotentes.
- Al renombrar columnas, comprueba primero si el nombre antiguo existe (ver patrón en `1747198000000-AddMissingActivityColumns.ts`).

### Convenciones backend

- DTOs: carpeta `dto/` dentro de cada módulo. Usar `PartialType` de `@nestjs/swagger` para updates.
- Entidades: carpeta `entities/` dentro de cada módulo.
- No exportar password: los métodos de `UsersService` devuelven `Omit<User, 'password'>`.
- Swagger: todos los controllers llevan `@ApiTags`, los endpoints protegidos `@ApiBearerAuth()`.
- Roles: `'superadmin'` para operaciones destructivas; sin guard de rol para lectura autenticada.
- Fechas: almacenadas como `varchar` (ISO string `YYYY-MM-DD`) para compatibilidad SQLite/PostgreSQL.
- Import Excel: proceso en dos pasos — parse (preview con validación) + commit (persistir).

### Especificación Swagger (obligatorio)

La spec OpenAPI se usa para generar tipos y clientes en el frontend. Todo endpoint y DTO debe estar completamente anotado.

- Todos los campos de DTO llevan `@ApiProperty` o `@ApiPropertyOptional` con `example` — el generador del frontend necesita ejemplos para inferir tipos correctamente. **Nunca usar `@ApiProperty()` sin `example`.**
- Cada endpoint declara su respuesta con `@ApiResponse` o atajos equivalentes. Para colecciones usar `{ type: [EntityDto] }`.
- Crear clases `*ResponseDto` para las respuestas — nunca exponer la entidad TypeORM directamente.

### Variables de entorno (`backend/.env`)

```
NODE_ENV=development
PORT=3000
DATABASE_PATH=app.db       # SQLite dev
DATABASE_URL=              # PostgreSQL prod
JWT_SECRET=...
JWT_EXPIRES_IN=6h
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

---

## roller-admin

### Stack

- **Angular 21** — standalone components, signals, lazy loading
- **Tailwind CSS v4** — configuración CSS-nativa (ver abajo)
- Puerto dev: `4200`, proxy `/api` → `http://localhost:3000`

### Tailwind v4

No hay `tailwind.config.js`. La configuración está en `src/tailwind.css`:

```css
@import "tailwindcss";

@source "./app/**/*.html";
@source "./app/**/*.ts";

@variant dark (&:where(.dark, .dark *));
```

PostCSS en `postcss.config.json`:

```json
{ "plugins": { "@tailwindcss/postcss": {} } }
```

Los overrides de dark mode van en `styles.scss` (bloque `.dark { }`) — **no añadir clases `dark:` en templates** salvo excepciones muy justificadas.

### Estructura

```
src/app/
├── core/
│   ├── guards/        auth.guard.ts
│   ├── interceptors/  api-url.interceptor.ts, auth.interceptor.ts
│   ├── models/        *.model.ts (interfaces TypeScript por entidad)
│   └── services/      *.service.ts (lógica de negocio y acceso a API)
├── shared/
│   └── components/
│       └── skeleton/  skeleton.ts
└── features/
    ├── login/         login.ts
    └── admin/
        ├── layout/    layout.ts  (header con toggle dark mode + "Salir")
        ├── dashboard/
        ├── regions/
        ├── users/
        ├── hosts/
        ├── guest-groups/
        ├── guests/
        └── activities/
```

### Rutas del admin

| Ruta                  | Guard      | Componente               |
| --------------------- | ---------- | ------------------------ |
| `/login`              | —          | `LoginComponent`         |
| `/admin`              | `authGuard`| `AdminLayoutComponent`   |
| `/admin/dashboard`    | heredado   | `DashboardComponent`     |
| `/admin/regions`      | heredado   | `RegionsListComponent`   |
| `/admin/users`        | heredado   | `UsersListComponent`     |
| `/admin/hosts`        | heredado   | `HostsListComponent`     |
| `/admin/hosts/:id`    | heredado   | `HostDetailComponent`    |
| `/admin/guest-groups` | heredado   | `GuestGroupsListComponent`|
| `/admin/guests`       | heredado   | `GuestsListComponent`    |
| `/admin/guests/:id`   | heredado   | `GuestDetailComponent`   |
| `/admin/activities`   | heredado   | `ActivitiesListComponent`|

El `authGuard` está en `/admin`; todas las rutas hijo heredan protección.

### Interceptores

- `api-url.interceptor.ts` — convierte URLs `/api/...` a la base URL del entorno (`environment.apiUrl`)
- `auth.interceptor.ts` — añade header `Authorization: Bearer <token>` y gestiona el logout automático en 401

### Auth del admin

- JWT en `localStorage['admin_token']`
- Loading screen inicial en `app.ts`: spinner full-screen hasta que la primera navegación completa (evita flash de UI antes de que el guard redirija)

### Diseño — sistema visual

- **Tarjetas** — `rounded-xl border border-gray-200 bg-white shadow-sm`
- **Cabecera de sección** — `px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl` + título `text-sm font-semibold text-gray-700 uppercase tracking-wide`
- **Listas dentro de tarjeta** — `divide-y divide-gray-100`, fila `px-5 py-4 hover:bg-gray-50`
- **Badge de estado** — `rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1` con variantes de color
- **Botón primario** — `rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600`
- **Botón secundario / icono** — `p-1.5 rounded-md text-gray-400 hover:text-{color}-500 hover:bg-{color}-50 transition-colors`
- **Inputs** — `rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400`; `font-size: max(16px, 1em)` global en `styles.scss` para evitar zoom en iOS Safari
- **Botones de cabecera** (patrón consistente): Export Excel (↓), Template (doc), Import Excel (↑), New (＋) — todos con iconos SVG Heroicons outline y `inline-flex items-center gap-1.5`

### Dark mode

- Activado con la clase `.dark` en `<html>` — gestionado por `ThemeService`
- Toggle en el header del admin, persiste en `localStorage['theme']`
- En ausencia de preferencia guardada, respeta `prefers-color-scheme`
- Los overrides están en `styles.scss` (bloque `.dark { }`) — no añadir `dark:` en templates
- Paleta oscura base: fondo `#09090b`, tarjetas `#18181b`, elevado `#27272a`, texto `#fafafa`

---

## roller-client

### Stack

- **Angular 21** — standalone components, signals, lazy loading
- **Tailwind CSS v4** — misma configuración que roller-admin
- Angular PWA (service worker)

### Rutas del cliente

| Ruta                         | Guard            | Componente                    |
| ---------------------------- | ---------------- | ----------------------------- |
| `/access`                    | —                | `AccessComponent`             |
| `/login`                     | —                | `LoginComponent` (voluntarios)|
| `/guest/schedule`            | —                | `GuestScheduleComponent`      |
| `/guest/travel`              | —                | `GuestTravelComponent`        |
| `/guest/accommodation`       | —                | `GuestAccommodationComponent` |
| `/guest/info`                | —                | `GuestInfoComponent`          |
| `/volunteer/schedule`        | `volunteerGuard` | `VolunteerScheduleComponent`  |
| `/volunteer/availability`    | `volunteerGuard` | `VolunteerAvailabilityComponent`|
| `/volunteer/info`            | `volunteerGuard` | `VolunteerInfoComponent`      |

- `AccessComponent` — valida el token de invitado desde la query string y redirige a `/guest`
- `volunteerGuard` — verifica JWT de voluntario, redirige a `/login` si no está autenticado

---

## forms

### form-guests

Formulario público para que los invitados envíen sus datos de viaje. Apunta a `roller-backend` (no usa Google Apps Script).

**Flujo:** código → lookup (`GET /api/guest-access/lookup?code=X`) → formulario prellenado → submit (`PATCH /api/guest-access/submit?code=X`)

**Mapeo:** `plazasCoche` → `car_seats`, `necesitaTransporteAeropuerto` → `needs_airport_transfer`

### form-volunteer

Formulario público para recogida de datos de voluntarios. Actualmente apunta a Google Sheets.

---

## roller-desktop

Bundle desktop offline (Tauri v2): roller-admin en un WebView + roller-backend compilado como sidecar nativo + SQLite en `app_data_dir`.

### Arquitectura

- El sidecar se compila con `ncc` + `@yao-pkg/pkg` (targets `node22-*`; **no** usar `@vercel/pkg`/node18 — ABI incompatible con better-sqlite3).
- En modo desktop (`ROLLER_DESKTOP=1`) el backend escucha solo en `127.0.0.1`, con `PORT=0` (puerto libre del SO) y anuncia `ROLLER_API_PORT=<n>` por stdout.
- `main.rs` lanza el sidecar, espera el puerto y **solo entonces** crea la ventana, inyectando `window.__ROLLER_API_PORT__` vía `initialization_script`. `app.windows` del config debe seguir vacío.
- `environment.desktop.ts` de roller-admin lee ese global; usar siempre `127.0.0.1`, nunca `localhost`.
- Env que Rust inyecta al sidecar: `ROLLER_DESKTOP`, `DATABASE_PATH`, `JWT_SECRET` (generado y persistido en `jwt.secret`), `ADMIN_EMAIL`/`ADMIN_PASSWORD` (defaults `admin@roller.local`/`roller-admin`, sobreescribibles en compile-time con `ROLLER_ADMIN_EMAIL`/`ROLLER_ADMIN_PASSWORD`).

### Comandos

```bash
# 1. compilar el sidecar del host → roller-desktop/src-tauri/binaries/
cd roller-backend && npm run build:sidecar

# 2. instalador local (release)
cd roller-desktop && npm run build

# desarrollo (Angular en :4201 + sidecar)
cd roller-desktop && npm run dev
```

### Gotchas

- **No hay cross-compile**: better-sqlite3 es nativo; cada plataforma compila su sidecar en su propio runner (CI: `.github/workflows/desktop-release.yml`, se dispara con tags `desktop-v*`).
- `externalBin` exige que exista `binaries/roller-backend-<triple-del-host>` antes de `tauri build`.
- `beforeBuildCommand`/`beforeDevCommand` corren desde `roller-desktop/`; `frontendDist` es relativo a `src-tauri/` (por eso un path lleva `../` y el otro `../../`).
- El backend no debe usar globs sobre `__dirname` ni `readFileSync(cwd)` — dentro del bundle no existen; usar `autoLoadEntities` e imports estáticos.
- No usar el paquete `bcrypt` (nativo, su loader colisiona en el bundle): el proyecto usa `bcryptjs`.

---

## Entornos (todos los frontends)

Todos tienen `environment.ts` (dev), `environment.staging.ts`, `environment.production.ts` y scripts `build:staging` / `build:production`.

| App            | Dev URL                     | Staging URL                               | Prod URL                                    |
| -------------- | --------------------------- | ----------------------------------------- | ------------------------------------------- |
| roller-admin   | `http://localhost:3000/api` | `roller-api-staging.up.railway.app/api`   | `roller-api-production.up.railway.app/api`  |
| roller-client  | `http://localhost:3000`     | `roller-api-staging.up.railway.app`       | `roller-api-production.up.railway.app`      |
| form-guests    | `/api` (proxy)              | `roller-api-staging.up.railway.app/api`   | `roller-api-production.up.railway.app/api`  |

---

## Convenciones Angular (todos los frontends)

- Standalone components en todos los archivos (no NgModules)
- Signals para estado local (`signal()`, `computed()`) — no RxJS para estado de componente
- `inject()` en vez de constructor DI
- `input()` para inputs de componente
- Lazy loading en todas las rutas (`loadComponent: () => import(...)`)
- **Nombres de archivo sin sufijo `.component`** — `feature-list.ts`, no `feature-list.component.ts`
- Un `.html` por componente — no templates inline salvo componentes de una línea
- Formatear código según las reglas de Prettier

---

## Cuando acabes de implementar un módulo del spec

Haz los tests pertinentes.
