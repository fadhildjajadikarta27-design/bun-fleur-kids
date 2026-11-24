// Drizzle schema for Bun & Fleur Kids.
//
// One `projects` row is one saved coloring project: the single source of
// truth that drives the coloring editor, the 3D preview, and the PDF
// export. Region colors and freehand strokes are stored as JSON text.
// `settings` holds the configurable brand name (single row, id = 1).

import { doublePrecision, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  templateId: text("template_id").notNull(),
  ownerId: text("owner_id").notNull().default(""),
  childName: text("child_name").notNull().default(""),
  message: text("message").notNull().default(""),
  nameFont: text("name_font").notNull().default("baloo"),
  nameColor: text("name_color").notNull().default("#E4572E"),
  // Horizontal alignment of the personalized name under the artwork.
  nameAlign: text("name_align", { enum: ["left", "center", "right"] })
    .notNull()
    .default("center"),
  colors: text("colors").notNull().default("{}"),
  strokes: text("strokes").notNull().default("[]"),
  // JSON part combination for "Buat Karakter Sendiri" projects
  // (template_id = "custom"); empty for catalog characters.
  customDef: text("custom_def").notNull().default(""),
  status: text("status", { enum: ["draft", "done"] })
    .notNull()
    .default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// QRIS / affiliate settings live on the single settings row: the minimum
// withdrawal an affiliate may request and how long an invitation link
// stays valid (hours, default 72 per the affiliate brief).
export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  brandName: text("brand_name").notNull().default("Bun & Fleur Kids"),
  minWithdrawal: integer("min_withdrawal").notNull().default(50000),
  inviteExpiryHours: integer("invite_expiry_hours").notNull().default(72),
});

// Papercraft quality control: one row per coloring template, managed from
// the Parent Dashboard's Template Manager. `production_ready` may only be
// set when the automated geometry checks pass AND a physical prototype
// has been built and tested (prototype_tested = 1) — enforced in the
// updateTemplateQc action. Every change appends a template_versions row
// as an audit trail.
export const templateQc = pgTable("template_qc", {
  templateId: text("template_id").primaryKey(),
  status: text("status", {
    enum: ["draft", "needs_review", "validated", "production_ready"],
  })
    .notNull()
    .default("needs_review"),
  prototypeTested: integer("prototype_tested").notNull().default(0),
  checksPassed: integer("checks_passed").notNull().default(0),
  scalePct: integer("scale_pct").notNull().default(100),
  tabDepthMm: doublePrecision("tab_depth_mm").notNull().default(7),
  nameOffsetMm: doublePrecision("name_offset_mm").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Physical-product orders ("Free to Color, Pay to Create"). One row per
// order: the customer details, a full snapshot of the artwork at order
// time (so later edits to the project never change what was ordered),
// the server-computed price, and the payment / fulfilment status pair.
// Payment status is only ever changed through the admin action after the
// team verifies payment — there is no self-serve "paid" path.
const ordersProductIds = ["poster", "papercraft", "figurine", "tshirt", "celengan", "accessory59", "puzzle", "placemat", "growthchart"] as const;
export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  code: text("code").notNull().unique(),
  projectId: integer("project_id"),
  checkoutKey: text("checkout_key"),
  quantity: integer("quantity").notNull().default(1),
  // Empty for historical single-product orders. New carts snapshot every line.
  items: jsonb("items").$type<{ productType: typeof ordersProductIds[number]; variant: string; quantity: number; unitPrice: number; gross: number; discount: number }[]>().notNull().default([]),
  bundleName: text("bundle_name").notNull().default(""),
  gift: jsonb("gift").$type<{sender:string;recipient:string;message:string}>(),
  paymentReference: text("payment_reference"),
  templateId: text("template_id").notNull(),
  customDef: text("custom_def").notNull().default(""),
  childName: text("child_name").notNull().default(""),
  message: text("message").notNull().default(""),
  nameFont: text("name_font").notNull().default("baloo"),
  nameColor: text("name_color").notNull().default("#E4572E"),
  nameAlign: text("name_align", { enum: ["left", "center", "right"] })
    .notNull()
    .default("center"),
  colors: text("colors").notNull().default("{}"),
  strokes: text("strokes").notNull().default("[]"),
  productType: text("product_type", { enum: ["poster", "papercraft", "figurine", "tshirt", "celengan", "accessory59", "puzzle", "placemat", "growthchart"] }).notNull(),
  variant: text("variant").notNull().default(""),
  productPrice: integer("product_price").notNull(),
  // Affiliate attribution (brief Part 3): the coupon code the customer
  // used, the affiliate it belongs to, and the discount it granted. The
  // commission base is productPrice - discountAmount; shipping and the
  // unique QRIS code are never part of it.
  couponCode: text("coupon_code").notNull().default(""),
  affiliateId: integer("affiliate_id"),
  discountAmount: integer("discount_amount").notNull().default(0),
  // Static-QRIS unique payment identifier (Rp1–999, brief Part 4),
  // generated by the server at order time and never regenerated; the
  // exact payable total (total + uniqueCode) is unique among orders
  // still waiting to be matched to a real transfer.
  uniqueCode: integer("unique_code").notNull().default(0),
  // QRIS payment state machine, separate from the legacy paymentStatus:
  // awaiting → waiting_verification (customer tapped "Saya Sudah
  // Transfer") → verified / rejected / unmatched, plus refunded.
  payState: text("pay_state", {
    enum: ["awaiting", "waiting_verification", "verified", "rejected", "unmatched", "refunded"],
  })
    .notNull()
    .default("awaiting"),
  paymentConfirmedAt: timestamp("payment_confirmed_at", { withTimezone: true, mode: "date" }),
  // Null until the team confirms the real courier cost with the customer;
  // the app never invents a shipping price.
  shippingCost: integer("shipping_cost"),
  total: integer("total").notNull(),
  customerName: text("customer_name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  notes: text("notes").notNull().default(""),
  paymentStatus: text("payment_status", {
    enum: ["pending", "waiting_verification", "paid", "rejected", "failed", "cancelled", "refunded"],
  })
    .notNull()
    .default("pending"),
  orderStatus: text("order_status", {
    enum: [
      "pending_payment",
      "paid",
      "confirmed",
      "design_review",
      "production",
      "ready_to_ship",
      "shipped",
      "completed",
      "cancelled",
    ],
  })
    .notNull()
    .default("pending_payment"),
  trackingNumber: text("tracking_number").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const productPrices = pgTable("product_prices", {
  productId: text("product_id", { enum: ["poster", "papercraft", "figurine", "tshirt", "celengan", "accessory59", "puzzle", "placemat", "growthchart"] }).primaryKey(),
  price: integer("price").notNull(),
});

export const paymentProofs = pgTable("payment_proofs", {
  orderId: integer("order_id").primaryKey().references(() => orders.id, { onDelete: "cascade" }),
  mime: text("mime", { enum: ["image/jpeg", "image/png"] }).notNull(),
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const templateVersions = pgTable("template_versions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  templateId: text("template_id").notNull(),
  version: integer("version").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* --------------------------- Affiliate system --------------------------- */
// Private affiliate program (brief Part 3). Affiliates are created by the
// admin only; each gets one coupon code, a single-use expiring invitation
// token, and a 4-digit PIN stored ONLY as a salted PBKDF2 hash. Sessions
// are server-side rows with revocable random tokens — a dashboard is
// never reachable from an affiliate id or URL alone.

export const affiliates = pgTable("affiliates", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  whatsapp: text("whatsapp").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  tiktok: text("tiktok").notNull().default(""),
  couponCode: text("coupon_code").notNull().unique(),
  discountPct: integer("discount_pct").notNull().default(10),
  productDiscounts: jsonb("product_discounts").$type<Partial<Record<string, number>>>().notNull().default({}),
  commissionPct: integer("commission_pct").notNull().default(30),
  // pending = invited, not yet activated · active · suspended
  status: text("status", { enum: ["pending", "active", "suspended"] })
    .notNull()
    .default("pending"),
  pinHash: text("pin_hash").notNull().default(""),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
  // Monthly KPI targets are admin-configured only (0 = not configured);
  // the app never invents targets or bonuses.
  kpiTargetOrders: integer("kpi_target_orders").notNull().default(0),
  kpiTargetRevenue: integer("kpi_target_revenue").notNull().default(0),
  // PIN reset: a pending request flag for the admin, plus a single-use
  // expiring reset token the admin shares through a verified channel.
  pinResetRequestedAt: timestamp("pin_reset_requested_at", { withTimezone: true, mode: "date" }),
  resetToken: text("reset_token").notNull().default(""),
  resetTokenEncrypted: text("reset_token_encrypted").notNull().default(""),
  resetExpiresAt: timestamp("reset_expires_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const affiliateInvitations = pgTable("affiliate_invitations", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  affiliateId: integer("affiliate_id").notNull(),
  token: text("token").notNull().unique(),
  encryptedToken: text("encrypted_token").notNull().default(""),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const affiliateSessions = pgTable("affiliate_sessions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  affiliateId: integer("affiliate_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// One commission row per attributed order (order_id unique → attribution
// can never be duplicated). Status flow: pending (order unpaid) →
// confirmed (payment verified) → payable (order completed) → paid
// (covered by a paid payout); reversed when the order is refunded.
export const commissions = pgTable("commissions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  orderId: integer("order_id").notNull().unique(),
  affiliateId: integer("affiliate_id").notNull(),
  netSubtotal: integer("net_subtotal").notNull(),
  commissionPct: integer("commission_pct").notNull(),
  amount: integer("amount").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "payable", "paid", "reversed"] })
    .notNull()
    .default("pending"),
  payoutId: integer("payout_id"),
  paidAmount: integer("paid_amount").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payouts = pgTable("payouts", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  affiliateId: integer("affiliate_id").notNull(),
  amount: integer("amount").notNull(),
  bankName: text("bank_name").notNull().default(""),
  accountName: text("account_name").notNull().default(""),
  accountNumber: text("account_number").notNull().default(""),
  status: text("status", { enum: ["requested", "approved", "paid", "rejected"] })
    .notNull()
    .default("requested"),
  note: text("note").notNull().default(""),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Append-only audit trail for sensitive affiliate/payment changes.
export const affiliateAudit = pgTable("affiliate_audit", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  affiliateId: integer("affiliate_id"),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Admin-only management accounting; values are estimates, not order price snapshots.
export const productCosts = pgTable("product_costs", {
  productId: text("product_id", { enum: ["poster", "papercraft", "figurine", "tshirt", "celengan", "accessory59", "puzzle", "placemat", "growthchart"] }).primaryKey(),
  unitCost: integer("unit_cost").notNull(),
});
export const monthlyOperatingCosts = pgTable("monthly_operating_costs", {
  month: text("month").primaryKey(),
  amount: integer("amount").notNull(),
});

export const birthdayPrices = pgTable("birthday_prices", {
  productId: text("product_id", {enum: ordersProductIds}).primaryKey(),
  price: integer("price").notNull(),
});
export const birthdayEvents = pgTable("birthday_events", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  code: text("code").notNull().unique(),
  ownerId: text("owner_id").notNull(),
  requestKey: text("request_key").notNull().unique(),
  eventName: text("event_name").notNull(),
  childAge: integer("child_age").notNull(),
  eventDate: text("event_date").notNull(),
  deadline: text("deadline").notNull(),
  theme: text("theme").notNull(),
  guestCount: integer("guest_count").notNull(),
  items: jsonb("items").$type<{productId:typeof ordersProductIds[number]; unitPrice:number}[]>().notNull(),
  perGuest: integer("per_guest").notNull(),
  total: integer("total").notNull(),
  organizer: text("organizer").notNull(),
  whatsapp: text("whatsapp").notNull(),
  address: text("address").notNull(),
  notes: text("notes").notNull(),
  status: text("status", {enum:["requested","confirmed","paid","production","shipped","completed","cancelled","refunded"]}).notNull().default("requested"),
  paymentReference: text("payment_reference").unique(),
  trackingNumber: text("tracking_number").notNull().default(""),
  createdAt: timestamp("created_at",{withTimezone:true,mode:"date"}).notNull(),
  updatedAt: timestamp("updated_at",{withTimezone:true,mode:"date"}).notNull(),
});

export const shopBundles=pgTable("shop_bundles",{
 id:text("id").primaryKey(),name:text("name").notNull(),productIds:jsonb("product_ids").$type<string[]>().notNull(),price:integer("price").notNull(),active:integer("active").notNull().default(1),
});
