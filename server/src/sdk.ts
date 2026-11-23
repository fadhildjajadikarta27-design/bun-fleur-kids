// Local replacement for "@hatch/space-sdk" (standalone port).
//
// The Muse Space runtime provided three things to server/src/actions.ts:
// a zod re-export, a `defineAction` identity wrapper whose generics carry
// the request/response schema types to the client, and the `Ctx`/`ActionsModule`
// types. This shim reproduces exactly that surface so actions.ts itself only
// needed its import line changed. The runtime behaviour (HTTP dispatch, DB,
// inference) lives in ./dispatch.ts and ./db.ts.

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod";

export { z } from "zod";

/** Hosted-model completion, as used once by the generateCharacter action. */
export interface Inference {
  complete<T extends z.ZodType>(
    prompt: string,
    opts: { schema: T; timeout_secs?: number },
  ): Promise<z.infer<T>>;
}

/** The context object every action handler receives. */
export interface Ctx {
  db<TSchema extends Record<string, unknown> = Record<string, unknown>>(): PostgresJsDatabase<TSchema>;
  invalidateQueries(): void;
  inference: Inference;
}

export interface ActionDef<Req extends z.ZodType = z.ZodType, Res extends z.ZodType = z.ZodType> {
  description?: string;
  request: Req;
  response: Res;
  handler: (ctx: Ctx, args: z.infer<Req>) => Promise<z.infer<Res>> | z.infer<Res>;
}

/**
 * Identity at runtime — the value of defineAction is its type: it pins the
 * request/response zod schemas onto the action entry so the client can
 * extract ApiRequest/ApiResponse from `typeof Actions`.
 */
export function defineAction<Req extends z.ZodType, Res extends z.ZodType>(
  def: ActionDef<Req, Res>,
): ActionDef<Req, Res> {
  return def;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActionsModule = Record<string, ActionDef<any, any>>;
