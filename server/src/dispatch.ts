// Action dispatch core for the standalone port.
//
// Protocol: POST /api/actions with JSON { action: string, args: object }.
// The action's zod request schema validates the args (400 on failure), the
// handler runs with the ported Ctx, and its return value is sent back as
// JSON. Handler-thrown Errors become 400 { error }. Unknown actions 404.
//
// This module is shared by the Vercel Function (api/actions.ts) and the
// local dev server (scripts/dev-server.mjs).

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Actions } from "./actions.js";
import { ensureMigrations, getDb } from "./db.js";
import { z, type ActionDef, type Ctx } from "./sdk.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actionsMap = Actions as unknown as Record<string, ActionDef<any, any>>;

/* ------------------------- ctx.inference ------------------------- */
// "Buat dengan AI" (generateCharacter) is the only inference consumer.
// Without an OPENAI_API_KEY the feature must fail honestly rather than
// fabricate a character — the UI then steers parents to the manual
// "Rakit dari Bagian" mode.
async function inferenceComplete<T extends z.ZodType>(
  prompt: string,
  opts: { schema: T; timeout_secs?: number },
): Promise<z.infer<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Fitur Buat dengan AI belum dikonfigurasi di server (butuh OPENAI_API_KEY). Gunakan mode Rakit dari Bagian.",
    );
  }
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const timeoutMs = (opts.timeout_secs ?? 60) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const jsonSchema = z.toJSONSchema(opts.schema);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Answer with JSON only — a single JSON object matching this JSON Schema, no prose, no code fences:\n" +
              JSON.stringify(jsonSchema),
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`OpenAI request failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response.");
    return opts.schema.parse(JSON.parse(content));
  } finally {
    clearTimeout(timer);
  }
}

const ctx: Omit<Ctx, "visitorId" | "isAdmin"> = {
  // getDb() is built with this app's schema (server/src/schema.ts), which
  // is the only schema actions ever request via ctx.db<typeof schema>().
  db: <TSchema extends Record<string, unknown>>() =>
    getDb() as unknown as PostgresJsDatabase<TSchema>,
  invalidateQueries: () => {
    // The Space runtime used this to bust its hosted query cache. The
    // standalone client refetches through react-query itself, so there is
    // nothing to invalidate server-side.
  },
  inference: { complete: inferenceComplete },
};

/* --------------------------- dispatch ---------------------------- */

export interface DispatchResult {
  status: number;
  body: unknown;
}

export async function dispatchAction(action: string, args: unknown, visitorId = "local-dev", isAdmin = false): Promise<DispatchResult> {
  const def = actionsMap[action];
  if (!def) {
    return { status: 404, body: { error: `Unknown action: ${action}` } };
  }
  // Validate input before touching the database, so invalid form data
  // receives an actionable 400 even during a database outage.
  const parsed = def.request.safeParse(args ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: 400, body: { error: issue?.message ?? "Data formulir tidak valid." } };
  }
  try {
    await ensureMigrations();
    const result = await def.handler({ ...ctx, visitorId, isAdmin }, parsed.data);
    // Lenient response validation: a mismatch is a server bug worth
    // logging, but the client is better served by the raw value than by
    // turning a cosmetic schema drift into a hard failure.
    const check = def.response.safeParse(result);
    if (!check.success) {
      console.warn(`[actions] ${action}: response did not match its schema: ${check.error.message}`);
    }
    return { status: 200, body: result };
  } catch (err) {
    // Do not leak database connection details or raw Postgres errors to browsers.
    // Keep application validation errors as 400; database outages are 503.
    const code = err !== null && typeof err === "object" && "code" in err
      ? String(err.code) : "";
    if (code === "28P01" || (err instanceof Error && /password authentication failed/i.test(err.message))) {
      console.error("[actions] Postgres authentication rejected (28P01).");
      return { status: 503, body: { error: "Database belum terhubung. Periksa DATABASE_URL di Vercel dan deploy ulang." } };
    }
    if (err instanceof Error && /DATABASE_URL is not set|database connection|Failed to apply migration/i.test(err.message)) {
      console.error("[actions] Database configuration or migration unavailable:", err.message);
      return { status: 503, body: { error: "Layanan database sedang bermasalah. Periksa konfigurasi server." } };
    }
    return { status: 400, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}
