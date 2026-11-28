import { clearAdminCookie, isAdminAuthorized, issueAdminCookie, verifyPassword, visitorFromCookie } from "./admin-auth.js";
import { dispatchAction } from "./dispatch.js";
import { consumeRateLimit, ensureMigrations } from "./db.js";

const AFFILIATE_COOKIE = "bfk_affiliate";
const AFFILIATE_SESSION_ACTIONS = new Set(["affiliateLogout", "affiliateMe", "affiliateUpdateCoupon", "affiliateRequestPayout"]);
const AFFILIATE_LOGIN_ACTIONS = new Set(["affiliateLogin", "affiliateApply", "acceptInvitation", "resetPinWithToken"]);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

async function readPayload(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let payload = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(payload + decoder.decode());
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RangeError();
      }
      payload += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function handleActions(request: Request, options: { local?: boolean; ip?: string; localOrigin?: string; limit?: typeof consumeRateLimit } = {}): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (request.method !== "POST") {
    headers.set("allow", "POST");
    return json(405, { error: "Gunakan metode POST." });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== (options.localOrigin ?? new URL(request.url).origin)) {
    return json(403, { error: "Permintaan dari situs lain ditolak." });
  }
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return json(415, { error: "Kirim data dengan Content-Type application/json." });
  }
  let payload: unknown;
  try {
    payload = await readPayload(request);
  } catch (err) {
    return err instanceof RangeError
      ? json(413, { error: "Ukuran permintaan terlalu besar." })
      : json(400, { error: "Format JSON tidak valid." });
  }
  if (!payload || typeof payload !== "object" || !("action" in payload) ||
      typeof payload.action !== "string" || !/^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(payload.action)) {
    return json(400, { error: "Nama tindakan tidak valid." });
  }
  const { action } = payload;
  let args = "args" in payload ? payload.args : undefined;
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const authenticated = isAdminAuthorized(cookieHeader);
  if (action === "adminStatus") return json(200, { authenticated });
  if (action === "adminLogout") {
    headers.append("set-cookie", clearAdminCookie());
    return json(200, { authenticated: false });
  }
  try {
    if (["hollySignup","hollySignin","hollyMe","hollyReferral","hollySignout","hollyProgress","hollySendVerification","hollyVerifyEmail"].includes(action)) {
      // Private QA only until email verification, recovery and authoritative gameplay exist.
      if (!options.local && process.env.HOLLY_LUNA_PREVIEW_ENABLED !== "true") return json(503,{error:"Akun Holly & Luna belum dibuka untuk publik."});
      const token=cookieHeader?.split(";").map(p=>p.trim()).find(p=>p.startsWith("hl_session="))?.slice(11)??"";
      args={...(args&&typeof args==="object"?args:{}),sessionToken:/^[a-f0-9]{64}$/.test(token)?token:""};
      const result=await dispatchAction(action,args,"",false,{local:options.local===true,ip:options.ip});
      if(result.status===200&&["hollySignup","hollySignin"].includes(action)&&result.body&&typeof result.body==="object"&&"sessionToken" in result.body){
        const {sessionToken,...body}=result.body;
        headers.append("set-cookie","hl_session="+sessionToken+"; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=604800");
        return json(200,body);
      }
      if(result.status===200&&action==="hollySignout")headers.append("set-cookie","hl_session=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
      return json(result.status,result.body);
    }
    if (action === "adminLogin") {
      const password = args && typeof args === "object" && "password" in args ? args.password : undefined;
      if (typeof password !== "string" || password.length < 1 || password.length > 256) {
        return json(401, { error: "Password admin salah." });
      }
      if (options.local) await ensureMigrations();
      const rateLimit = options.limit ?? consumeRateLimit;
      if (!await rateLimit("adminLogin", options.ip, 8, 900)) {
        headers.set("retry-after", "900");
        return json(429, { error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." });
      }
      if (!verifyPassword(password)) return json(401, { error: "Password admin salah." });
      headers.append("set-cookie", issueAdminCookie());
      return json(200, { authenticated: true });
    }
    // Only project actions need a visitor identity. Static public reads and
    // affiliate requests must not race to overwrite the browser's first cookie.
    const usesVisitor = ["listProjects", "createProject", "updateProject", "deleteProject", "createOrder", "createBirthdayEvent", "listMyBirthdayEvents"].includes(action);
    const visitor = usesVisitor ? visitorFromCookie(cookieHeader) : { id: "" };
    if (visitor.cookie) headers.append("set-cookie", visitor.cookie);
    if (AFFILIATE_SESSION_ACTIONS.has(action)) {
      const visitorToken = cookieHeader?.split(";").map((part) => part.trim())
        .find((part) => part.startsWith(AFFILIATE_COOKIE + "="))?.slice(AFFILIATE_COOKIE.length + 1);
      if (!visitorToken || !/^[a-f0-9]{64}$/.test(visitorToken)) {
        return json(401, { error: "Sesi afiliasi tidak ditemukan. Silakan masuk lagi." });
      }
      args = { ...(args && typeof args === "object" ? args : {}), sessionToken: visitorToken };
    }
    const result = await dispatchAction(action, args, visitor.id, authenticated, { local: options.local === true, ip: options.ip });
    if (result.status === 200 && AFFILIATE_LOGIN_ACTIONS.has(action) && result.body &&
        typeof result.body === "object" && "sessionToken" in result.body) {
      headers.append("set-cookie", `${AFFILIATE_COOKIE}=${result.body.sessionToken}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
      return json(200, { ...result.body, sessionToken: "cookie-session" });
    }
    if (result.status === 200 && action === "affiliateLogout") {
      headers.append("set-cookie", `${AFFILIATE_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    }
    return json(result.status, result.body);
  } catch {
    return json(503, { error: "Layanan sementara tidak tersedia. Coba lagi sebentar." });
  }
}
