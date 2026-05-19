# form-guests

Public Angular form for event guests. Validates an invitation code against a Google Sheet and collects travel and accommodation details.

## Stack

| Layer | Technology |
|---|---|
| Framework | Angular 21 (standalone components, signals) |
| Styling | Tailwind CSS v4 |
| Backend | Google Apps Script (no dedicated server) |
| Maps | Google Maps JS API (`@googlemaps/js-api-loader`) |

## Flow

1. Guest enters their invitation code.
2. The form validates the code via `GET <appsScriptUrl>?codigo=XXX`. The Apps Script checks column B of the *Invitados* sheet and returns `{ valid, fila }`.
3. On success, the guest fills in their travel and accommodation data.
4. On submit, data is sent via `POST` (mode `no-cors`) and written to columns 31–43 of the guest's row.

## Form fields

| Field | Sheet column |
|---|---|
| Full name | 31 |
| City of origin | 32 |
| Available car seats | 33 |
| Speaks English | 34 |
| Arrival date | 35 |
| Arrival time | 36 |
| Departure date | 37 |
| Departure time | 38 |
| Accommodation address | 39 |
| Google Maps link | 40 |
| Latitude | 41 |
| Longitude | 42 |
| Mode of transport | 43 |

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Edit `src/environments/environment.ts`:

```ts
export const environment = {
  appsScriptUrl: 'https://script.google.com/macros/s/...',
  googleMapsApiKey: 'YOUR_API_KEY',
};
```

### 3. Run

```bash
npm start
```

## Scripts

| Script | Action |
|---|---|
| `npm start` | Development server (`localhost:4200`) |
| `npm run build` | Production build → `dist/form-guests/` |
| `npm test` | Unit tests (Vitest) |

## Apps Script deployment

The backend logic lives in `apps-script/Code.gs`. Changes must be deployed manually from the Apps Script editor as a new version. Use an existing deployment — the URL does not change between versions and must match `environment.appsScriptUrl`.
