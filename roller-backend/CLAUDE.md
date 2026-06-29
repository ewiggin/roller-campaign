# Pre-commit checklist

Before every commit, always run these steps in order and wait for each to pass:

1. `npm run format` — apply Prettier
2. `npm test` — run the e2e test suite (284 tests, must all pass)

Never commit if any step fails or produces errors.
