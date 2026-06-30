# Language

All text in source code must be in English: error messages, exception strings, comments, log messages, and any other string literals.

# PDF changes

There are two guest-group PDF types that must always be updated together:

- **Individual schedule PDF** (`exportGroupSchedulePdf` in `activities.service.ts`) — renders via `buildGroupScheduleContent` in `schedule-pdf.util.ts`. Also covers the per-host bulk schedule PDF (`exportHostSchedulesPdf`), which uses the same function.
- **Assigned-groups PDF** (`exportAssignedGroupsPdf` in `hosts.service.ts`) — separate rendering, must be updated independently.

Any change to what group data is shown in PDFs must be applied to both.

# Pre-commit checklist

Before every commit, always run these steps in order and wait for each to pass:

1. `npm run format` — apply Prettier
2. `npm test` — run the e2e test suite (284 tests, must all pass)

Never commit if any step fails or produces errors.
