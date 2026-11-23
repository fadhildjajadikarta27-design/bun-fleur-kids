import { describe, expect, test } from "bun:test";
import { dispatchAction } from "./dispatch.js";

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
    });
    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).toContain("WhatsApp");
  });

  test("does not open a DB connection for an invalid action request", async () => {
    const result = await dispatchAction("adminCreateAffiliate", {
      fullName: "",
      email: "invalid",
      whatsapp: "abcdefghij",
      couponCode: "A",
    });
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
