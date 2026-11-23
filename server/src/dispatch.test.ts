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

  test("unknown actions continue to return 404", async () => {
    const result = await dispatchAction("actionDoesNotExist", {});
    expect(result.status).toBe(404);
  });
});
