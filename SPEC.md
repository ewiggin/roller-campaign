# Roller Campaign — Project Spec

## 1. Visión general

Aplicación para gestionar voluntarios e invitados de una campaña especial de predicación distribuida en múltiples **Regiones** geográficas. Cada región celebra el evento en fechas propias, con voluntarios e invitados distintos.

El sistema se compone de tres aplicaciones:

| App              | Stack                | Usuarios                            |
| ---------------- | -------------------- | ----------------------------------- |
| `roller-backend` | NestJS 11 + TypeORM  | —                                   |
| `roller-admin`   | Angular 21           | Superadmin, coordinadores de región |
| `roller-client`  | Angular 21 (PWA)     | Invitados, voluntarios              |

---

## 2. Dominio

### 2.1 Entidades principales

```
Region
  └── tiene fechas propias del evento
  └── tiene coordinadores (region_admins)

Host (Anfitrión)
  └── pertenece a una Region
  └── tiene nombre, dirección, coordenadas, días y horarios de reunión
  └── puede tener N GuestGroups asignados

GuestGroup (Grupo de invitados)
  └── pertenece a una Region
  └── puede estar asignado a un Host
  └── tiene un contacto de grupo (un Guest con is_group_contact = true)
  └── puede tener N invitados (sin máximo)

Guest (Invitado)
  └── pertenece a exactamente un GuestGroup
  └── importado desde Excel (importación única, con posibles migraciones posteriores)
  └── accede al cliente mediante token derivado de su guest_code

Volunteer (Voluntario)
  └── puede pertenecer a varias Regiones
  └── tiene uno o más roles (abiertos, configurables)
  └── declara disponibilidad en calendario
  └── es asignado a actividades desde el backoffice

Activity (Actividad / Turno)
  └── pertenece a una Region
  └── tiene fecha, hora de inicio y fin, descripción
  └── puede tener N voluntarios asignados

User (cuenta del sistema)
  └── roles: superadmin | region_admin | volunteer | guest
  └── los invitados no tienen cuenta User — acceden por token
```

### 2.2 Roles y acceso

| Rol            | Acceso                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `superadmin`   | Todo. Ve y gestiona todas las regiones                                                         |
| `region_admin` | Solo su(s) región(es). Asigna actividades, gestiona invitados y voluntarios de su región       |
| `volunteer`    | App cliente: ve su disponibilidad, actividades asignadas, información de la campaña            |
| `guest`        | App cliente (sin cuenta): accede por token. Ve su programa, horarios, alojamiento, transporte  |

### 2.3 Modelo de datos del invitado (campos del Excel)

```
Identificación:
  guest_code          String  (único, PK de negocio)
  group_code          String  (FK a GuestGroup)
  full_name           String
  is_minor            Boolean
  status              String  (enum: pending | confirmed | cancelled | arrived | blocked)
  branch              String  (sucursal de origen)
  is_group_contact    Boolean
  region_id           FK → Region

Idiomas:
  native_language     String
  other_languages     String[]
  speaks_english      Boolean

Perfil:
  is_special_servant  Boolean  ("siervo especial del tiempo completo")
  origin_city         String
  email               String

Disponibilidad:
  available_from      Date
  available_to        Date

Transporte de llegada:
  arrival_transport   String   (enum: car | bus | train | plane | ferry | motorbike | other)
  arrival_date        Date
  arrival_time        Time
  arrival_place       String
  arrival_airport     String
  arrival_airline     String
  arrival_flight      String
  real_arrival        Date
  real_arrival_time   Time
  needs_airport_transfer Boolean

Transporte de salida:
  departure_transport String
  departure_date      Date
  departure_time      Time
  departure_place     String
  departure_airport   String
  departure_airline   String
  departure_flight    String
  real_departure      Date
  real_departure_time Time

Alojamiento:
  accommodation       String   (nombre o referencia)
  checkin_date        Date
  checkout_date       Date
  needs_special_accommodation Boolean
  hosting_address     String
  maps_link           String
  lat                 Float
  lng                 Float
  transport_mode      String   (último tramo)

Coche:
  car_seats           Integer  (plazas disponibles para otros)
```

---

## 3. Autenticación

### Invitados

- No tienen cuenta `User`.
- El sistema genera un `token` derivado del `guest_code` (hash SHA-256 o JWT firmado con secret).
- La URL de acceso tiene la forma: `https://client.app/access?token=<token>`
- El backend valida el token y devuelve los datos del invitado (sin crear sesión persistente en BD).

### Voluntarios y admins

- Cuenta `User` con email + password (bcrypt, 10 rounds).
- JWT 6h según CLAUDE.md.
- Voluntarios: importados desde Excel o creados manualmente en el backoffice. Si el código de voluntario ya existe, no se sobreescribe el registro.
- Admins: creados manualmente. El superadmin puede asignar el rol `region_admin` y asociarlos a regiones.
- Admin inicial: vía `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

---

## 4. Features por aplicación

### 4.1 roller-backend (API)

#### Estado actual (v0.9.0) — implementado

| Módulo         | Estado | Notas                                                              |
| -------------- | ------ | ------------------------------------------------------------------ |
| `auth`         | ✅      | Login, JWT, superadmin desde .env, token de invitado              |
| `users`        | ✅      | CRUD completo, solo superadmin                                     |
| `regions`      | ✅      | CRUD, coordinadores, import/export Excel                          |
| `guest-groups` | ✅      | CRUD, contador de invitados, import Excel (auto-detecta region)   |
| `guests`       | ✅      | CRUD, paginación, filtros, migración de grupos, import/export     |
| `hosts`        | ✅      | CRUD, sugerencias de grupos por proximidad, import/export Excel   |
| `volunteers`   | ⏳      | Pendiente (Fase 3)                                                |
| `activities`   | ✅      | CRUD por región, asignación de voluntarios                        |
| `notifications`| ⏳      | Pendiente (Fase 3)                                                |

#### Reglas de negocio críticas

- Un invitado pertenece a **exactamente un** grupo.
- Un grupo pertenece a **exactamente una** región.
- Un grupo puede estar asignado a **un** anfitrión (host).
- Un voluntario puede estar en **varias** regiones.
- Al importar voluntarios: si `volunteer_code` existe → **skip** (no update).
- Al importar invitados: carga única. Si `guest_code` ya existe → error en preview (no se sobreescribe).
- El token de invitado se genera server-side a partir de `guest_code` — nunca exponer el algoritmo en el cliente.
- Import Excel: dos pasos — parse (preview con validación) + commit (persistir solo filas válidas).
- Export respeta los filtros activos del usuario (regionId, etc.).

#### Migraciones — checklist (problema recurrente)

Al crear una tabla nueva con `CREATE TABLE` en una migración, si la entidad usa `@PrimaryGeneratedColumn('uuid')`, la columna `"id"` debe declararse como:

```sql
"id" uuid NOT NULL DEFAULT gen_random_uuid(),
```

Sin el `DEFAULT gen_random_uuid()`, TypeORM inserta `DEFAULT` para `id` confiando en que la base de datos genere el UUID. En SQLite (dev) TypeORM genera el UUID en la aplicación y no falla, pero en PostgreSQL (prod) la columna recibe `NULL` y el INSERT falla con `null value in column "id" violates not-null constraint`. Este fallo solo aparece en producción.

Si una migración ya ejecutada en producción creó la tabla sin el default, no la edites (regla general de migraciones): crea una nueva migración con:

```ts
if (queryRunner.connection.options.type === 'postgres') {
  await queryRunner.query(
    `ALTER TABLE "nombre_tabla" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
  );
}
```

(ver `1780851511129-AddDefaultToActivityVolunteerRolesId.ts` y `1781055000000-AddDefaultToCartsId.ts` como referencia).

### 4.2 roller-admin (Backoffice)

#### Estado actual (v0.5.0)

| Sección        | CRUD | Import Excel       | Export Excel              | Notas                   |
| -------------- | ---- | ------------------ | ------------------------- | ----------------------- |
| Dashboard      | —    | —                  | —                         | Métricas por región     |
| Regions        | ✅   | ✅                 | ✅                        | + coordinadores         |
| Hosts          | ✅   | ✅                 | ✅ (filtra por región)    | + sugerencias de grupos |
| Guest Groups   | ✅   | ✅ (auto-región)   | ✅                        | + asignar host          |
| Guests         | ✅   | ✅                 | ✅ (respeta filtros)      | + token + migrar grupo  |
| Users          | ✅   | —                  | —                         | Solo superadmin         |
| Activities     | ✅   | —                  | —                         | + asignación voluntarios|
| Volunteers     | ⏳   | —                  | —                         | Pendiente               |

#### Secciones pendientes

```
Volunteers
  └── Listado filtrable por región, rol, disponibilidad
  └── Importación Excel
  └── Edición de roles
  └── Ver disponibilidad en calendario
```

### 4.3 roller-client (PWA — invitados y voluntarios)

#### Estado actual (v0.2.1)

| Sección                              | Estado | Notas                              |
| ------------------------------------ | ------ | ---------------------------------- |
| Acceso por token (invitado)          | ✅      | `/access?token=X`                 |
| Mi programa (invitado)               | ✅      | `/guest/schedule`                 |
| Mi información de viaje (invitado)   | ✅      | `/guest/travel`                   |
| Mi alojamiento (invitado)            | ✅      | `/guest/accommodation`            |
| Info de campaña (invitado)           | ✅      | `/guest/info`                     |
| Login voluntario                     | ✅      | `/login`                          |
| Mis turnos asignados (voluntario)    | ✅      | `/volunteer/schedule`             |
| Mi disponibilidad (voluntario)       | ✅      | `/volunteer/availability`         |
| Info de campaña (voluntario)         | ✅      | `/volunteer/info`                 |
| PWA offline support                  | ⏳      | Service worker básico activo      |

---

## 5. Importación Excel

### Proceso de importación (todos los módulos)

1. El admin sube el fichero `.xlsx`.
2. El backend parsea y valida fila a fila.
3. Devuelve un preview con: filas válidas, filas con error (y motivo), duplicados detectados.
4. El admin confirma → se persisten solo las filas válidas.
5. Errores se pueden exportar a Excel para corrección.

### Regla de duplicados

- **Invitados**: `guest_code` único. Si existe → error en preview (no se sobreescribe).
- **Voluntarios**: `volunteer_code` único. Si existe → skip silencioso (no error, no update).
- **Hosts**: `name` + `region` únicos. Si existe → se actualiza (upsert).

### Import de guest-groups con auto-región

Si el archivo Excel tiene una columna `region_name`, cada grupo se asigna automáticamente a su región sin selección manual previa.

---

## 6. Notificaciones por email

- Envío de token de acceso al invitado (su email del Excel).
- Notificaciones de actividad asignada al voluntario.
- Transport: **Resend** (mismo que Sensorial).
- Estado: pendiente (Fase 3).

---

## 7. Criterios de aceptación globales

- [x] Un invitado puede acceder a su información personal completa con solo su token.
- [x] Un voluntario puede ver y declarar disponibilidad, y ver sus actividades asignadas.
- [x] Un region_admin solo puede ver y gestionar datos de su(s) región(es).
- [x] El superadmin puede ver y actuar sobre todas las regiones.
- [ ] La importación de un Excel con 3.000+ filas no supera 30s de procesamiento.
- [x] Si el `guest_code` ya existe en una importación, la fila se rechaza con mensaje claro.
- [x] Si el `volunteer_code` ya existe en una importación, la fila se omite silenciosamente.
- [ ] La PWA muestra datos cacheados cuando no hay cobertura.
- [x] Todos los endpoints están documentados en Swagger con ejemplos.

---

## 8. Fases de desarrollo

### Fase 1 — Núcleo ✅ Completada

1. ✅ Módulo `regions` (CRUD básico)
2. ✅ Módulo `guest-groups` + `guests` (modelo completo)
3. ✅ Importación Excel de invitados
4. ✅ Autenticación por token de invitado
5. ✅ Vistas cliente: invitado (programa, viaje, alojamiento)

### Fase 2 — Voluntarios, anfitriones y turnos ✅ Backend completo / Admin parcial

6. ✅ Módulo `hosts` (CRUD + importación)
7. ✅ Módulo `volunteers` (CRUD + importación)
8. ✅ Módulo `activities` (CRUD + asignación)
9. ✅ Vistas cliente: voluntario (disponibilidad, actividades)
10. ✅ Backoffice: hosts, guest-groups, guests, activities
11. ⏳ Backoffice: sección volunteers

### Fase 3 — Notificaciones y pulido

12. ⏳ Envío de tokens y notificaciones por email (Resend)
13. ⏳ PWA offline support completo
14. ⏳ Dashboard de backoffice con métricas completas

---

## 9. Decisiones cerradas

| #   | Decisión                   | Resolución                                                                                                              |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Enum `status` del invitado | `pending \| confirmed \| cancelled \| arrived \| blocked`                                                               |
| 2   | Medios de transporte       | Enum fijo: `car \| bus \| train \| plane \| ferry \| motorbike \| other` (campo `other_transport` texto libre)          |
| 3   | Roles de voluntario        | Entidad `VolunteerRole` creada libremente desde backoffice. Sin lista base. Sirve solo para filtrado.                   |
| 4   | Provider de email          | Resend (igual que Sensorial)                                                                                            |
| 5   | Fechas                     | `varchar` (ISO `YYYY-MM-DD`) para compatibilidad SQLite/PostgreSQL                                                      |
| 6   | Relación Host ↔ GuestGroup | Un GuestGroup puede tener un Host asignado; Host tiene contadores `group_count` y `guest_count`                         |
| 7   | Naming de "turnos"         | Se llaman `activities` en código y base de datos (no `turns`)                                                           |

## 10. Pendientes / decisiones abiertas

| #   | Decisión                               | Estado      |
| --- | -------------------------------------- | ----------- |
| 1   | PIN adicional para acceso de invitados | Fase futura |
| 2   | Recordatorios automáticos por email    | Fase 3      |
| 3   | Métricas completas en dashboard admin  | Fase 3      |

---

## 11. Algoritmo de asignación automática de grupos a grupos de predicación

### Objetivo

Dado un turno de predicación (`activity` con `is_preaching_shift = true`), asignar automáticamente los grupos de invitados disponibles a los grupos de predicación (`preaching_groups`) del turno, minimizando la distancia total recorrida y equilibrando el número de grupos por grupo de predicación.

### Reglas de elegibilidad (precondiciones, igual que asignación manual)

Antes de ejecutar el algoritmo, se obtiene la lista de grupos disponibles mediante `getAvailableGroups()`, que ya aplica:

1. Mismo región que la actividad
2. Fecha dentro de la ventana de disponibilidad del grupo (`available_from` / `available_to`)
3. Sin conflicto con la reunión del anfitrión del grupo
4. Sin solapamiento de horario con otra actividad
5. Sin exceder el límite de turnos de predicación (`maxPreachingShiftsPerGroup`, defecto 3)
6. Sin otro turno de predicación el mismo día (`same_day_preaching_shift = false`)

Solo los grupos con todos estos checks en verde entran al algoritmo. Los que ya están asignados a algún grupo de predicación de este turno se excluyen (son asignaciones existentes que no se tocan).

### Configuración en settings

Se añade `maxGuestsPerPreachingGroup` (entero, sin defecto fijo — debe configurarse por campaña) junto a los límites existentes:

```
maxPreachingShiftsPerGroup    (ya existe)
maxActivitiesPerGroup         (ya existe)
maxGuestsPerPreachingGroup    (nuevo)
```

### Algoritmo (Greedy por distancia con equilibrado por invitados)

**Inputs:**
- `groups`: lista de grupos de invitados disponibles, cada uno con su `guest_count` y coordenadas propias
- `preachingGroups`: lista de grupos de predicación del turno, cada uno con coordenadas del punto de reunión
- `maxGuests`: valor de `maxGuestsPerPreachingGroup` obtenido de settings

**Pasos:**

1. Calcular la distancia de cada grupo de invitados a cada grupo de predicación (distancia euclidiana sobre coordenadas lat/lng).
2. Construir una lista plana de pares `(grupo_invitados, grupo_predicación, distancia)` y ordenarla de menor a mayor distancia.
3. Iterar la lista en orden:
   - Si el grupo de invitados ya fue asignado → saltar
   - Si el grupo de predicación ya supera `maxGuests` sumando los invitados del grupo candidato → saltar
   - En caso contrario → asignar (llamar a la lógica existente de `assignGuestGroupToGroup`)
4. Si ningún grupo de predicación tiene hueco para el candidato (todos superarían `maxGuests`), el candidato se omite y se contabiliza como `skipped`. El límite es estricto: se respeta siempre.

**Output:** lista de pares `(guest_group_id, preaching_group_id)` asignados.

### Comportamiento ante casos límite

| Caso | Comportamiento |
| --- | --- |
| Ningún grupo disponible | No hace nada, devuelve `{ activity, skipped: 0 }` |
| Ningún grupo de predicación en el turno | Error: no se puede ejecutar sin grupos de predicación |
| Grupos sin coordenadas (`distance_km = null`) | Se colocan al final (misma lógica que el ordenado actual en `getAvailableGroups`) |
| Grupos ya asignados a un grupo de predicación | Se respetan; el algoritmo solo asigna los no asignados |
| Grupos no asignados por límite de capacidad | Se devuelve `skipped > 0`; el frontend muestra un aviso con el número de grupos omitidos |

### Endpoint

`POST /activities/:id/auto-assign-preaching-groups`

Devuelve la lista de asignaciones realizadas. No tiene modo "preview" en v1; la confirmación es implícita al llamar al endpoint. Se puede deshacer manualmente asignación por asignación.

### UI

Botón "Asignar automáticamente" en la pestaña de grupos de predicación del turno, visible solo si hay grupos de predicación definidos y hay grupos disponibles sin asignar.

---

## 12. Algoritmo de asignación automática de grupos a turnos de hospitalidad

### Objetivo

Dado un turno de hospitalidad (`activity` con `is_food_shift = true`), asignar automáticamente los grupos de invitados disponibles al turno, respetando su capacidad máxima y los criterios de elegibilidad.

### Reglas de elegibilidad

Antes de ejecutar el algoritmo, se obtiene la lista de grupos mediante `getAvailableGroups()`, que para turnos de hospitalidad aplica:

1. Mismo región que la actividad
2. Tiene turno de predicación matutino (inicio < 12:00) asignado el mismo día en la misma región
3. Fecha dentro de la ventana de disponibilidad del grupo (`available_from` / `available_to`)
4. Al menos un invitado disponible ese día
5. Sin solapamiento de horario con otra actividad (`already_in_activity = false`)
6. Sin conflicto con la reunión del anfitrión del grupo (`host_schedule_conflict = false`)
7. **No asignado a ningún otro turno de hospitalidad en toda la campaña** (`already_in_food_shift = false`)
8. Al menos un invitado registrado (`guest_count > 0`)

Los grupos que ya están asignados a este turno se excluyen (asignaciones existentes que no se tocan).

### Restricción en asignación manual

La regla "un grupo solo puede tener un turno de hospitalidad en toda la campaña" también se valida al asignar manualmente: el backend lanza error si se intenta asignar un grupo que ya tiene otro turno de hospitalidad. En el selector del frontend, estos grupos aparecen deshabilitados con el motivo "Already has a hospitality shift this campaign".

### Algoritmo (Greedy por distancia)

**Inputs:**
- `groups`: lista de grupos candidatos, ordenados por distancia ascendente (más cercano primero)
- `maxGuests`: valor de `max_guests` del turno (puede ser `null` — sin límite)
- `currentGuestCount`: suma de invitados ya asignados al turno

**Pasos:**

1. Los grupos candidatos ya vienen ordenados por distancia de `getAvailableGroups()`.
2. Iterar en orden:
   - Si `max_guests` está configurado y `currentGuestCount + candidate.guest_count > max_guests` → saltar (`skipped++`)
   - En caso contrario → asignar (`assignGuestGroup`); actualizar `currentGuestCount`
3. Si un grupo no cabe (excede la capacidad), se contabiliza como `skipped`.

**Output:** `{ activity, skipped }`

### Comportamiento ante casos límite

| Caso | Comportamiento |
| --- | --- |
| Ningún grupo elegible | No hace nada, devuelve `{ activity, skipped: 0 }` |
| Turno sin `max_guests` | Se asignan todos los grupos elegibles sin límite |
| Grupos sin coordenadas (`distance_km = null`) | Se colocan al final |
| Grupos ya asignados al turno | Se respetan; el algoritmo solo añade nuevas asignaciones |
| Grupos omitidos por capacidad | Se devuelve `skipped > 0`; el frontend muestra un aviso |

### Endpoints

- `POST /activities/:id/food-shift/auto-assign` — devuelve `{ activity, skipped }`
- `POST /activities/food-shifts/bulk-auto-assign` — devuelve `{ shiftsProcessed, totalSkipped, unassignedGroups }`

### UI

- Botón "Auto-assign" en la pestaña Groups del detalle de un turno de hospitalidad.
- Botón "Auto-assign all" en la cabecera de la lista de turnos de hospitalidad (bulk), con modal de confirmación que explica los criterios.
