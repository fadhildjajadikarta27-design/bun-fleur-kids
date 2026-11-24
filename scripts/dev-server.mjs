import { handleActions } from "../server/src/http.ts";

const port = Number(process.env.PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Set DATABASE_URL to a local test PostgreSQL instance.");
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch(request, server) {
    if (new URL(request.url).pathname !== "/api/actions") return new Response(null, { status: 404 });
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    const localOrigin = /^(localhost|127[.]0[.]0[.]1|\[::1\])(:[0-9]{1,5})?$/.test(host) ? `http://${host}` : undefined;
    return handleActions(request, { local: true, localOrigin, ip: server.requestIP(request)?.address });
  },
});
console.log(`[dev-server] http://localhost:${port}/api/actions`);
