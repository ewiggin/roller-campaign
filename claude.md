# form-volunteer

Formulario Angular para voluntarios con coche del evento "Carritos se van de vacaciones".
Ver contexto completo en `../CLAUDE.md`.

## Propósito

Voluntario introduce su código → valida en el Sheet (devuelve nombre + datos previos si ya rellenó antes) → actualiza disponibilidad horaria y datos de coche → guarda.

## Stack

- Angular 21, TailwindCSS 4, TypeScript 5.9
- Backend: Google Apps Script
- Google Maps JS API para picker de ubicación

## Archivos clave

```
src/app/components/volunteer-form/     # Formulario principal
src/app/components/location-picker/    # Picker Google Maps (igual que form-guests)
src/app/services/google-sheets.service.ts  # VolunteerFormData + ExistingFormData + ValidateResult
src/environments/environment.ts        # appsScriptUrl + googleMapsApiKey
```

## Interfaces principales

- `VolunteerFormData` — datos que se envían al Sheet
- `ExistingFormData` — datos previos que devuelve el GET si el voluntario ya rellenó
- `ValidateResult` — respuesta del GET: `{ fila, nombre, formData }`

## Campos del formulario

- Código de voluntario (valida en Sheet)
- Plazas disponibles en el coche
- Dirección (picker Google Maps → lat/lon/mapsLink)
- Disponibilidad horaria: tabla lunes–domingo × mañana/tarde (14 checkboxes)
  - Nombres de campo: `{dia}Manana` / `{dia}Tarde` (ej: `lunesManana`, `sabadoTarde`)

## Apps Script

- **URL producción:** ver `src/environments/environment.ts`
- GET `?codigo=XXX` → `{ valid, fila, nombre, formData }` (formData puede ser null)
- POST JSON → escribe/actualiza la fila del voluntario
- POST usa `mode: 'no-cors'` (respuesta opaca)

## Diferencia clave con form-guests

El GET de este formulario devuelve `formData` con los valores previamente guardados, permitiendo precargar el formulario si el voluntario ya lo rellenó.

## Comandos

```bash
npm start     # Dev server localhost:4200
npm run build # Build producción → dist/form-volunteer/
npm test      # Vitest
```
