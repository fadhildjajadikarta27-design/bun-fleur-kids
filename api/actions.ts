// Vercel Function: the single backend endpoint for the standalone port.
//
// POST /api/actions  { action: string, args: object }
//   → 200 with the action's return value as JSON
//   → 400 { error } for validation failures and handler errors
//   → 404 { error } for unknown actions
//
// All logic lives in server/src/dispatch.ts, shared with the local dev
// server (scripts/dev-server.mjs).

import type { IncomingMessage, ServerResponse } from "node:http";
import { dispatchAction } from "../server/src/dispatch.js";
import { clearAdminCookie, isAdminAuthorized, issueAdminCookie, requiresAdmin, verifyPassword } from "../server/src/admin-auth.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed — use POST." }));
    return;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk as Buffer;
  }
  let payload: { action?: unknown; args?: unknown };
  try {
    payload = JSON.parse(raw) as { action?: unknown; args?: unknown };
  } catch {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Request body must be JSON: { action, args }." }));
    return;
  }
  if (typeof payload.action !== "string" || payload.action.length === 0) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Request body must name an action." }));
    return;
  }
  // Admin sessions are issued only by this server-side entrypoint.
  // Neither a hidden URL nor a browser-provided role is authorization.
  const cookieHeader = req.headers.cookie;
  const json = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(body));
  };
  if (payload.action === "adminStatus") {
    json(200, { authenticated: isAdminAuthorized(cookieHeader) });
    return;
  }
  if (payload.action === "adminLogin") {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (origin && host && new URL(origin).host !== host) {
      json(403, { error: "Permintaan login dari situs lain ditolak." });
      return;
    }
    const args = payload.args;
    const password = typeof args === "object" && args !== null && "password" in args
      ? (args as { password?: unknown }).password : undefined;
    if (typeof password !== "string" || password.length > 256 || !verifyPassword(password)) {
      json(401, { error: "Password admin salah atau belum dikonfigurasi." });
      return;
    }
    try {
      res.setHeader("set-cookie", issueAdminCookie());
      json(200, { authenticated: true });
    } catch {
      json(503, { error: "Sesi admin belum dikonfigurasi di server." });
    }
    return;
  }
  if (payload.action === "adminLogout") {
    res.setHeader("set-cookie", clearAdminCookie());
    json(200, { authenticated: false });
    return;
  }
  if (requiresAdmin(payload.action) && !isAdminAuthorized(cookieHeader)) {
    json(401, { error: "Akses admin dibatasi. Masuk melalui halaman admin terlebih dahulu." });
    return;
  }
  const { status, body } = await dispatchAction(payload.action, payload.args ?? {});
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
