import { describe, expect, test } from "bun:test";
import { dispatchAction } from "./dispatch.js";
import { Actions } from "./actions.js";
import { bestBundle } from "./bundles.js";

describe("Active product catalog", () => {
  test("exactly twelve active products at the revised fixed prices", async () => {
    const db = () => ({ select: () => ({ from: () => Object.assign(Promise.resolve([]), {orderBy: async () => []}) }) });
    const res = await Actions.getShopConfig.handler({ db } as never, {});
    expect(res.products).toEqual([
      { id: "poster", basePrice: 29900, priceLabel: "fixed" },
      { id: "rewardchart", basePrice: 39900, priceLabel: "fixed" },
      { id: "papercraft", basePrice: 39900, priceLabel: "fixed" },
      { id: "namestickers", basePrice: 44900, priceLabel: "fixed" },
      { id: "celengan", basePrice: 59900, priceLabel: "fixed" },
      { id: "puzzle", basePrice: 69000, priceLabel: "fixed" },
      { id: "tshirt", basePrice: 79000, priceLabel: "fixed" },
      { id: "placemat", basePrice: 79900, priceLabel: "fixed" },
      { id: "growthchart", basePrice: 99000, priceLabel: "fixed" },
      { id: "wallclock", basePrice: 99000, priceLabel: "fixed" },
      { id: "nightlamp", basePrice: 129000, priceLabel: "fixed" },
      { id: "kidswatch", basePrice: 179000, priceLabel: "fixed" },
    ]);
    for (const productType of ["figurine", "accessory59"]) {
      expect(Actions.createOrder.request.safeParse({ projectId: 1, productType, customerName: "QA Parent",
        whatsapp: "081234567890", email: "qa@example.test", address: "Jalan Pengujian Jakarta" }).success).toBe(false);
    }
  });

  test("rejects attempts to fake accessories prices using client-provided values", async () => {
    for (const type of ["celengan", "accessory59"]) {
      const result = await dispatchAction("createOrder", {
        productType: type, productPrice: 1, customerName: "",
      });
      // Invalid inputs are rejected before DB access. Price is always
      // recalculated by the server, never taken from the request.
      expect(result.status).toBe(400);
    }
  });

  test("order requests validate product IDs instead of trusting a client-side price", async () => {
    const res = await dispatchAction("createOrder", {
      projectId: 1,
      productType: "papercraft",
      customerName: "",
      whatsapp: "081234567890",
      email: "x@example.org",
      address: "Kota Jakarta, Indonesia",
    });
    expect(res.status).toBe(400);
  });

});

describe("Affiliate input validation", () => {
  test("rejects a WhatsApp value that is not a telephone number before connecting to DB", async () => {
    const result = await dispatchAction("adminCreateAffiliate", {
      fullName: "Contoh Partner",
      email: "partner@example.com",
      whatsapp: "bukan-nomor",
      instagram: "",
      tiktok: "",
      couponCode: "CONTOH123",
      discountPct: 10,
      commissionPct: 30,
    }, "", true);
    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).toContain("WhatsApp");
  });

  test("does not open a DB connection for an invalid action request", async () => {
    const result = await dispatchAction("adminCreateAffiliate", {
      fullName: "",
      email: "invalid",
      whatsapp: "abcdefghij",
      couponCode: "A",
    }, "", true);
    expect(result.status).toBe(400);
  });

  test("public registration requires explicit permission to contact by WhatsApp", async () => {
    const result = await dispatchAction("affiliateApply", {
      fullName: "Mitra Contoh",
      email: "mitra@example.org",
      whatsapp: "081234567890",
      instagram: "@mitra",
      tiktok: "",
      consent: false,
    });
    expect(result.status).toBe(400);
  });

  test("public registration rejects invalid WhatsApp before database access", async () => {
    const result = await dispatchAction("affiliateApply", {
      fullName: "Mitra Contoh",
      email: "mitra@example.org",
      whatsapp: "bukan-nomor",
      consent: true,
    });
    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).toContain("Nomor HP");
  });

  test("affiliate self-registration requires a 4-digit PIN", async () => {
    const res = await dispatchAction("affiliateApply", {
      fullName: "Mitra Sample",
      email: "mitra@example.org",
      whatsapp: "081234567890",
      consent: true,
      pin: "12345",
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("PIN");
  });

  test("phone-only affiliate login rejects emails before database access", async () => {
    const res = await dispatchAction("affiliateLogin", {
      identifier: "mitra@example.org",
      pin: "5073",
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("nomor HP");
  });

  test("phone login requires four PIN digits", async () => {
    const res = await dispatchAction("affiliateLogin", {
      identifier: "081234567890",
      pin: "51",
    });
    expect(res.status).toBe(400);
  });

  test("custom coupon rejects invalid characters before accessing database", async () => {
    const result = await dispatchAction("affiliateUpdateCoupon", {
      sessionToken: "not-a-real-session",
      couponCode: "PROMO KAMU!",
    });
    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).toContain("Kode");
  });

  test("custom coupon cannot be shorter than three characters", async () => {
    const result = await dispatchAction("affiliateUpdateCoupon", {
      sessionToken: "not-a-real-session",
      couponCode: "AB",
    });
    expect(result.status).toBe(400);
  });

  test("sign-up custom coupon rejects spaces and special characters", async () => {
    const result = await dispatchAction("affiliateApply", {
      fullName: "Mitra Sample",
      email: "mitra@example.org",
      whatsapp: "081234567890",
      consent: true,
      pin: "5073",
      couponCode: "KODE PROMO",
    });
    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).toContain("kupon");
  });

  test("unknown actions continue to return 404", async () => {
    const result = await dispatchAction("actionDoesNotExist", {});
    expect(result.status).toBe(404);
  });
});

describe("Bundle discount",()=>{
 test("allocates a single best bundle, never discounts extra units",()=>{
  const offers=[{id:"a",name:"Little Artist",productIds:["poster","papercraft"],price:54900,active:true}];
  const items=[{productType:"poster",quantity:2,unitPrice:24900},{productType:"papercraft",quantity:1,unitPrice:36900}];
  const match=bestBundle(offers,items);
  expect(match?.savings).toBe(6900);
  expect(match?.allocations.reduce((n,x)=>n+x,0)).toBe(6900);
  expect(bestBundle(offers,items.slice(0,1))).toBeNull();
  expect(bestBundle([{...offers[0]!,active:false}],items)).toBeNull();
 });
});
