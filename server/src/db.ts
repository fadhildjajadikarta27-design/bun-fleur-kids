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

  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Each Vercel function instance has its own in-memory migration promise.
  // Multiple cold starts can otherwise read the same old migration ledger
  // and try to create/drop the same tables simultaneously. A transaction-level
  // advisory lock serializes all instances, including those on different servers.
  // Keeping each batch atomic also prevents a failed migration from leaving
  // half-created tables without a corresponding ledger record.
  await client.begin(async (tx) => {
    await tx.unsafe("SELECT pg_advisory_xact_lock(726528302401)");
    await tx.unsafe(
      "CREATE TABLE IF NOT EXISTS __port_migrations (name text PRIMARY KEY, applied_at bigint NOT NULL)",
    );
    const appliedRows = await tx.unsafe("SELECT name FROM __port_migrations");
    const applied = new Set(appliedRows.map((r) => String(r.name)));

    for (const file of files) {
      if (applied.has(file)) continue;
      const text = readFileSync(join(dir, file), "utf8");
      const statements = text
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);
      try {
        for (const statement of statements) {
          await tx.unsafe(statement);
        }
        await tx`INSERT INTO __port_migrations (name, applied_at) VALUES (${file}, ${Date.now()})`;
      } catch (err) {
        throw new Error(
          `Failed to apply migration ${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  });
}
