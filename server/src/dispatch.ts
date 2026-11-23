// Action dispatch core for the standalone port.
//
// Protocol: POST /api/actions with JSON { action: string, args: object }.
// The action's zod request schema validates the args (400 on failure), the
// handler runs with the ported Ctx, and its return value is sent back as
// JSON. Handler-thrown Errors become 400 { error }. Unknown actions 404.
//
// This module is shared by the Vercel Function (api/actions.ts) and the
// local dev server (scripts/dev-server.mjs).

import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { Actions } from "./actions";
import { ensureMigrations, getDb } from "./db";
import { z, type ActionDef, type Ctx } from "./sdk";

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

const ctx: Ctx = {
  // getDb() is built with this app's schema (server/src/schema.ts), which
  // is the only schema actions ever request via ctx.db<typeof schema>().
  db: <TSchema extends Record<string, unknown>>() =>
    getDb() as unknown as LibSQLDatabase<TSchema>,
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

export async function dispatchAction(action: string, args: unknown): Promise<DispatchResult> {
  const def = actionsMap[action];
  if (!def) {
    return { status: 404, body: { error: `Unknown action: ${action}` } };
  }
  await ensureMigrations();
  const parsed = def.request.safeParse(args ?? {});
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.message } };
  }
  try {
    const result = await def.handler(ctx, parsed.data);
    // Lenient response validation: a mismatch is a server bug worth
    // logging, but the client is better served by the raw value than by
    // turning a cosmetic schema drift into a hard failure.
    const check = def.response.safeParse(result);
    if (!check.success) {
      console.warn(`[actions] ${action}: response did not match its schema: ${check.error.message}`);
    }
    return { status: 200, body: result };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}
