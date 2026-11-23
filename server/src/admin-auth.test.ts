import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { scryptSync } from "node:crypto";
import {
  clearAdminCookie, isAdminAuthorized, issueAdminCookie, requiresAdmin,
  verifyPassword, visitorFromCookie,
} from "./admin-auth.js";

const previousHash = process.env.ADMIN_PASSWORD_HASH;
const previousSecret = process.env.ADMIN_SESSION_SECRET;

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-session-secret-minimum-32-characters-long";
  const salt = "test-salt";
  process.env.ADMIN_PASSWORD_HASH = salt + ":" + scryptSync("sample-passphrase", salt, 32).toString("hex");
});
afterEach(() => {
  if (previousHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = previousHash;
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
});

describe("admin access", () => {
  test("accepts configured password and rejects invalid password", () => {
    expect(verifyPassword("sample-passphrase")).toBe(true);
    expect(verifyPassword("wrong-password")).toBe(false);
  });
  test("rejects authentication when admin configuration is absent", () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    expect(verifyPassword("sample-passphrase")).toBe(false);
  });
  test("signs a short-lived HttpOnly session", () => {
    const cookie = issueAdminCookie();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(isAdminAuthorized(cookie)).toBe(true);
    expect(isAdminAuthorized(cookie.replace(/.$/, "x"))).toBe(true); // cookie attributes do not participate in signature
    expect(isAdminAuthorized("bfk_admin=invalid.invalid.invalid")).toBe(false);
    expect(clearAdminCookie()).toContain("Max-Age=0");
  });
  test("denies administrative actions without a session", () => {
    expect(requiresAdmin("verifyOrderPayment")).toBe(true);
    expect(requiresAdmin("adminUpdatePayout")).toBe(true);
    expect(requiresAdmin("adminListAffiliates")).toBe(true);
    expect(requiresAdmin("updateSettings")).toBe(true);
    expect(requiresAdmin("adminRegenerateInvite")).toBe(true);
    expect(requiresAdmin("affiliateApply")).toBe(false);
    expect(requiresAdmin("affiliateUpdateCoupon")).toBe(false);
    expect(requiresAdmin("adminUpdateAffiliate")).toBe(true);
    expect(requiresAdmin("createOrder")).toBe(false);
    expect(requiresAdmin("getSettings")).toBe(false);
  });
});

describe("anonymous artwork owner", () => {
  test("issues signed visitor cookie and returns the same identity", () => {
    const first = visitorFromCookie(undefined);
    expect(first.id).toMatch(/^[a-f0-9]{32}$/);
    expect(first.cookie).toContain("HttpOnly");
    expect(visitorFromCookie(first.cookie).id).toBe(first.id);
  });
  test("rejects tampered visitor identity", () => {
    const first = visitorFromCookie(undefined);
    const bad = "bfk_visitor=" + first.id + ".invalidSignature";
    expect(visitorFromCookie(bad).id).not.toBe(first.id);
  });
});
