# Changelog — roller-backend

## [Unreleased]

### Added
- `car_count` field on `GuestGroup` entity: number of cars the group brings
- `hasCars` filter on `GET /api/guest-groups` (values: `true` | `false`)
- `car_count` and `total_car_seats` included in `GroupSuggestionDto` returned by `GET /api/hosts/:id/group-suggestions`
- Migration `1749700000000-AddCarCountToGuestGroups`

## [0.22.0] — 2025-05

### Added
- Volunteer login and JWT support for roller-client
- Activities and volunteer schedule exposed to roller-client (`GET /api/guest-groups/:id/activities`, `/api/activities/:id`)
- Preaching-shift flag on activities (`is_preaching_shift`)
- Required volunteers and max guests fields on activities
- Volunteer role assignment per activity from the volunteer's own role list
- Filter volunteers by role and availability window
- Block group assignment to an activity if the group's host has a meeting conflict on that day

### Fixed
- Activity locations stored as arrays (migration `1749500000000-LocationsToArrays`)

## [0.21.0] — 2025-04

### Added
- Host capacity field (`capacity` on `hosts` table)
- Capacity badge showing total guests vs capacity in host detail
- Language data in group suggestions (`GET /api/hosts/:id/group-suggestions`)
- Language and capacity filters for group suggestions
- Block group assignment to an activity when it conflicts with the host's schedule

### Fixed
- Volunteer list filter errors

## [0.20.0] — 2025-04

### Added
- Volunteer code and region are now editable via the API
- Improved input validation and security on volunteer endpoints

## [0.19.0] — 2025-03

### Added
- Legal terms acceptance field on volunteers (`terms_accepted`)
- Filter volunteers by `terms_accepted` in the list endpoint

## [0.18.0] — 2025-03

### Added
- Role-based permissions: `region_admin` role with access scoped to assigned regions
- Users linked to regions (many-to-many)
- Settings module: email configuration stored in DB
- Improved volunteer list filters

### Fixed
- Staging migration error
- Test suite failures after role refactor

## [0.17.0 and earlier]

### Added
- Guest groups list filters: min car seats, languages, composition
- Distance calculation between host and guest groups (Haversine centroid)
- Activities module: creation with repetitions, series, calendar view
- Duplicate prevention for volunteers and guests in same activity
- Activity filtering by host
- Morgan HTTP logging with origin and user
- E2E test suite (90%+ coverage)
- Truncate endpoint for guests and guest groups
- Volunteers module with availability calendar
- Hosts module with group suggestion and distance sorting
- Guests module: CRUD, pagination, import/export Excel, token-based access
- Guest groups module: CRUD, import/export Excel, multi-region import
- Regions module: CRUD, event dates, coordinators, import/export Excel
- Auth module: JWT, superadmin via `.env`, guest token lookup
- Users module: CRUD (superadmin only)
