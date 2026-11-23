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
    client = postgres(url, { prepare: false, max: 1 });
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
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
  // applied_at is bigint: Date.now() epoch milliseconds exceed int4.
  await sql.unsafe(
    "CREATE TABLE IF NOT EXISTS __port_migrations (name text PRIMARY KEY, applied_at bigint NOT NULL)",
  );
  const appliedRows = await sql<{ name: string }[]>`SELECT name FROM __port_migrations`;
  const applied = new Set(appliedRows.map((r) => r.name));

  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const text = readFileSync(join(dir, file), "utf8");
    const statements = text
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    try {
      for (const statement of statements) {
        await sql.unsafe(statement);
      }
      await sql`INSERT INTO __port_migrations (name, applied_at) VALUES (${file}, ${Date.now()})`;
    } catch (err) {
      throw new Error(
        `Failed to apply migration ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
