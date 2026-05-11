# form-guests

Formulario Angular para invitados del evento "Carritos se van de vacaciones".
Ver contexto completo en `../CLAUDE.md`.

## Propósito

Invitado introduce su código → valida contra la hoja "Invitados" (columna B) → rellena datos de viaje y hospedaje → guarda en columnas 31–43 del Sheet.

## Stack

- Angular 21, TailwindCSS 4, TypeScript 5.9
- Backend: Google Apps Script (`apps-script/Code.gs`)
- Google Maps JS API para picker de ubicación

## Archivos clave

```
src/app/components/guest-form/        # Formulario principal
src/app/components/location-picker/   # Picker Google Maps (reutilizable)
src/app/services/google-sheets.service.ts  # GuestFormData + GET/POST
src/environments/environment.ts       # appsScriptUrl + googleMapsApiKey
apps-script/Code.gs                   # Apps Script (desplegar manualmente)
```

## Campos del formulario

| Campo | Columna Sheet |
|---|---|
| Nombre completo | 31 |
| Ciudad de origen | 32 |
| Plazas de coche | 33 |
| Habla inglés | 34 |
| Llegada real (fecha + hora) | 35–36 |
| Salida real (fecha + hora) | 37–38 |
| Dirección hospedaje | 39 |
| Enlace Google Maps | 40 |
| Latitud / Longitud | 41–42 |
| Medio de transporte | 43 |

## Apps Script

- **URL producción:** ver `src/environments/environment.ts`
- GET `?codigo=XXX` → `{ valid, fila }`
- POST JSON → escribe columnas 31–43 en la fila del invitado
- POST usa `mode: 'no-cors'` (respuesta opaca, no se puede leer)

## Comandos

```bash
npm start     # Dev server localhost:4200
npm run build # Build producción → dist/form-guests/
npm test      # Vitest
```
