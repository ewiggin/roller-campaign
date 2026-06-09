# Changelog — roller-admin

## [Unreleased]

### Added
- `car_count` (Num Cars) column visible in the guest groups list with car icon
- `total_car_seats` visible in the guest groups list as "avail. seats"
- `hasCars` filter in the guest groups list (All / With cars / Without cars)
- "Shared car seats" label replaces "Min car seats" for the seats filter
- `car_count` and `total_car_seats` shown in host detail (assigned and available groups) with car icon / "shared seats" text
- Cars filter in the available-groups panel of host detail
- `car_count` editable in the group edit modal (pencil icon button)
- Edit button on guest groups list changed from calendar icon to pencil icon
- Tests for `hasCars` param in `GuestGroupsService.getAll`
- Tests for `filteredAvailable` computed and `onHasCarsChange` in `HostDetailComponent`

## [0.19.0] — 2025-05

### Added
- Activities screen: required volunteers count input and info display
- Activities screen: max guests input
- Activities screen: volunteer role selector from the volunteer's own roles
- Activities screen: filter by role (chip buttons) with real availability check
- Activities screen: preaching shift indicator in the list
- Activities screen: improved modal styles and save/delete buttons
- Block group assignment to activity when host has a meeting conflict that day

### Fixed
- Volunteer list filter errors (open in new tab, incorrect filtering)

## [0.18.1] — 2025-04

### Fixed
- Capacity field nullable in the edit modal (hotfix)

## [0.18.0] — 2025-04

### Added
- Host capacity field in the edit modal with guests/capacity badge in detail and list
- Language filter for available groups in host detail
- Language badge shown on each available group card
- Guest/capacity badge in host detail header

## [0.17.0] — 2025-03

### Added
- Volunteer code and region editable from the admin

## [0.16.0] — 2025-03

### Changed
- Bumped dependencies; minor internal improvements

## [0.15.0] — 2025-03

### Added
- Volunteer terms accepted info shown in volunteer detail view
- Role-based menu visibility: region admins only see their own regions

### Changed
- Guest groups list filters improved (languages, composition, car seats)

## [0.13.0] — 2025-02

### Added
- Settings section with email configuration
- Settings icon in the admin layout header

## [0.12.0] — 2025-02

### Added
- Icons throughout the admin interface (Heroicons)
- Volunteer roles CRUD

## [0.11.0] — 2025-02

### Added
- Volunteer detail view with editable location, schedule, and filters
- Volunteer list with filters (availability, terms, role)
- Guest and group creation forms (manual entry)
- Searchable selects across the interface

## [0.10.0 and earlier]

### Added
- Activities module: calendar view, repetitions, series management, host filtering
- Guest groups list with language and car seats filters
- Hosts module: list, detail, group suggestion with distance sorting
- Guests module: list, detail, pagination, migration between groups
- Regions module: list with coordinators and event dates
- Import/export Excel for guests, groups, hosts and regions
- Dark mode toggle (persisted in localStorage, respects OS preference)
- JWT authentication with loading screen and auto-logout on 401
- Angular PWA base with lazy-loaded routes and standalone components
