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
  const { status, body } = await dispatchAction(payload.action, payload.args ?? {});
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
