# Changelog — form-guests

## [Unreleased]

### Changed
- Updated the access code placeholder example to show the actual hyphenated format (`AAAA-BBBB-999`) instead of a misleading plain alphabetic example

## [2.1.0] — 2025-05

### Changed
- Clarified the car seats label to reduce user confusion
- Added help hints to guide users and avoid common input mistakes

## [2.0.0] — 2025-04

### Added
- Support for group codes prefixed with `G-` in addition to the standard format

## [1.1.0] — 2025-03

### Added
- GDPR legal pages (privacy policy and terms of service)
- Checkbox to accept legal terms before submitting

## [1.0.0] — 2025-02

### Changed
- **Breaking:** submission now targets the `roller-backend` REST API instead of Google Apps Script
- Staging environment pointing to `roller-api-staging.up.railway.app`

## [0.3.0] — 2025-01

### Added
- Region selector so guests can identify their assigned region
- Transport type question (car / public transport)
- Car seats field with reset on successful submission
- Help hint on car seats input

## [0.2.0] — 2024-12

### Added
- Initial Angular form with guest code lookup and data pre-fill
- Deployment configuration for static hosting
