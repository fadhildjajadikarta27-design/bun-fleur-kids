# Bun & Fleur Kids

Interactive children's coloring platform with personalized merchandise
(Printed Poster, Custom 3D Figurine, Custom Printed T-Shirt), a private
affiliate system with PIN login, and static QRIS payments with unique
payment amounts and manual admin verification.

This repository contains the source code of the Bun & Fleur Kids web app
(originally built as a Muse Space, slug `colorpop-3d`).

## Structure

- `client/` — React frontend (coloring studio with Scribble-to-Fill,
  shop & checkout, affiliate dashboard, admin pages)
- `server/` — Backend actions and database schema
- `drizzle/` — Database migrations

## Not included in this snapshot

- `node_modules/` and build outputs (`dist/`, `.space-build*/`) — regenerated on build
- `app.db` — the live application database (projects, orders, affiliates)
- `audits/` — internal build-audit screenshots
- Binary assets `client/src/assets/logo.png`, `client/src/assets/qris.png`
  and `icon.webp` — add them manually; the app expects them at those paths
