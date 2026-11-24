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
  assert.ok(migrations.some(m=>m.name==="0017_birthday_events.sql"));
  assert.ok(migrations.some(m=>m.name==="0018_bundles_gifts.sql"));
  assert.ok(migrations.some(m=>m.name==="0020_order_archive.sql"));
  assert.ok(migrations.some(m=>m.name==="0021_expand_lunchbox_tumbler.sql"));
  assert.ok(migrations.some(m=>m.name==="0022_order_background.sql"));
  assert.equal((await call("getShopConfig")).body.products.length,14);
  assert.equal((await sql`SELECT count(*)::int AS n FROM birthday_prices`)[0].n,14);
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
  const date=new Date();date.setUTCDate(date.getUTCDate()+35);
  const eventArgs={requestId:randomUUID(),eventName:"QA Birthday",childAge:4,eventDate:date.toISOString().slice(0,10),theme:"Dinosaurus",guestCount:20,productIds:["poster","papercraft"],expectedPerGuest:59800,organizer:"QA Parent",whatsapp:phone,address:"Alamat QA Jakarta"};
  const event=(await call("createBirthdayEvent",eventArgs,owner)).body.event;
  assert.equal(event.total,1196000);
  assert.equal((await call("createBirthdayEvent",eventArgs,owner)).body.event.id,event.id);
  assert.ok(!(await call("listMyBirthdayEvents",{},guest)).body.events.some(e=>e.id===event.id));
  await call("adminListBirthdayEvents",{},{expected:401});
  await call("adminUpdateBirthdayEvent",{id:event.id,status:"confirmed"},admin);
  await call("adminUpdateBirthdayEvent",{id:event.id,status:"paid",paidAmount:1,paymentReference:"BD-"+token},{...admin,expected:400});
  await call("adminUpdateBirthdayEvent",{id:event.id,status:"paid",paidAmount:event.total,paymentReference:"BD-"+token},admin);
  assert.ok((await call("adminListBirthdayEvents",{},admin)).body.paidRevenue>=event.total);
  console.log("PASS birthday event privacy, pricing, idempotency and payment validation");


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
  const allAccountIds = (await sql`SELECT id FROM affiliates ORDER BY id`).map(({ id }) => id);
  assert.deepEqual(affiliateList.map(({ id }) => id).sort((a, b) => a - b), allAccountIds);
  const selfRow = affiliateList.find(({ id }) => id === registered.affiliate.id);
  assert.equal(selfRow.status, "active");
  assert.equal(selfRow.inviteState, "none");
  const registrationEvents = await sql`SELECT affiliate_id FROM affiliate_audit WHERE action = 'affiliate.self_registered' AND affiliate_id = ${registered.affiliate.id}`;
  assert.equal(registrationEvents.length, 1);
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

  // Regression fixtures preserve legacy checkout prices; new defaults tested separately.
  for(const [productId,price] of [["poster",24900],["papercraft",36900],["placemat",54900],["growthchart",69000]])await call("adminSetProductPrice",{productId,price},admin);
  await call("adminSaveBundle",{id:"little-artist",name:"Little Artist",productIds:["poster","papercraft"],price:54900,active:true},admin);
  const orderArgs = {
    checkoutId: randomUUID(), quantity: 7, projectId: project.id, productType: "papercraft", childName: "",
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
  assert.equal(order.productPrice, 258300);
  assert.equal(order.discountAmount, 25830);
  assert.equal(order.shippingCost, 0);
  assert.equal(order.total, 232470);
  assert.equal(order.childName, "");
  assert.deepEqual(order.colors, project.colors);
  await call("updateOrder", { id: order.id, paymentStatus: "paid" }, { ...admin, expected: 400 });
  await call("updateOrder", { id: order.id, shippingCost: 12000 }, {...admin, expected:400});
  assert.equal((await call("trackOrder", { code: order.code, whatsapp: "089000000000" })).body.order, null);
  const tracked = (await call("trackOrder", { code: order.code, whatsapp: "+62" + digits })).body.order;
  assert.equal(tracked.shippingCost, 0);
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
  assert.deepEqual(commission[0], { status: "payable", amount: 69741 });
  console.log("PASS verified-only payment, QRIS uniqueness, idempotent checkout, proofs, tracking and commissions");

  const requestPayout = { sessionToken: registered.sessionToken, amount: 50000,
    bankName: "Bank QA", accountName: "QA Affiliate", accountNumber: "10001234" };
  const [{ body: payout }] = await Promise.all([
    call("affiliateRequestPayout", requestPayout, affiliateSession),
    call("affiliateRequestPayout", { ...requestPayout, amount: 70000 }, { ...affiliateSession, expected: 400 }),
  ]);
  const accountSummary = (await call("adminListAffiliates", {}, admin)).body.affiliates.find(({ id }) => id === registered.affiliate.id);
  assert.equal(accountSummary.totalOrders, 1);
  assert.equal(accountSummary.netSales, 232470);
  assert.equal(accountSummary.totalCommission, 69741);
  assert.equal(accountSummary.pendingPayout, 50000);
  await call("adminUpdatePayout", { id: payout.payoutId, decision: "approve" }, admin);
  await call("adminUpdatePayout", { id: payout.payoutId, decision: "paid" }, admin);
  await call("adminUpdatePayout", { id: payout.payoutId, decision: "paid" }, admin);
  const wallet = (await call("affiliateMe", { sessionToken: registered.sessionToken }, affiliateSession)).body;
  assert.equal(wallet.wallet.paid, 50000);
  assert.equal(wallet.availablePayout, 19741);
  console.log("PASS payout approval, partial commission settlement, idempotent payout and wallet balance");

  const summary = (await call("listOrders", { limit: 1 }, admin)).body;
  assert.equal(summary.orders.length, 1);
  assert.ok(summary.orderCount >= 2 && summary.paidCount >= 1 && summary.netProductRevenue >= 232470);
  await call("adminSetProductPrice", { productId: "puzzle", price: 60000 }, { expected: 401 });
  await call("adminSetProductPrice", { productId: "puzzle", price: 60000 }, admin);
  const catalog = (await call("getShopConfig")).body;
  assert.equal(catalog.products.find(({ id }) => id === "puzzle").basePrice, 60000);
  await call("adminSetProductPrice", { productId: "puzzle", price: 69000 }, admin);
  console.log("PASS admin metrics, paginated orders and authorized catalog price changes");

  const rule = { affiliateId: registered.affiliate.id, productType: "puzzle", discountPct: 20 };
  await call("adminSetAffiliateProductDiscount", rule, { ...affiliateSession, expected: 401 });
  await call("adminSetAffiliateProductDiscount", { ...rule, discountPct: 91 }, { ...admin, expected: 400 });
  await call("adminSetAffiliateProductDiscount", { ...rule, productType: "unknown" }, { ...admin, expected: 400 });
  await Promise.all([
    call("adminSetAffiliateProductDiscount", rule, admin),
    call("adminSetAffiliateProductDiscount", { ...rule, productType: "placemat", discountPct: 0 }, admin),
  ]);

  const code = affiliateArgs.couponCode.toUpperCase();
  const rate = async (productType) => (await call("validateCoupon", { code, productType })).body.discountPct;
  assert.equal(await rate("puzzle"), 20);
  assert.equal(await rate("placemat"), 0);
  assert.equal(await rate("papercraft"), 10);
  assert.equal(await rate(), 10);
  const productDiscounts = { puzzle: 20, placemat: 0 };
  const updatedAffiliate = (await call("adminListAffiliates", {}, admin)).body.affiliates.find(({ id }) => id === rule.affiliateId);
  assert.deepEqual(updatedAffiliate.productDiscounts, productDiscounts);
  assert.deepEqual((await call("affiliateMe", { sessionToken: registered.sessionToken }, affiliateSession)).body.productDiscounts, productDiscounts);

  const puzzle = { ...orderArgs, checkoutId: randomUUID(), quantity: 2, productType: "puzzle", expectedCouponDiscountPct: 20 };
  const puzzleOrder = (await call("createOrder", puzzle, owner)).body.order;
  assert.equal(puzzleOrder.productPrice, 138000);
  assert.equal(puzzleOrder.discountAmount, 27600);
  assert.equal(puzzleOrder.total, 110400);
  const [puzzleCommission] = await sql`SELECT commission_pct, net_subtotal, amount FROM commissions WHERE order_id = ${puzzleOrder.id}`;
  assert.deepEqual(puzzleCommission, { commission_pct: 30, net_subtotal: 110400, amount: 33120 });

  const placemat = (await call("createOrder", {
    ...orderArgs, checkoutId: randomUUID(), quantity: 1, productType: "placemat", expectedCouponDiscountPct: 0,
  }, owner)).body.order;
  assert.equal(placemat.productPrice, 54900);
  assert.equal(placemat.discountAmount, 0);
  assert.equal(placemat.shippingCost, 10000);
  assert.equal(placemat.total, 64900);
  const growth = (await call("createOrder", { ...orderArgs, checkoutId: randomUUID(), quantity: 1, productType: "growthchart" }, owner)).body.order;
  assert.equal(growth.productPrice, 69000);
  assert.equal(growth.variant, "Growth chart tempel personalisasi");
  assert.deepEqual(growth.colors, project.colors);
  assert.equal(placemat.affiliateId, rule.affiliateId);

  // A cart uses a single checkout ID, order row, unique payment and commission.
  const cartArgs = { ...orderArgs, checkoutId: randomUUID(), productType: "poster",
    items: [
      { productType: "poster", quantity: 2, expectedUnitPrice: 24900, expectedCouponDiscountPct: 10 },
      { productType: "puzzle", quantity: 1, expectedUnitPrice: 69000, expectedCouponDiscountPct: 20 },
      { productType: "placemat", quantity: 1, expectedUnitPrice: 54900, expectedCouponDiscountPct: 0 },
    ] };
  const cart = (await call("createOrder", cartArgs, owner)).body.order;
  assert.equal(cart.items.length, 3);
  assert.equal(cart.quantity, 4);
  assert.equal(cart.productPrice, 173700);
  assert.equal(cart.discountAmount, 18780);
  assert.equal(cart.total, 154920);
  assert.equal(cart.shippingCost, 0);
  assert.equal((await call("createOrder", cartArgs, owner)).body.order.id, cart.id);
  const cartComms = await sql`SELECT amount FROM commissions WHERE order_id = ${cart.id}`;
  assert.equal(cartComms.length, 1);
  assert.equal(cartComms[0].amount, 46476);
  await call("createOrder", { ...cartArgs, checkoutId: randomUUID(),
    items: [...cartArgs.items, { productType: "tshirt", quantity: 1, tshirtSize: "invalid" }] }, { ...owner, expected: 400 });
  await call("verifyOrderPayment", { id: cart.id, decision: "verify", paymentReference: "CART-" + token }, admin);
  assert.equal((await call("trackOrder", { code: cart.code, whatsapp: phone })).body.order.items.length, 3);
  // Boundary and stale shipping amount; shipping is based on net product subtotal.
  const shippingArgs = { ...orderArgs, productType: "poster", quantity: 4, couponCode: "", checkoutId: randomUUID() };
  const below = (await call("createOrder", shippingArgs, owner)).body.order;
  assert.equal(below.productPrice, 99600);
  assert.equal(below.shippingCost, 10000);
  assert.equal(below.total, 109600);
  await call("createOrder", {...shippingArgs, checkoutId: randomUUID(), expectedShippingCost: 0}, {...owner, expected: 400});
  await call("adminSetProductPrice", {productId: "poster", price: 100000}, admin);
  const exact = (await call("createOrder", {...shippingArgs, quantity: 1, checkoutId: randomUUID(), expectedShippingCost: 0}, owner)).body.order;
  assert.equal(exact.total, 100000);
  assert.equal(exact.shippingCost, 0);
  const discounted = (await call("createOrder", {...shippingArgs, quantity: 1, couponCode: coupon.code, checkoutId: randomUUID(), expectedShippingCost: 10000}, owner)).body.order;
  assert.equal(discounted.discountAmount, 10000);
  assert.equal(discounted.shippingCost, 10000);
  assert.equal(discounted.total, 100000);
  assert.notEqual(exact.payableTotal, discounted.payableTotal);
  await call("adminSetProductPrice", {productId: "poster", price: 24900}, admin);
  console.log("PASS multi-product cart, automatic shipping, per-item discount, payment, commission and idempotency");
  const packageArgs={...orderArgs,checkoutId:randomUUID(),productType:"poster",couponCode:"",
    items:[{productType:"poster",quantity:1,expectedUnitPrice:24900},{productType:"papercraft",quantity:1,expectedUnitPrice:36900}],
    expectedBundleDiscount:6900,expectedShippingCost:10000,gift:{sender:"QA Parent",recipient:"QA Friend",message:"Selamat ulang tahun!"}};
  const packaged=(await call("createOrder",packageArgs,owner)).body.order;
  assert.equal(packaged.bundleName,"Little Artist");
  assert.equal(packaged.productPrice,61800);
  assert.equal(packaged.discountAmount,6900);
  assert.equal(packaged.total,64900);
  assert.equal(packaged.items.reduce((n,i)=>n+i.discount,0),6900);
  assert.equal(packaged.gift.recipient,"QA Friend");
  assert.equal((await call("trackOrder",{code:packaged.code,whatsapp:phone})).body.order.gift,null);
  await call("adminListBundles",{},{expected:401});
  await call("adminSaveBundle",{id:"little-artist",name:"Little Artist",productIds:["poster","papercraft"],price:54900,active:false},admin);
  await call("createOrder",{...packageArgs,checkoutId:randomUUID()},{...owner,expected:400});
  await call("adminSaveBundle",{id:"little-artist",name:"Little Artist",productIds:["poster","papercraft"],price:54900,active:true},admin);
  console.log("PASS bundle server pricing, gifts and admin access");

  await call("adminSetAffiliateProductDiscount", { ...rule, discountPct: null }, admin);
  assert.equal(await rate("puzzle"), 10);
  const stale = await call("createOrder", { ...puzzle, checkoutId: randomUUID() }, { ...owner, expected: 400 });
  assert.match(stale.body.error, /Diskon kupon berubah/);
  assert.equal((await call("createOrder", puzzle, owner)).body.order.discountAmount, 27600);
  console.log("PASS admin-only per-product coupon rates, 0%, standard fallback, quantity, commission, and stale totals");
  const month = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  await call("adminSalesReport", { month }, { expected: 401 });
  await call("adminSetProductCost", { productId: "papercraft", unitCost: 12000 }, { expected: 401 });
  await call("adminSetProductCost", { productId: "papercraft", unitCost: 12000 }, admin);
  await call("adminSetOperatingCost", { month, amount: 10000 }, admin);
  const report = (await call("adminSalesReport", { month }, admin)).body;
  assert.equal(report.costs.find(c => c.productId === "papercraft").unitCost, 12000);
  assert.equal(report.operatingCost, 10000);
  assert.ok(report.daily.some(d => d.productId === "papercraft" && d.affiliate && d.orders > 0));
  const paymentQueue = (await call("listOrders", { scope: "payment", limit: 100 }, admin)).body;
  assert.ok(paymentQueue.orders.every(o => o.paymentStatus !== "paid" && o.orderStatus !== "cancelled"));
  const fulfillment = (await call("listOrders", { scope: "fulfillment", limit: 100 }, admin)).body;
  assert.ok(fulfillment.orders.every(o => o.paymentStatus === "paid" && o.orderStatus !== "completed"));
  await call("adminBulkAffiliateDiscount",{affiliateIds:[rule.affiliateId],productType:"kidswatch",discountPct:10},{expected:401});
  await call("adminBulkAffiliateDiscount",{affiliateIds:[rule.affiliateId],productType:"kidswatch",discountPct:10},admin);
  const watch=(await call("createOrder",{...orderArgs,checkoutId:randomUUID(),quantity:1,productType:"kidswatch",childName:"",backgroundId:"05_Luar_Angkasa"},owner)).body.order;
  assert.equal(watch.productPrice,239000);assert.equal(watch.childName,"");assert.equal(watch.discountAmount,23900);assert.equal(watch.backgroundId,"05_Luar_Angkasa");
  assert.equal((await sql`SELECT amount FROM commissions WHERE order_id=${watch.id}`)[0].amount,64530);
  await call("adminArchiveOrder",{id:watch.id},{expected:401});
  await call("adminArchiveOrder",{id:order.id},{...admin,expected:400});
  await call("adminArchiveOrder",{id:watch.id},admin);
  assert.ok(!(await call("listOrders",{limit:100},admin)).body.orders.some(o=>o.id===watch.id));
  assert.equal((await sql`SELECT count(*)::int AS n FROM orders WHERE id=${watch.id} AND archived_at IS NOT NULL`)[0].n,1);
  console.log("PASS admin finance, bulk discount, new watch, blank name, archive and scoped orders");
  // Restore current catalog after regression fixtures, before browser tests share this disposable database.
  for(const [productId,price] of [["poster",29900],["papercraft",39900],["placemat",79900],["growthchart",99000]]) {
    await call("adminSetProductPrice",{productId,price},admin);
  }
  await call("adminSetProductCost",{productId:"papercraft",unitCost:17000},admin);
  await call("adminSaveBundle",{id:"little-artist",name:"Little Artist",productIds:["poster","papercraft"],price:64900,active:true},admin);
  const restored=(await call("getShopConfig")).body;
  assert.equal(restored.products.find(p=>p.id==="poster").basePrice,29900);
  assert.equal(restored.bundles.find(b=>b.id==="little-artist").price,64900);
  console.log("PASS revised catalog restored for browser QA");

} finally {
  await sql.end();
  await closeDatabase();
}
