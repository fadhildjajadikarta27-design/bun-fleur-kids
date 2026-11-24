// Database access for the standalone port.
//
// The Space runtime handed actions a drizzle SQLite database. Here the
// same logical schema (server/src/schema.ts, converted to pg-core) runs
// on Postgres via postgres.js + drizzle-orm/postgres-js — in production a
// Supabase database, reached through its transaction pooler.
//
// Connection: the DATABASE_URL env var (a Postgres connection string).
// On Vercel/Supabase use the transaction-pooler form (port 6543);
// postgres.js is configured with `prepare: false`, which the transaction
// pooler requires, and a single connection per function instance, which
// suits serverless. For local dev, DATABASE_URL may point at any local
// Postgres. There is no file fallback anymore: without DATABASE_URL the
// first dispatch fails with a clear configuration error.
//
// Migrations: the drizzle/*.sql files (Postgres dialect) are applied
// lazily, once per process, in filename order. Applied files are recorded
// in a __port_migrations table so restarts skip them.
// NOTE: Schema bootstrap is already complete in production; deploy future
// schema migrations through a coordinated migration job before production
// traffic, not concurrent serverless requests on a transaction pooler.

import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.js";

type Db = PostgresJsDatabase<typeof schema>;

let client: Sql | undefined;
let dbInstance: Db | undefined;

export function getDb(): Db {
  if (!dbInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. The standalone port needs a Postgres connection string " +
          "(in production: the Supabase transaction-pooler URL, port 6543).",
      );
    }
    client = postgres(url, { prepare: false, max: 1, idle_timeout: 30, connect_timeout: 5 });
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  await client?.end({ timeout: 3 });
  client = undefined;
  dbInstance = undefined;
  migrationsPromise = undefined;
}

function migrationsDir(): string {
  const candidates = [
    join(process.cwd(), "drizzle"),
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "drizzle"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(`drizzle migrations directory not found (looked in: ${candidates.join(", ")})`);
}

let migrationsPromise: Promise<void> | undefined;

/** Applies any not-yet-applied drizzle/*.sql files. Safe to call often. */
export function ensureMigrations(): Promise<void> {
  if (!migrationsPromise) {
    migrationsPromise = applyMigrations().catch((err) => {
      // Allow a later call to retry if the first attempt failed.
      migrationsPromise = undefined;
      throw err;
    });
  }
  return migrationsPromise;
}

async function applyMigrations(): Promise<void> {
  getDb();
  if (!client) throw new Error("postgres client not initialized");
  const sql = client;
  const files = readdirSync(migrationsDir()).filter((file) => file.endsWith(".sql")).sort();
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(82134790)`;
    await tx`CREATE TABLE IF NOT EXISTS __port_migrations (name text PRIMARY KEY, applied_at bigint NOT NULL)`;
    const rows = await tx<{ name: string }[]>`SELECT name FROM __port_migrations`;
    const applied = new Set(rows.map(({ name }) => name));
    for (const file of files) {
      if (applied.has(file)) continue;
      const statements = readFileSync(join(migrationsDir(), file), "utf8").split("--> statement-breakpoint");
      try {
        for (const statement of statements) {
          if (statement.trim()) await tx.unsafe(statement);
        }
        await tx`INSERT INTO __port_migrations (name, applied_at) VALUES (${file}, ${Date.now()})`;
      } catch (cause) {
        throw new Error(`Failed to apply migration ${file}`, { cause });
      }
    }
  });
}

export async function consumeRateLimit(action: string, ip: string | undefined, limit: number, seconds: number): Promise<boolean> {
  getDb();
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const clientKey = ip && isIP(ip) ? ip : "shared";
  const key = createHash("sha256").update(JSON.stringify([secret, action, clientKey])).digest("hex");
  const [row] = await client!<{ attempts: number }[]>`
    INSERT INTO request_limits (key, attempts, expires_at)
    VALUES (${key}, 1, now() + ${seconds} * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN request_limits.expires_at <= now() THEN 1
                      ELSE LEAST(request_limits.attempts + 1, ${limit + 1}) END,
      expires_at = CASE WHEN request_limits.expires_at <= now() THEN EXCLUDED.expires_at
                        ELSE request_limits.expires_at END
    RETURNING attempts`;
  return !!row && row.attempts <= limit;
}
