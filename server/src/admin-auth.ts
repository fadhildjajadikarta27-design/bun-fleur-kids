import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "bfk_admin";
const DURATION_SECONDS = 8 * 60 * 60;

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function verifyPassword(password: string): boolean {
  const config = process.env.ADMIN_PASSWORD_HASH;
  if (!config) return false;
  const [salt, expected] = config.split(":");
  if (!salt || !expected || !/^[0-9a-f]{64}$/.test(expected)) return false;
  const derived = scryptSync(password, salt, 32).toString("hex");
  return safeEqual(derived, expected);
}

function signature(payload: string): string {
  const key = process.env.ADMIN_SESSION_SECRET;
  if (!key || key.length < 32) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function issueAdminCookie(): string {
  const expires = Math.floor(Date.now() / 1000) + DURATION_SECONDS;
  const payload = `${expires}.${randomBytes(18).toString("base64url")}`;
  const token = `${payload}.${signature(payload)}`;
  return `${COOKIE_NAME}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURATION_SECONDS}`;
}

export function clearAdminCookie(): string {
  return `${COOKIE_NAME}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAdminAuthorized(cookieHeader: string | undefined): boolean {
  if (!process.env.ADMIN_PASSWORD_HASH || !process.env.ADMIN_SESSION_SECRET) return false;
  const token = (cookieHeader ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiry, nonce, mac] = parts;
  if (!expiry || !nonce || !mac || !/^\d{10}$/.test(expiry)) return false;
  const expiration = Number(expiry);
  const now = Math.floor(Date.now() / 1000);
  if (expiration <= now || expiration > now + DURATION_SECONDS) return false;
  try { return safeEqual(signature(`${expiry}.${nonce}`), mac); }
  catch { return false; }
}

const PUBLIC_ACTIONS = new Set([
  "getSettings", "getShopConfig", "listProjects", "createProject", "updateProject",
  "deleteProject", "generateCharacter", "getTemplateQc", "listTemplateVersions",
  "createOrder", "trackOrder", "validateCoupon", "confirmTransfer",
  "getInvitation", "acceptInvitation", "affiliateLogin", "affiliateRequestPinReset",
  "resetPinWithToken", "affiliateLogout", "affiliateMe", "affiliateUpdateCoupon", "affiliateRequestPayout",
  "getAffiliateConfig", "affiliateApply",
  "getBirthdayCatalog", "createBirthdayEvent", "listMyBirthdayEvents",
  "getGameAccess", "startGameTrial", "createGamePurchase", "reportGamePayment",
  "getCoinWallet", "claimDailyCoin", "startCoinPlay", "recordCoinMinute",
]);

export function requiresAdmin(action: string): boolean {
  return !PUBLIC_ACTIONS.has(action);
}

const VISITOR_COOKIE = "bfk_visitor";
const VISITOR_AGE = 365 * 24 * 60 * 60;

/** Anonymous, signed visitor identity: not a login, but isolates artwork per browser. */
export function visitorFromCookie(header: string | undefined): { id: string; cookie?: string } {
  const raw = (header ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))?.slice(VISITOR_COOKIE.length + 1);
  if (raw) {
    const [id, mac] = raw.split(".");
    if (id && mac && /^[a-f0-9]{32}$/.test(id)) {
      try {
        if (safeEqual(signature("visitor:" + id), mac)) return { id };
      } catch { /* rotate invalid visitor session */ }
    }
  }
  const id = randomBytes(16).toString("hex");
  return {
    id,
    cookie: `${VISITOR_COOKIE}=${id}.${signature("visitor:" + id)}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${VISITOR_AGE}`,
  };
}
