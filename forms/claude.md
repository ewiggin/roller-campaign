# Carritos se van de vacaciones — Formularios

Proyecto de formularios estáticos (sin backend propio) para el evento "Carritos se van de vacaciones". Dos formularios independientes conectados a Google Sheets via Apps Script.

## Estructura del monorepo

```
forms/
├── form-guests/      # Formulario para invitados/asistentes
└── form-volunteer/   # Formulario para voluntarios con coche
```

Cada subproyecto es una app Angular independiente con su propio `package.json`, git repo y Apps Script.

## Stack tecnológico

- **Angular 21** — standalone components, signals (no NgModules, no RxJS observables directos)
- **TailwindCSS 4** — via `@tailwindcss/postcss`
- **TypeScript 5.9**
- **Google Apps Script** — actúa como backend HTTP (doGet / doPost)
- **Google Maps JS API** — para el picker de ubicación (`@googlemaps/js-api-loader`)

## Arquitectura: comunicación con el Sheet

No hay backend propio. El flujo siempre es:

1. **GET `?codigo=XXX`** → Apps Script valida el código en la columna B del Sheet y devuelve `{ valid, fila }` (form-guests) o `{ valid, fila, nombre, formData }` (form-volunteer).
2. **POST** con JSON → Apps Script escribe en la fila del usuario. Se usa `mode: 'no-cors'` porque el Apps Script no devuelve cabeceras CORS; la respuesta es opaca y no se puede leer.
3. El servicio `GoogleSheetsService` en cada proyecto gestiona ambas llamadas y expone `isLoading` como signal.

## Subproyecto: form-guests

**Propósito:** Invitado introduce su código → valida en Sheet → rellena datos de viaje y hospedaje → guarda.

**Campos del formulario:**
- Código de invitado (valida contra columna B de la hoja "Invitados")
- Nombre completo
- Ciudad de origen
- Plazas de coche disponibles
- Habla inglés (sí/no)
- Fecha y hora de llegada real
- Fecha y hora de salida real
- Dirección del hospedaje + picker de Google Maps (lat/lng)
- Medio de transporte (con opción "Otra" libre)

**Columnas del Sheet escritas:** 31–43 (las 30 primeras ya existen y no se tocan).

**Archivos clave:**
```
src/app/components/guest-form/     # Formulario principal
src/app/components/location-picker/ # Picker reutilizable de Google Maps
src/app/services/google-sheets.service.ts
src/environments/environment.ts    # appsScriptUrl + googleMapsApiKey
apps-script/Code.gs                # Backend Apps Script (desplegar manualmente)
```

**Apps Script URL (producción):**
`https://script.google.com/macros/s/AKfycby9VOY3U3kswCIDsj73NQAKEb9qRKYhF6EG4ShgGcu65b5bcwxJVsivFx28ZcmB756K/exec`

## Subproyecto: form-volunteer

**Propósito:** Voluntario introduce su código → valida en Sheet (devuelve nombre + datos previos si ya rellenó) → rellena disponibilidad horaria y datos de coche → guarda.

**Campos del formulario:**
- Código de voluntario
- Número de plazas disponibles en el coche
- Dirección/ubicación (picker Google Maps)
- Disponibilidad: tabla lunes–domingo × mañana/tarde (14 checkboxes → 14 columnas)

**Interfaces principales:** `VolunteerFormData`, `ExistingFormData`, `ValidateResult` (en `google-sheets.service.ts`).

**Archivos clave:**
```
src/app/components/volunteer-form/
src/app/components/location-picker/  # Misma lógica que form-guests
src/app/services/google-sheets.service.ts
src/environments/environment.ts
```

**Apps Script URL (producción):**
`https://script.google.com/macros/s/AKfycbyk1VHnFwy0hC1IDm94jsf4SBfmBcocnKPeJgCUMGy_cawzOlTg6Ndht81dC-X_/exec`

## Comandos habituales

Desde la carpeta del subproyecto (`form-guests/` o `form-volunteer/`):

```bash
npm start          # Servidor de desarrollo (http://localhost:4200)
npm run build      # Build de producción en dist/
npm test           # Tests unitarios con vitest
```

## LocationPickerComponent

Componente standalone reutilizado en ambos formularios. Usa lazy-loading de la Google Maps API (se carga solo cuando el input recibe foco). Emite `locationSelected: PlaceResult | null`. Acepta `@Input() required` y coordenadas iniciales del mapa. Para prerrellenar desde datos guardados hay que llamar a `initAutocomplete()` manualmente y usar `@ViewChild`.

## Despliegue de Apps Script

Los cambios en `Code.gs` se despliegan manualmente desde el editor de Apps Script como nueva versión. La URL del script **no cambia** entre versiones siempre que se use la misma implantación (deployment). Al redesplegar, seleccionar "Usar versión existente" → no tocar la URL en `environment.ts`.

## Convenciones

- Componentes standalone (sin NgModule).
- Signals Angular para estado reactivo local (`signal`, `computed`).
- Sin `async pipe` en templates — usar `signal` directamente.
- TailwindCSS directamente en los templates HTML (sin CSS separado salvo `styles.css` global).
- Sin comentarios en código salvo en Apps Script donde documentan columnas del Sheet.
