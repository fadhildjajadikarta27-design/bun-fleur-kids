// Local dev/smoke-test server for the standalone port's API.
//
// Serves ONLY the action endpoint (POST /api/actions) on PORT (default
// 8787), using the exact same dispatch core as the Vercel Function.
// Run with bun (it imports the TypeScript sources directly):
//
//   bun scripts/dev-server.mjs
//
// Needs DATABASE_URL in the environment (any Postgres; in production the
// Supabase transaction-pooler connection string).

import { createServer } from "node:http";
import { dispatchAction } from "../server/src/dispatch.ts";

const port = Number(process.env.PORT ?? 8787);

const server = createServer(async (req, res) => {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST" || !req.url?.startsWith("/api/actions")) {
    send(404, { error: "Not found — this dev server only serves POST /api/actions." });
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    send(400, { error: "Request body must be JSON: { action, args }." });
    return;
  }
  if (typeof payload?.action !== "string" || payload.action.length === 0) {
    send(400, { error: "Request body must name an action." });
    return;
  }
  const { status, body } = await dispatchAction(payload.action, payload.args ?? {});
  send(status, body);
});

server.listen(port, () => {
  console.log(`[dev-server] POST /api/actions listening on http://localhost:${port}`);
});
