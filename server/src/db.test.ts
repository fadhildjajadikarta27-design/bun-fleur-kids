import { describe, expect, test } from "bun:test";
import { ensureMigrations } from "./db.js";

describe("production schema bootstrap policy", () => {
  test("does not perform database migrations during production API requests", async () => {
    const before = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    try {
      // No DATABASE_URL is available in this unit test. Production
      // dispatch must not query or mutate the schema on cold start.
      await expect(ensureMigrations()).resolves.toBeUndefined();
    } finally {
      if (before === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = before;
    }
  });
});
