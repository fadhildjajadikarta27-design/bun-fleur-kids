// Database access for the standalone port.
//
// The Space runtime handed actions a drizzle SQLite database. Here the same
// schema (server/src/schema.ts, unchanged) runs on libSQL: a hosted Turso
// database when TURSO_DATABASE_URL is set, or a plain local file for dev.
//
// Migrations: the drizzle/*.sql files are applied lazily, once per process,
// in filename order. Applied files are recorded in a __port_migrations
// table so restarts skip them. The SQL is SQLite dialect, which libSQL
// accepts as-is.

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

type Db = LibSQLDatabase<typeof schema>;

let client: Client | undefined;
let dbInstance: Db | undefined;

export function getDb(): Db {
  if (!dbInstance) {
    const url = process.env.TURSO_DATABASE_URL ?? "file:./dev.db";
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
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
  if (!client) throw new Error("libsql client not initialized");
  const c = client;
  await c.execute(
    "CREATE TABLE IF NOT EXISTS __port_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const appliedRows = await c.execute("SELECT name FROM __port_migrations");
  const applied = new Set(appliedRows.rows.map((r) => String(r.name)));

  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    try {
      for (const statement of statements) {
        await c.executeMultiple(statement);
      }
      await c.execute({
        sql: "INSERT INTO __port_migrations (name, applied_at) VALUES (?, ?)",
        args: [file, Date.now()],
      });
    } catch (err) {
      throw new Error(
        `Failed to apply migration ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
