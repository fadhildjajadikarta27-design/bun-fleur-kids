// Netlify Node.js function matching the existing Vercel /api/actions contract.
// Netlify rewrites POST /api/actions here via netlify.toml.
// We keep the Vercel handler untouched so rollback is always possible.
import { dispatchAction } from "../../server/src/dispatch.js";
import {
  clearAdminCookie, isAdminAuthorized, issueAdminCookie,
  requiresAdmin, verifyPassword, visitorFromCookie,
} from "../../server/src/admin-auth.js";

type Payload = { action?: unknown; args?: unknown };

export default async function handler(request: Request): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });

  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed — use POST." });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json(400, { error: "Request body must be JSON: { action, args }." });
  }
  if (!payload || typeof payload.action !== "string" || payload.action.length === 0) {
    return json(400, { error: "Request body must name an action." });
  }
  const cookieHeader = request.headers.get("cookie") ?? undefined;

  let visitor;
  try {
    visitor = visitorFromCookie(cookieHeader);
  } catch {
    return json(503, { error: "Konfigurasi sesi server belum tersedia." });
  }
  if (visitor.cookie) headers.append("set-cookie", visitor.cookie);

  if (payload.action === "adminStatus") {
    return json(200, { authenticated: isAdminAuthorized(cookieHeader) });
  }
  if (payload.action === "adminLogin") {
    const origin = request.headers.get("origin");
    const host = new URL(request.url).host;
    // Same-origin policy; avoid crashing if a malformed Origin is supplied.
    if (origin) {
      try {
        if (new URL(origin).host !== host) {
          return json(403, { error: "Permintaan login dari situs lain ditolak." });
        }
      } catch {
        return json(403, { error: "Origin login tidak valid." });
      }
    }
    const args = payload.args;
    const password = typeof args === "object" && args !== null && "password" in args
      ? (args as { password?: unknown }).password
      : undefined;
    if (typeof password !== "string" || password.length > 256 || !verifyPassword(password)) {
      return json(401, { error: "Password admin salah atau belum dikonfigurasi." });
    }
    try {
      headers.append("set-cookie", issueAdminCookie());
      return json(200, { authenticated: true });
    } catch {
      return json(503, { error: "Sesi admin belum dikonfigurasi di server." });
    }
  }
  if (payload.action === "adminLogout") {
    headers.append("set-cookie", clearAdminCookie());
    return json(200, { authenticated: false });
  }
  const authorized = isAdminAuthorized(cookieHeader);
  if (requiresAdmin(payload.action) && !authorized) {
    return json(401, { error: "Akses admin dibatasi. Masuk melalui halaman admin terlebih dahulu." });
  }

  // All nine existing Supabase migrations have already been applied.
  // On Netlify, no user request may perform DDL/migrations; future
  // migrations must be run as an explicit, reviewed release step.
  process.env.BFK_SKIP_MIGRATIONS = "1";
  const { status, body } = await dispatchAction(
    payload.action, payload.args ?? {}, visitor.id, authorized,
  );
  return json(status, body);
}
