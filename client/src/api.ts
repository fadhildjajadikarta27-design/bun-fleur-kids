// Typed RPC client. Types come straight from `server/src/actions.ts` — no
// codegen. `createActionClient` returns a proxy that POSTs `{action, args}`
// to `/api/actions` (the Vercel Function in api/actions.ts, backed by
// server/src/dispatch.ts) and returns the typed response.
//
// `import type { Actions }` is type-only by design: the client bundle never
// pulls in any server runtime (libsql, file APIs, etc.). With
// `verbatimModuleSyntax: true`, dropping `type` is a compile error.

import type { Actions } from "../../server/src/actions";
import type { z } from "zod";

/** The callable client surface derived from an Actions map. */
export type ActionClient<A> = {
  [K in keyof A]: A[K] extends { request: infer Req extends z.ZodType; response: infer Res extends z.ZodType }
    ? (args: z.input<Req>) => Promise<z.output<Res>>
    : never;
};

// Re-exported for convenience so client code can do
//
//     import { api, type ApiResponse } from "./api";
//     type Project = ApiResponse<typeof api, "listProjects">["projects"][number];
export type ApiRequest<TClient, K extends keyof TClient> =
  TClient[K] extends (args: infer P) => Promise<unknown> ? P : never;
export type ApiResponse<TClient, K extends keyof TClient> =
  TClient[K] extends (args: never) => Promise<infer R> ? R : never;

async function callAction(action: string, args: unknown): Promise<unknown> {
  const timeout = action === "adminListAffiliates" ? 15_000
    : action === "adminCreateAffiliate" || action === "affiliateApply" ? 30_000 : undefined;
  let res: Response;
  let data: unknown;
  try {
    res = await fetch("/api/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, args: args ?? {} }),
      signal: timeout === undefined ? undefined : AbortSignal.timeout(timeout),
    });
    data = await res.json().catch((err: unknown) => {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) throw err;
      return null;
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      if (action === "adminListAffiliates") throw new Error("Server terlalu lama memuat daftar afiliasi.");
      if (action === "affiliateApply") throw new Error("Pendaftaran terlalu lama. Jangan mengirim berulang-ulang; hubungi tim Bun & Fleur Kids jika tidak ada kabar lewat WhatsApp.");
      if (action === "adminCreateAffiliate") throw new Error("Pembuatan afiliasi terlalu lama. Periksa daftar afiliasi sebelum mencoba lagi, agar tidak membuat duplikat.");
    }
    throw err;
  }
  if (res.ok && action === "adminListAffiliates" &&
      (!data || typeof data !== "object" || !("affiliates" in data) || !Array.isArray(data.affiliates))) {
    throw new Error("Server mengirim respons daftar afiliasi yang tidak valid.");
  }
  if (!res.ok) {
    const message =
      data !== null && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Action ${action} gagal (${res.status}).`;
    if (action === "adminListAffiliates" && res.status === 401) throw new Error("Sesi admin berakhir. Masuk kembali.");
    throw new Error(message);
  }
  return data;
}

export function createActionClient<A>(): ActionClient<A> {
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        return (args: unknown) => callAction(prop, args);
      },
    },
  );
  return proxy as ActionClient<A>;
}

export const api = createActionClient<typeof Actions>();
