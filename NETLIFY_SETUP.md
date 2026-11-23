# Deploy Bun & Fleur Kids to Netlify

This project remains compatible with Vercel. Netlify serves the Vite frontend in `dist/` and forwards `POST /api/actions` to `netlify/functions/actions.ts`. The existing Supabase database and affiliate dashboard are unchanged.

## Connect the site

1. Open **https://app.netlify.com/** while signed in.
2. Choose **Add new project → Import an existing project → GitHub**.
3. Authorize your GitHub account and select `fadhildjajadikarta27-design/bun-fleur-kids`.
4. Select the **main** branch and keep the repository root as Base directory.
5. Settings are provided in `netlify.toml`:
   - Build command: `bun run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
6. Add runtime environment variables **before** deploying:
   - `DATABASE_URL`: existing Supabase Postgres **transaction-pooler** URL; never commit it.
   - `ADMIN_PASSWORD_HASH`: a salted scrypt hash in `salt:hexhash` format.
   - `ADMIN_SESSION_SECRET`: a cryptographically random string of at least 32 characters.
   - `OPENAI_API_KEY` (optional): needed only for AI character generation.
7. Set environment variable scopes to include **Functions**. Keep each value secret and restrict deployment contexts as appropriate. Re-deploy after changing them.

## Important considerations

- The existing Supabase schema has migrations 0001–0009 applied. The Netlify handler explicitly disables request-time database migrations. Run future SQL migrations as a separate, reviewed release step before deploying schema-dependent changes.
- Do **not** expose `DATABASE_URL`, `ADMIN_SESSION_SECRET`, an API key, or a plaintext admin password in frontend Vite variables or this repository.
- Review the application's default 4-digit admin password and use a longer strong password when configuring the new host.
- Netlify deployment does not alter the old Vercel domain or database. Keep Vercel available until Netlify's functional tests pass.

## Smoke tests after first deploy

- `POST /api/actions` with action `getSettings` returns the brand name.
- `POST /api/actions` with action `getAffiliateConfig` returns configured affiliate settings.
- `#/affiliate/daftar` displays the single reusable public application form.
- Submitting a test registration creates a **pending** affiliate, not an active account or a publicly shareable invitation.
- Login to `#/kelola-afiliasi-4821`; verify WhatsApp manually, issue an invitation and confirm it opens on the Netlify domain. Suspend/delete the test registration if no longer needed.
- Verify the full customer flow before pointing a custom domain to Netlify.

If the Netlify build cannot find Bun, check Netlify's build image and configure `BUN_VERSION` in the Netlify UI. Netlify's current build environment supports Bun 1.x.
