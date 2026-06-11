# roller-desktop

App de escritorio **offline** de Roller Admin para Windows (`.msi`), macOS (`.dmg`) y Linux (`.AppImage`). Empaqueta en un único instalador:

- el frontend de `roller-admin` en un WebView nativo (Tauri v2),
- el backend de `roller-backend` compilado como **binario sidecar** autocontenido (Node 22 embebido),
- una base de datos **SQLite local** en el directorio de datos del usuario.

No requiere internet, Node, ni ninguna otra dependencia en la máquina del usuario final.

## Cómo funciona

```
┌─────────────────────────── Roller Admin.app ───────────────────────────┐
│                                                                         │
│  main.rs (shell Tauri)                                                  │
│   │ 1. spawn sidecar con env:                                           │
│   │      ROLLER_DESKTOP=1  DATABASE_PATH=<app_data_dir>/roller.db       │
│   │      JWT_SECRET=<generado y persistido>  ADMIN_EMAIL  ADMIN_PASSWORD│
│   ▼                                                                     │
│  roller-backend (sidecar)                                               │
│   │ 2. escucha en 127.0.0.1 con PORT=0 (puerto libre elegido por el SO) │
│   │ 3. imprime "ROLLER_API_PORT=54321" por stdout                       │
│   ▼                                                                     │
│  main.rs                                                                │
│   │ 4. lee el puerto y SOLO ENTONCES crea la ventana, inyectando        │
│   │    window.__ROLLER_API_PORT__ vía initialization_script             │
│   ▼                                                                     │
│  WebView (Angular, build "desktop")                                     │
│        5. environment.desktop.ts lee el global y construye              │
│           apiUrl = http://127.0.0.1:<puerto>/api                        │
└─────────────────────────────────────────────────────────────────────────┘
```

Al cerrar la ventana (o salir con Cmd+Q / `app.exit()`), el shell mata el proceso sidecar. Si el sidecar muere antes de anunciar puerto, la app aborta en lugar de mostrar una ventana en blanco.

El orden estricto **puerto primero, ventana después** elimina la carrera entre el arranque de Angular y la disponibilidad de la API: el global existe siempre antes de que se evalúe el primer módulo del frontend.

## Datos del usuario

| SO | Ubicación |
| --- | --- |
| macOS | `~/Library/Application Support/software.meps.roller/` |
| Windows | `%APPDATA%\software.meps.roller\` |
| Linux | `~/.local/share/software.meps.roller/` |

Contenido:

- `roller.db` — base de datos SQLite (el esquema se crea/actualiza solo con `synchronize`)
- `jwt.secret` — secreto JWT generado en el primer arranque y persistido (las sesiones sobreviven reinicios)
- `files/` — imágenes y archivos subidos (driver de storage local; en cloud van a S3)

Borrar la carpeta = reset de fábrica de la app. Copiarla = backup completo (datos + archivos).

## Credenciales

El superadmin de la app de escritorio por defecto es `admin@roller.local` / `roller-admin`. Se pueden sobreescribir **en tiempo de compilación** exportando `ROLLER_ADMIN_EMAIL` y `ROLLER_ADMIN_PASSWORD` antes de `npm run build` (se inyectan al binario Rust vía `option_env!`). La API solo escucha en loopback, pero si el instalador va a distribuirse, cambia las credenciales al compilar.

## Desarrollo

Requisitos: Node 22, Rust estable y los prerequisitos de Tauri v2 de tu SO (ver `CONTRIBUTING.md` en la raíz).

```bash
# 1. compilar el sidecar de TU plataforma (obligatorio antes del primer build)
cd ../roller-backend && npm run build:sidecar
# → deposita roller-desktop/src-tauri/binaries/roller-backend-<target-triple>

# 2. dependencias del shell
cd ../roller-desktop && npm install

# desarrollo: Angular dev-server en :4201 + sidecar + ventana con hot-reload
npm run dev

# instalador release de tu plataforma
npm run build
# → src-tauri/target/release/bundle/{dmg|msi|appimage}/
```

El pipeline del sidecar es `nest build` → `@vercel/ncc` (un solo .js) → `@yao-pkg/pkg` (ejecutable con Node 22 embebido); vive en `roller-backend/scripts/build-sidecar.mjs`. Recompílalo cada vez que cambies el backend.

## Estructura

```
roller-desktop/
├── package.json              # scripts: dev / build / build:sidecar
└── src-tauri/
    ├── tauri.conf.json       # identifier software.meps.roller; targets msi/dmg/appimage;
    │                         #   externalBin binaries/roller-backend; app.windows VACÍO (ver gotchas)
    ├── capabilities/         # permisos del WebView (core + sidecar; sin filesystem)
    ├── binaries/             # sidecars compilados (gitignored, ~73 MB cada uno)
    ├── icons/                # generados con `tauri icon` desde el logo del evento
    └── src/main.rs           # ciclo de vida completo del sidecar
```

## Gotchas — leer antes de tocar

- **`app.windows` en `tauri.conf.json` debe seguir vacío.** La ventana se crea desde Rust tras conocer el puerto; si la declaras en el config, Angular puede arrancar antes de que `window.__ROLLER_API_PORT__` exista.
- **`127.0.0.1`, nunca `localhost`**, en cualquier URL hacia el sidecar: solo escucha en IPv4 loopback y `localhost` puede resolver a `::1`.
- **No hay cross-compile del sidecar**: better-sqlite3 es un módulo nativo; cada plataforma compila el suyo en su propia máquina (en CI, un runner por SO).
- **Nombres con target triple**: `externalBin` busca `binaries/roller-backend-<triple>` (p. ej. `-aarch64-apple-darwin`, `-x86_64-pc-windows-msvc.exe`). El script del sidecar ya los genera así. Dentro del bundle final Tauri elimina el sufijo — es normal ver `roller-backend` a secas en la app instalada.
- **Bases de rutas distintas en `tauri.conf.json`**: `beforeBuildCommand`/`beforeDevCommand` se ejecutan desde `roller-desktop/`, pero `frontendDist` se resuelve desde `src-tauri/`. Por eso uno lleva `../roller-admin` y el otro `../../roller-admin`.
- **El stdout del sidecar se drena siempre** (task async en `main.rs`): si dejas de leer el pipe, en cuanto el buffer se llene Node se bloquea y la API se congela. No quites ese bucle.
- En el bundle no existen ficheros sueltos: el backend no puede usar globs sobre `__dirname` ni `readFileSync(process.cwd())`. Por eso usa `autoLoadEntities` e imports estáticos. El paquete `bcrypt` (nativo) está vetado — su loader colisiona tras el bundle; se usa `bcryptjs`.
- El backend desktop corre con `NODE_ENV=development`: SQLite + `synchronize: true` (sin migraciones) y Swagger disponible en `http://127.0.0.1:<puerto>/docs` mientras la app está abierta — útil para depurar.

## Solución de problemas

- **"failed to bundle" / no encuentra el binario** → falta el sidecar de tu plataforma: `cd ../roller-backend && npm run build:sidecar`.
- **La app no abre ventana** → lánzala desde terminal para ver los logs (líneas `[sidecar]`); lo habitual es que el sidecar haya muerto al arrancar (el motivo sale en stderr).
- **macOS bloquea la app** ("no se puede verificar el desarrollador") → el instalador no está firmado/notarizado: clic derecho → Abrir la primera vez.
- **Login falla en la app instalada** → las credenciales son las del escritorio (`admin@roller.local` / `roller-admin` por defecto), no las del `.env` del backend de desarrollo.

## CI

`.github/workflows/desktop-release.yml` (raíz del monorepo) genera los 3-4 instaladores en paralelo y publica una GitHub Release al pushear un tag `desktop-v*`. **Inactivo de momento**: el proyecto aún no está en GitHub; cuando se suba, basta configurar los secrets `ROLLER_ADMIN_EMAIL` y `ROLLER_ADMIN_PASSWORD`.
