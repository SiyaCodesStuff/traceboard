# End-to-end Tests

Use an isolated Supabase test project with migrations and RLS applied. In `.env.local`, set the normal Supabase/database values plus `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` for a dedicated, confirmed user. The test creates a uniquely named project and deletes it (including its children) in cleanup; it does not delete the auth user.

```sh
npx playwright install chromium
npm run e2e
```

Playwright reuses a local server on port 3000 or starts one. Set `E2E_BASE_URL` to test an already-running server at another address. Optionally set `E2E_BROWSER_CHANNEL=msedge` to use an installed Edge browser instead of downloaded Chromium.

Login is the default. To exercise signup, use a new email and `E2E_AUTH_MODE=signup` in an isolated Supabase project with email confirmation disabled. With confirmation enabled, the test stops with instructions to confirm the account and rerun in login mode; it does not bypass confirmation or require a service-role key.

The **E2E** GitHub Actions workflow runs only through **Run workflow**. Configure repository secrets for `NEXT_PUBLIC_SUPABASE_URL`, either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`, `E2E_TEST_EMAIL`, and `E2E_TEST_PASSWORD`. It builds the app and tests the production server. Default push/PR CI does not run E2E.

Reports and screenshots stay ignored locally. Tracing is disabled because auth traces can expose credentials/cookies. Do not publish test artifacts without reviewing them for sensitive data.
