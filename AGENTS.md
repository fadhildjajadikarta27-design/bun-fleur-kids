# Bun & Fleur Kids — standalone port

This directory is the standalone (Vercel-ready) port of the Bun & Fleur
Kids web app, extracted from its original Muse Space runtime. It is NOT
the live artifact — do not treat it as one.

- `client/` — Vite + React SPA (root: client/, build output: dist/)
- `server/src/` — action handlers (actions.ts), drizzle schema, dispatch
- `api/actions.ts` — the single Vercel Function endpoint (POST /api/actions)
- `drizzle/` — SQLite/libSQL migrations, applied lazily by server/src/db.ts

See PORTING-NOTES.md for architecture, environment variables, and limits.
