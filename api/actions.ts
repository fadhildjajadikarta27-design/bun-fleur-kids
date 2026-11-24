import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { handleActions } from "../server/src/http.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) headers.append(key, item);
  }
  const origin = `https://${headers.get("host") ?? "localhost"}`;
  const method = req.method ?? "GET";
  const parsedBody: unknown = (req as IncomingMessage & { body?: unknown }).body;
  const init: RequestInit & { duplex?: "half" } = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = parsedBody === undefined ? Readable.toWeb(req) as unknown as ReadableStream :
      typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody);
    if (parsedBody === undefined) init.duplex = "half";
  }
  // Vercel supplies this header at its edge. When missing, the limiter uses
  // a shared bucket instead of accepting a browser-supplied identifier.
  const ip = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const result = await handleActions(new Request(new URL("/api/actions", origin).href, init), ip ? { ip } : {});
  res.statusCode = result.status;
  result.headers.forEach((value, key) => {
    if (key !== "set-cookie") res.setHeader(key, value);
  });
  const cookies = result.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  res.end(await result.text());
}
