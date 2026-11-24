import assert from "node:assert/strict";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import postgres from "postgres";
import { closeDatabase, ensureMigrations } from "../server/src/db.ts";
import handler from "../netlify/functions/actions.ts";

const testUrl = new URL(process.env.BFK_TEST_DATABASE_URL ?? "postgres://invalid/invalid");
if (!["localhost", "127.0.0.1", "[::1]"].includes(testUrl.hostname) || !/^\/bfk_(test|audit)[a-z0-9_]*$/.test(testUrl.pathname)) {
  throw new Error("BFK_TEST_DATABASE_URL must point to a disposable loopback bfk_test or bfk_audit database.");
}
process.env.DATABASE_URL = testUrl.href;
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString("hex");
const password = randomBytes(18).toString("hex");
const salt = randomBytes(16).toString("hex");
process.env.ADMIN_PASSWORD_HASH = salt + ":" + scryptSync(password, salt, 32).toString("hex");

const sql = postgres(testUrl.href);
const token = randomBytes(5).toString("hex");
const phone = "08" + String(parseInt(token.slice(0, 8), 16)).padStart(10, "0");
const digits = phone.slice(1);

async function call(action, args = {}, { cookie = "", ip = "127.10.1.1", expected = 200 } = {}) {
  const response = await handler(new Request("https://bfk-local.test/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ action, args }),
  }), { ip });
  const body = await response.json();
  assert.equal(response.status, expected, `${action}: ${JSON.stringify(body)}`);
  return { body, cookie: response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") };
}

try {
  await ensureMigrations();
  const migrations = await sql`SELECT name FROM __port_migrations ORDER BY name`;
  assert.equal(migrations.at(-1).name, "0013_catalog_prices.sql");
  assert.equal((await sql`SELECT has_table_privilege('anon', 'public.payment_proofs', 'SELECT') AS allowed`)[0].allowed, false);

  const first = await call("listProjects");
  const second = await call("listProjects");
  const owner = { cookie: first.cookie };
  const guest = { cookie: second.cookie };
  const project = (await call("createProject", {
    templateId: "pb-dino", childName: "QA Artwork", nameColor: "#E4572E", nameFont: "baloo",
    message: "", nameAlign: "center", colors: { body: "#AB57CC" }, strokes: [],
    customDef: "", status: "done",
  }, owner)).body.project;
  assert.equal((await call("listProjects", {}, owner)).body.projects[0].id, project.id);
  assert.equal((await call("listProjects", {}, guest)).body.projects.length, 0);
  await call("listOrders", {}, { expected: 401 });
  await call("adminGetPaymentProof", { id: 1 }, { expected: 401 });
  const admin = { cookie: (await call("adminLogin", { password })).cookie };
  assert.equal((await call("adminStatus", {}, admin)).body.authenticated, true);
  assert.equal((await call("listProjects", {}, { cookie: admin.cookie + "; " + guest.cookie })).body.projects.length, 0);
  console.log("PASS migrations, RLS privileges, private artwork, authenticated admin");

  const affiliateArgs = { fullName: "QA Affiliate", email: `${token}@example.test`, whatsapp: "+62" + digits,
    pin: "5073", consent: true, couponCode: "QA" + token };
  const registration = await call("affiliateApply", affiliateArgs);
  const registered = registration.body;
  const affiliateSession = { cookie: registration.cookie };
  assert.equal(registered.affiliate.commissionPct, 30);
  await call("adminListAffiliates", {}, { expected: 401 });
  const newAffiliate = (await call("adminListAffiliates", {}, admin)).body.affiliates[0];
  assert.equal(newAffiliate.id, registered.affiliate.id);
  assert.equal(newAffiliate.status, "active");
  assert.equal(newAffiliate.inviteState, "none");
  assert.equal(newAffiliate.hasPin, true);
  assert.equal(newAffiliate.totalOrders, 0);
  assert.equal(newAffiliate.pendingPayout, 0);
  assert.equal("pinHash" in newAffiliate, false);
  const invited = (await call("adminCreateAffiliate", {
    fullName: "QA Invited Affiliate", email: `invited-${token}@example.test`,
    whatsapp: phone.slice(0, 2) + (phone[2] === "9" ? "8" : "9") + phone.slice(3), couponCode: "INV" + token,
  }, admin)).body;
  const regenerated = (await call("adminRegenerateInvite", { affiliateId: invited.affiliate.id }, admin)).body;
  const affiliateList = (await call("adminListAffiliates", {}, admin)).body.affiliates;
  const invitedRow = affiliateList.find(({ id }) => id === invited.affiliate.id);
  assert.equal(invitedRow.inviteState, "pending");
  assert.equal(invitedRow.inviteToken, regenerated.inviteToken);
  assert.equal(invitedRow.hasPin, false);
  assert.notEqual(invitedRow.inviteToken, invited.inviteToken);
  console.log("PASS self-registration appears in admin list; latest legacy invite stays visible");
  await call("affiliateApply", { ...affiliateArgs, whatsapp: phone, email: `duplicate-${token}@example.test`, couponCode: "DUP" + token }, { expected: 400 });
  const coupon = (await call("validateCoupon", { code: affiliateArgs.couponCode })).body;
  assert.equal(coupon.discountPct, 10);
  assert.equal((await call("validateCoupon", { code: "INVALID" })).body.valid, false);
  const login = await call("affiliateLogin", { identifier: phone, pin: "5073" });
  const loggedIn = login.body;
  assert.equal(loggedIn.sessionToken, "cookie-session");
  assert.equal(loggedIn.affiliate.id, registered.affiliate.id);
  const account = await sql`SELECT pin_hash FROM affiliates WHERE id = ${registered.affiliate.id}`;
  assert.notEqual(account[0].pin_hash, "5073");
  const sessionRows = await sql`SELECT token FROM affiliate_sessions WHERE affiliate_id = ${registered.affiliate.id}`;
  assert.ok(sessionRows.every(({ token }) => !login.cookie.includes(token) && !registration.cookie.includes(token)));
  await Promise.all(Array.from({ length: 5 }, () => call("affiliateLogin", { identifier: phone, pin: "6192" }, { expected: 400 })));
  const locked = await call("affiliateLogin", { identifier: phone, pin: "5073" }, { expected: 400 });
  assert.match(locked.body.error, /terkunci/);
  console.log("PASS affiliate signup, phone normalization, coupon, hashed PIN and token, concurrent PIN lockout");

  const orderArgs = {
    checkoutId: randomUUID(), quantity: 5, projectId: project.id, productType: "papercraft", childName: "",
    customerName: "QA Parent", whatsapp: phone, email: `parent-${token}@example.test`,
    address: "Jalan Pengujian, Jakarta, Indonesia", couponCode: coupon.code, productPrice: 1, total: 1,
  };
  await call("createOrder", orderArgs, { ...guest, expected: 400 });
  const results = await Promise.all([call("createOrder", orderArgs, owner), call("createOrder", orderArgs, owner),
    call("createOrder", { ...orderArgs, checkoutId: randomUUID() }, owner)]);
  const [order, retry, another] = results.map(({ body }) => body.order);
  assert.equal(order.id, retry.id);
  assert.notEqual(order.id, another.id);
  assert.notEqual(order.payableTotal, another.payableTotal);
  assert.equal(order.productPrice, 245000);
  assert.equal(order.discountAmount, 24500);
  assert.equal(order.childName, "");
  assert.deepEqual(order.colors, project.colors);
  await call("updateOrder", { id: order.id, paymentStatus: "paid" }, { ...admin, expected: 400 });
  await call("updateOrder", { id: order.id, shippingCost: 12000 }, admin);
  assert.equal((await call("trackOrder", { code: order.code, whatsapp: "089000000000" })).body.order, null);
  const tracked = (await call("trackOrder", { code: order.code, whatsapp: "+62" + digits })).body.order;
  assert.equal(tracked.shippingCost, 12000);
  assert.equal(tracked.address, "");
  const data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR7sAAAAASUVORK5CYII=";
  await call("confirmTransfer", { code: order.code, whatsapp: phone, proof: { mime: "image/jpeg", data } }, { expected: 400 });
  const confirmation = await call("confirmTransfer", { code: order.code, whatsapp: phone, proof: { mime: "image/png", data } });
  assert.equal(confirmation.body.payState, "waiting_verification");
  const adminProof = await call("adminGetPaymentProof", { id: order.id }, admin);
  assert.equal(adminProof.body.proof.data, data);
  assert.equal((await call("trackOrder", { code: order.code, whatsapp: phone })).body.order.paymentStatus, "waiting_verification");
  const decision = { decision: "verify", paymentReference: "QA-" + token };
  await call("verifyOrderPayment", { id: order.id, decision: "verify" }, { ...admin, expected: 400 });
  const paid = await call("verifyOrderPayment", { ...decision, id: order.id }, admin);
  assert.equal(paid.body.order.paymentStatus, "paid");
  await call("verifyOrderPayment", { ...decision, id: another.id }, { ...admin, expected: 400 });
  await call("updateOrder", { id: order.id, orderStatus: "completed" }, admin);
  await call("updateOrder", { id: order.id, orderStatus: "completed" }, admin);
  const commission = await sql`SELECT status, amount FROM commissions WHERE order_id = ${order.id}`;
  assert.equal(commission.length, 1);
  assert.deepEqual(commission[0], { status: "payable", amount: 66150 });
  console.log("PASS verified-only payment, QRIS uniqueness, idempotent checkout, proofs, tracking and commissions");

  const requestPayout = { sessionToken: registered.sessionToken, amount: 50000,
    bankName: "Bank QA", accountName: "QA Affiliate", accountNumber: "10001234" };
  const [{ body: payout }] = await Promise.all([
    call("affiliateRequestPayout", requestPayout, affiliateSession),
    call("affiliateRequestPayout", { ...requestPayout, amount: 67000 }, { ...affiliateSession, expected: 400 }),
  ]);
  const accountSummary = (await call("adminListAffiliates", {}, admin)).body.affiliates.find(({ id }) => id === registered.affiliate.id);
  assert.equal(accountSummary.totalOrders, 1);
  assert.equal(accountSummary.netSales, 220500);
  assert.equal(accountSummary.totalCommission, 66150);
  assert.equal(accountSummary.pendingPayout, 50000);
  await call("adminUpdatePayout", { id: payout.payoutId, decision: "approve" }, admin);
  await call("adminUpdatePayout", { id: payout.payoutId, decision: "paid" }, admin);
  await call("adminUpdatePayout", { id: payout.payoutId, decision: "paid" }, admin);
  const wallet = (await call("affiliateMe", { sessionToken: registered.sessionToken }, affiliateSession)).body;
  assert.equal(wallet.wallet.paid, 50000);
  assert.equal(wallet.availablePayout, 16150);
  console.log("PASS payout approval, partial commission settlement, idempotent payout and wallet balance");

  const summary = (await call("listOrders", { limit: 1 }, admin)).body;
  assert.equal(summary.orders.length, 1);
  assert.ok(summary.orderCount >= 2 && summary.paidCount >= 1 && summary.netProductRevenue >= 220500);
  await call("adminSetProductPrice", { productId: "puzzle", price: 60000 }, { expected: 401 });
  await call("adminSetProductPrice", { productId: "puzzle", price: 60000 }, admin);
  const catalog = (await call("getShopConfig")).body;
  assert.equal(catalog.products.find(({ id }) => id === "puzzle").basePrice, 60000);
  await call("adminSetProductPrice", { productId: "puzzle", price: 59000 }, admin);
  console.log("PASS admin metrics, paginated orders and authorized catalog price changes");
} finally {
  await sql.end();
  await closeDatabase();
}
