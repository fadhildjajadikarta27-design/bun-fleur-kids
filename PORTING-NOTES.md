# Porting Notes — Bun & Fleur Kids, Muse Space → standalone Vercel project

This project is a runtime port of the Bun & Fleur Kids web app (Muse Space
slug `colorpop-3d`). No business logic, prices, statuses, copy, or design
were changed — only the runtime plumbing that tied the app to the Muse
Space SDK (`@hatch/space-sdk`, previously a `file:/opt/hatch/...` tarball
that made `bun install` fail anywhere outside Muse).

## Architecture

- **Frontend**: Vite SPA. `vite.config.ts` sets `root: "client"` with
  `@vitejs/plugin-react` and `@tailwindcss/vite`; `bun run build` emits
  `dist/` at the repo root.
- **Backend**: one Vercel Function, `api/actions.ts`, exposing
  `POST /api/actions` with JSON `{ action, args }`. The dispatch core is
  `server/src/dispatch.ts`, shared verbatim with the local dev server
  (`scripts/dev-server.mjs`, `bun run dev:api`, port 8787, API only).
- **Dispatch protocol**: unknown action → 404 `{error}`; args failing the
  action's zod request schema → 400 with the zod message; handler return
  value → 200 JSON (response schema checked leniently — a mismatch logs a
  warning but still returns the value); handler-thrown `Error` → 400
  `{error: message}`.
- **Database**: drizzle-orm over libSQL (`@libsql/client`). The schema
  file `server/src/schema.ts` is byte-identical to the Space original.
  Connection: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` when set,
  otherwise `file:./dev.db` (local development only).
- **Migrations**: on the first dispatch of each process, `server/src/db.ts`
  applies `drizzle/*.sql` in filename order (split on
  `--> statement-breakpoint`) and records each applied file in a
  `__port_migrations` table, so restarts and warm invocations skip them.
  `vercel.json` carries `functions.api/actions.ts.includeFiles: drizzle/**`
  so the SQL files ship with the function bundle.
- **AI character generation** (`generateCharacter`, the app's single
  inference consumer): if `OPENAI_API_KEY` is set, `ctx.inference.complete`
  calls OpenAI chat completions (`OPENAI_MODEL`, default `gpt-4o-mini`,
  `response_format: json_object`, the zod schema rendered to JSON Schema in
  the system prompt) and validates the reply with the action's schema.
  Without the key it throws an honest Indonesian error telling the user the
  feature is not configured and to use the manual "Rakit dari Bagian" mode.

## What replaced each piece of the Space SDK

| Space SDK surface | Standalone replacement |
| --- | --- |
| `@hatch/space-sdk` (`defineAction`, `z`, `Ctx`, `ActionsModule`) | `server/src/sdk.ts` — local shim; `defineAction` is a type-carrying identity function. `server/src/actions.ts` changed **only its import line**. |
| `ctx.db()` (hosted SQLite) | `server/src/db.ts` — drizzle-orm/libsql singleton. |
| `ctx.invalidateQueries()` | No-op in `server/src/dispatch.ts` (react-query refetches client-side). |
| `ctx.inference.complete()` | OpenAI fetch implementation in `server/src/dispatch.ts` (see above). |
| `@hatch/space-sdk/client` (`createActionClient`, `ApiRequest`/`ApiResponse`) | `client/src/api.ts` — a fetch `Proxy` posting to `/api/actions`, with the same generic type extraction from `typeof Actions`. |
| `spaceQueryClient` | `new QueryClient()` in `client/src/main.tsx`. The root div keeps its `hatch-space-root` class and `data-hatch-space-root` attribute, and the `[data-generated-space-root]` lookup is unchanged. |
| `SafeAreaTopScrim` | `client/src/components/SafeAreaTopScrim.tsx` — fixed top bar, height `env(safe-area-inset-top, 0px)`, `zIndex: 60`, `pointerEvents: "none"`. |
| `actionFields()` Bun macro (`@hatch/space-sdk/fields`) | `scripts/gen-fields.mjs` introspects each request schema with `z.toJSONSchema()` and generates `client/src/fields.ts` (`FIELDS`); App/Shop/Affiliate import it instead of the macro. Re-run `bun run gen:fields` after changing a request schema. Note: zod encodes `.int()` as a ±MAX_SAFE_INTEGER JSON-Schema bound; the generator drops that sentinel so it never lands on an `<input>`. Fields whose only constraint is a regex or `positive()` (e.g. PIN, payout amount) get `{}` — same as any unconstrained field. |
| `client/build.mjs` (SDK `buildClient`) | Deleted; replaced by Vite (above). |
| Binary assets `client/src/assets/logo.png` / `qris.png` | `client/src/assets-inline.ts` exports `logoUrl` / `qrisUrl` as base64 data URIs of the exact same PNGs (the project's GitHub channel is text-only). The PNG files remain in place, unimported. Import sites updated in App.tsx, Shop.tsx, Affiliate.tsx. |

## Files added

- `vite.config.ts`, `vercel.json`
- `api/actions.ts` — Vercel Function entry (Node-style handler).
- `server/src/sdk.ts`, `server/src/db.ts`, `server/src/dispatch.ts`
- `scripts/dev-server.mjs`, `scripts/gen-fields.mjs`
- `client/src/fields.ts` (generated), `client/src/assets-inline.ts` (generated),
  `client/src/components/SafeAreaTopScrim.tsx`
- `PORTING-NOTES.md` (this file)

## Files changed

- `package.json` — renamed to `bun-fleur-kids`; `@hatch/space-sdk` removed;
  added `@libsql/client`; devDeps added `vite`, `@vitejs/plugin-react`,
  `@tailwindcss/vite`, `@types/node`; scripts: `build` = `vite build`,
  `dev:api`, `gen:fields`, `typecheck` unchanged in shape.
- `bun.lock` — regenerated by `bun install`; contains no `/opt/hatch`
  references (verified by grep).
- `server/src/actions.ts` — import line only (`@hatch/space-sdk` → `./sdk`);
  verified by diff against the original.
- `server/tsconfig.json` — includes `src/**` and `../api/**`, `rootDir: ".."`,
  types `["bun-types", "node"]`; dropped the dead `@space/privileged` path.
- `client/tsconfig.json` — dropped the dead `@space/*` path mappings only.
- `client/src/api.ts`, `client/src/main.tsx`, `client/src/App.tsx`,
  `client/src/components/Shop.tsx`, `client/src/components/Affiliate.tsx` —
  SDK imports replaced as per the table above; no logic changes.
- `AGENTS.md` — rewritten for the standalone project (the copied file
  described the artifact-builder workflow, which does not apply here).
- `.gitignore` — added `dev.db*`.

## Files removed from the copy

- `space.json`, `client/build.mjs` (Space-runtime plumbing).
- Build outputs and caches were never copied (`node_modules`, `dist*`,
  `.space-build*`, `.bun-cache`, `audits/`, `app.db*`).

## Environment variables (Vercel project settings)

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | **Yes** | libSQL/Turso database URL. Without it the function falls back to `file:./dev.db`, which on Vercel is ephemeral/read-only — data would not persist. |
| `TURSO_AUTH_TOKEN` | **Yes** (with Turso) | Auth token for the Turso database. |
| `OPENAI_API_KEY` | No | Enables "Buat dengan AI" (generateCharacter). Unset = the feature returns an honest not-configured error; everything else works. |
| `OPENAI_MODEL` | No | Overrides the default `gpt-4o-mini`. |

## Verification performed (2026-11-23)

- `bun install` — 151 packages, clean; `grep /opt/hatch bun.lock` → no matches.
- `bun run typecheck` (client + server) — passes. One type fix was needed:
  the `ctx.db` implementation in dispatch.ts casts the app-schema database
  to the generic `LibSQLDatabase<TSchema>` (actions only ever request
  `ctx.db<typeof schema>()`).
- `bun run build` — `dist/index.html` + hashed JS/CSS; bundle contains
  `/api/actions` and both inlined image data URIs; `grep space-sdk dist/`
  → no matches. (Vite warns the JS chunk is ~1.1 MB, mostly the inlined
  base64 images and the illustration catalog — pre-existing app weight,
  not a port regression.)
- Smoke test against `scripts/dev-server.mjs` (fresh `file:./dev.db`),
  30+ checks, all passing: getSettings, getShopConfig (prices
  49000/120000/79000), createProject → listProjects, createOrder (poster,
  Rp49.000 + unique code → payable 49.507 in the test run),
  confirmTransfer with wrong WhatsApp → `not_found`, correct WhatsApp →
  `waiting_verification`, verifyOrderPayment `verify` → payState
  `verified` / paymentStatus `paid`; adminCreateAffiliate → acceptInvitation
  with wrong identity → 400, trivial PIN `0000` → 400, valid PIN → session;
  affiliateLogin → affiliateMe dashboard data; validateCoupon bogus code →
  `valid: false`, real code → 10% discount; generateCharacter without
  `OPENAI_API_KEY` → 400 with the honest not-configured message; unknown
  action → 404.
- Restart test: server restarted against the same dev.db — migrations were
  skipped via `__port_migrations` and previously written data persisted.
- Test artifacts (`dev.db*`) were deleted after the smoke test.

## Known limitations

- **No hosted database is provisioned by this port.** Production needs a
  Turso (or other libSQL) database and the two env vars above before the
  Vercel deployment can serve real data.
- **Response-schema validation is lenient by design** (log + pass-through),
  matching the blueprint; request validation is strict.
- **`generateCharacter` depends on OpenAI** when enabled; model output is
  validated against the action's zod schema, and a non-conforming reply
  surfaces as a 400 to the client (same honesty contract as before: no
  fabricated characters).
- The affiliate/admin actions keep the original app's trust model (they
  were unauthenticated action calls in the Space runtime too — e.g. admin
  actions are gated by the hidden route in the UI, not by server auth).
  The port does not change that model; adding real server-side auth is a
  product decision for a follow-up, not part of this runtime port.
- `bun.lock` pins `packageManager: bun@1.3.10` (carried over); Vercel
  detects Bun from the lockfile. `vercel.json` builds with `bun run build`.
