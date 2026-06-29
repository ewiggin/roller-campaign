# Pre-commit checklist

Before every commit, always run these steps in order and wait for each to pass:

1. `npm run format` — apply Prettier
2. `npx tsc --noEmit` — TypeScript type check (must produce no errors)

Never commit if any step fails or produces errors.
