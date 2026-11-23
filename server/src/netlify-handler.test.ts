import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { scryptSync } from "node:crypto";
import netlifyHandler from "../../netlify/functions/actions.js";

const savedHash = process.env.ADMIN_PASSWORD_HASH;
const savedSecret = process.env.ADMIN_SESSION_SECRET;
const savedSkip = process.env.BFK_SKIP_MIGRATIONS;

function request(action: string, args: unknown = {}, extras: Record<string, string> = {}) {
  return new Request("https://bun-fleur-kids.netlify.app/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json", ...extras },
    body: JSON.stringify({ action, args }),
  });
}
async function body(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "sample-netlify-session-secret-more-than-32-characters";
  const salt = "netlify-test-salt";
  process.env.ADMIN_PASSWORD_HASH = salt + ":" + scryptSync("sample-passphrase", salt, 32).toString("hex");
});
afterEach(() => {
  if (savedHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = savedHash;
  if (savedSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = savedSecret;
  if (savedSkip === undefined) delete process.env.BFK_SKIP_MIGRATIONS;
  else process.env.BFK_SKIP_MIGRATIONS = savedSkip;
});

describe("Netlify API compatibility", () => {
  test("rejects GET and invalid payloads", async () => {
    const getRes = await netlifyHandler(new Request("https://bun-fleur-kids.netlify.app/api/actions"));
    expect(getRes.status).toBe(405);
    const invalid = await netlifyHandler(new Request("https://bun-fleur-kids.netlify.app/api/actions", {
      method: "POST", body: "not-json",
    }));
    expect(invalid.status).toBe(400);
  });

  test("checks admin authentication without hitting the database", async () => {
    const status = await netlifyHandler(request("adminStatus"));
    expect(status.status).toBe(200);
    expect((await body(status)).authenticated).toBe(false);
    expect(status.headers.getSetCookie().some((v) => v.startsWith("bfk_visitor="))).toBe(true);
    const denied = await netlifyHandler(request("adminListAffiliates"));
    expect(denied.status).toBe(401);
  });

  test("enforces same-origin admin login and issues signed HttpOnly cookie", async () => {
    const forbidden = await netlifyHandler(request("adminLogin", { password: "sample-passphrase" }, {
      origin: "https://external.example",
    }));
    expect(forbidden.status).toBe(403);
    const login = await netlifyHandler(request("adminLogin", { password: "sample-passphrase" }));
    expect(login.status).toBe(200);
    const cookies = login.headers.getSetCookie();
    const admin = cookies.find((v) => v.startsWith("bfk_admin="));
    expect(admin).toContain("HttpOnly");
    const check = await netlifyHandler(request("adminStatus", {}, { cookie: admin!.split(";")[0]! }));
    expect((await body(check)).authenticated).toBe(true);
  });

  test("public affiliate form rejects bad WhatsApp and consent without DB access", async () => {
    const invalid = await netlifyHandler(request("affiliateApply", {
      fullName: "Mitra Contoh", email: "mitra@example.com", whatsapp: "not-a-number", consent: true,
    }));
    expect(invalid.status).toBe(400);
    const refused = await netlifyHandler(request("affiliateApply", {
      fullName: "Mitra Contoh", email: "mitra@example.com", whatsapp: "081234567890", consent: false,
    }));
    expect(refused.status).toBe(400);
    expect(process.env.BFK_SKIP_MIGRATIONS).toBe("1");
  });

  test("unknown action returns 404 without using database", async () => {
    const res = await netlifyHandler(request("unknownAction"));
    expect(res.status).toBe(404);
  });
});
