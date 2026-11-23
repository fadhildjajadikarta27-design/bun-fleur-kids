// Actions for Bun & Fleur Kids: saved coloring projects + brand settings.
//
// A project row is the unified record the brief asks for: template id,
// child name personalization, region-color mapping, freehand stroke layer,
// completion status, and timestamps. The same row drives the editor, the
// 3D preview, and the PDF export on the client.

import { defineAction, z, type ActionsModule, type Ctx } from "./sdk";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import * as schema from "./schema";

const strokeSchema = z.object({
  color: z.string().min(1).max(32),
  size: z.number().min(1).max(60),
  points: z.array(z.tuple([z.number(), z.number()])).max(4000),
});

const projectFields = {
  templateId: z.string().min(1).max(64),
  childName: z.string().max(24),
  message: z.string().max(100),
  nameFont: z.string().min(1).max(32),
  nameColor: z.string().min(1).max(32),
  nameAlign: z.enum(["left", "center", "right"]),
  colors: z.record(z.string().max(64), z.string().max(32)),
  strokes: z.array(strokeSchema).max(600),
  // JSON part combination for custom-built characters (templateId "custom").
  customDef: z.string().max(4000),
  status: z.enum(["draft", "done"]),
};

const projectOut = z.object({
  id: z.number(),
  templateId: z.string(),
  childName: z.string(),
  message: z.string(),
  nameFont: z.string(),
  nameColor: z.string(),
  nameAlign: z.enum(["left", "center", "right"]),
  colors: z.record(z.string(), z.string()),
  strokes: z.array(strokeSchema),
  customDef: z.string(),
  status: z.enum(["draft", "done"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type ProjectRow = typeof schema.projects.$inferSelect;

function toOut(row: ProjectRow): z.infer<typeof projectOut> {
  let colors: Record<string, string> = {};
  let strokes: z.infer<typeof strokeSchema>[] = [];
  try {
    const parsed = JSON.parse(row.colors) as Record<string, string>;
    if (parsed && typeof parsed === "object") colors = parsed;
  } catch {
    colors = {};
  }
  try {
    const parsed = JSON.parse(row.strokes) as z.infer<typeof strokeSchema>[];
    if (Array.isArray(parsed)) strokes = parsed;
  } catch {
    strokes = [];
  }
  return {
    id: row.id,
    templateId: row.templateId,
    childName: row.childName,
    message: row.message,
    nameFont: row.nameFont,
    nameColor: row.nameColor,
    nameAlign: row.nameAlign,
    colors,
    strokes,
    customDef: row.customDef,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* ------------------------- Shop configuration ------------------------- */
// Centralized pricing (brief §5): the ONLY place product prices live on
// the server. Orders always recompute from these constants — a price
// sent by the client is never trusted.
const POSTER_BASE_PRICE = 49000;
const FIGURINE_BASE_PRICE = 120000;
const TSHIRT_BASE_PRICE = 79000;
// Fabric colors fixed by the brand (brief §2C) and the configured kids
// t-shirt sizes; all sizes are priced at the base price (no invented
// surcharges).
const TSHIRT_COLORS = ["Cream", "Mustard", "Terracotta", "Sage Green", "Brown"] as const;
const TSHIRT_SIZES = ["2–3 tahun", "4–5 tahun", "6–7 tahun", "8–9 tahun", "10–12 tahun"] as const;

const orderOut = z.object({
  id: z.number(),
  code: z.string(),
  projectId: z.number().nullable(),
  templateId: z.string(),
  customDef: z.string(),
  childName: z.string(),
  message: z.string(),
  nameFont: z.string(),
  nameColor: z.string(),
  nameAlign: z.enum(["left", "center", "right"]),
  colors: z.record(z.string(), z.string()),
  strokes: z.array(strokeSchema),
  productType: z.enum(["poster", "figurine", "tshirt"]),
  variant: z.string(),
  productPrice: z.number(),
  couponCode: z.string(),
  affiliateId: z.number().nullable(),
  discountAmount: z.number(),
  uniqueCode: z.number(),
  payState: z.enum(["awaiting", "waiting_verification", "verified", "rejected", "unmatched", "refunded"]),
  payableTotal: z.number(),
  paymentConfirmedAt: z.string().nullable(),
  shippingCost: z.number().nullable(),
  total: z.number(),
  customerName: z.string(),
  whatsapp: z.string(),
  email: z.string(),
  address: z.string(),
  notes: z.string(),
  paymentStatus: z.enum(["pending", "waiting_verification", "paid", "rejected", "failed", "cancelled", "refunded"]),
  orderStatus: z.enum([
    "pending_payment",
    "paid",
    "confirmed",
    "design_review",
    "production",
    "ready_to_ship",
    "shipped",
    "completed",
    "cancelled",
  ]),
  trackingNumber: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type OrderRow = typeof schema.orders.$inferSelect;

function orderToOut(row: OrderRow): z.infer<typeof orderOut> {
  let colors: Record<string, string> = {};
  let strokes: z.infer<typeof strokeSchema>[] = [];
  try {
    const parsed = JSON.parse(row.colors) as Record<string, string>;
    if (parsed && typeof parsed === "object") colors = parsed;
  } catch {
    colors = {};
  }
  try {
    const parsed = JSON.parse(row.strokes) as z.infer<typeof strokeSchema>[];
    if (Array.isArray(parsed)) strokes = parsed;
  } catch {
    strokes = [];
  }
  return {
    id: row.id,
    code: row.code,
    projectId: row.projectId,
    templateId: row.templateId,
    customDef: row.customDef,
    childName: row.childName,
    message: row.message,
    nameFont: row.nameFont,
    nameColor: row.nameColor,
    nameAlign: row.nameAlign,
    colors,
    strokes,
    productType: row.productType,
    variant: row.variant,
    productPrice: row.productPrice,
    couponCode: row.couponCode,
    affiliateId: row.affiliateId,
    discountAmount: row.discountAmount,
    uniqueCode: row.uniqueCode,
    payState: row.payState,
    payableTotal: row.total + row.uniqueCode,
    paymentConfirmedAt: row.paymentConfirmedAt ? row.paymentConfirmedAt.toISOString() : null,
    shippingCost: row.shippingCost,
    total: row.total,
    customerName: row.customerName,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address,
    notes: row.notes,
    paymentStatus: row.paymentStatus,
    orderStatus: row.orderStatus,
    trackingNumber: row.trackingNumber,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function makeOrderCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `BFK-${suffix}`;
}

// Compare WhatsApp numbers tolerantly: digits only, with the Indonesian
// country code 62 and the local leading 0 treated as the same number.
function normalizeWa(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
}

/* --------------------- Affiliate security helpers --------------------- */
// Tokens and PINs (brief Part 3.4): invitation/reset/session tokens are
// 192-bit random values; PINs are stored only as salted PBKDF2-SHA256
// hashes (120k iterations) — the plaintext PIN never touches the DB and
// the admin can never read one back.

function randomToken(bytes = 24): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function b64Encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64Decode(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$120000$${b64Encode(salt)}$${b64Encode(new Uint8Array(bits))}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = b64Decode(parts[2] ?? "");
  const expected = b64Decode(parts[3] ?? "");
  if (!iterations || salt.length === 0 || expected.length === 0) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations, hash: "SHA-256" },
    key,
    expected.length * 8,
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}

// Trivial PINs are refused at setup: repeated digits and straight runs.
function isTrivialPin(pin: string): boolean {
  if (/^(\d)\1{3}$/.test(pin)) return true;
  const runs = ["0123", "1234", "2345", "3456", "4567", "5678", "6789", "9876", "8765", "7654", "6543", "5432", "4321", "3210"];
  return runs.includes(pin);
}

function schemaDb(ctx: Ctx) {
  return ctx.db<typeof schema>();
}
type Db = ReturnType<typeof schemaDb>;

async function audit(db: Db, affiliateId: number | null, action: string, detail: string): Promise<void> {
  await db.insert(schema.affiliateAudit).values({ affiliateId, action, detail, createdAt: new Date() });
}

async function affiliateConfig(db: Db): Promise<{ minWithdrawal: number; inviteExpiryHours: number }> {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
  return {
    minWithdrawal: rows[0]?.minWithdrawal ?? 50000,
    inviteExpiryHours: rows[0]?.inviteExpiryHours ?? 72,
  };
}

async function createAffiliateSession(db: Db, affiliateId: number): Promise<string> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await db.insert(schema.affiliateSessions).values({ affiliateId, token, expiresAt: expires, createdAt: new Date() });
  return token;
}

type AffiliateRow = typeof schema.affiliates.$inferSelect;

// Resolves a session token to its affiliate, or throws a readable error.
// Suspended affiliates lose dashboard access immediately.
async function requireAffiliateSession(db: Db, token: string): Promise<AffiliateRow> {
  const sessions = await db
    .select()
    .from(schema.affiliateSessions)
    .where(eq(schema.affiliateSessions.token, token))
    .limit(1);
  const session = sessions[0];
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw new Error("Sesi afiliasi tidak ditemukan atau sudah berakhir. Silakan masuk lagi.");
  }
  const rows = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, session.affiliateId)).limit(1);
  const affiliate = rows[0];
  if (!affiliate) throw new Error("Akun afiliasi tidak ditemukan.");
  if (affiliate.status === "suspended") {
    throw new Error("Akun afiliasi ini sedang ditangguhkan. Hubungi tim Bun & Fleur Kids untuk bantuan.");
  }
  return affiliate;
}

// Keeps the single commission row for an order in step with the order's
// payment/fulfilment state. Idempotent: safe to call on every transition.
async function syncCommission(
  db: Db,
  order: OrderRow,
  event: "created" | "verified" | "completed" | "reversed",
): Promise<void> {
  if (!order.affiliateId) return;
  const rows = await db.select().from(schema.commissions).where(eq(schema.commissions.orderId, order.id)).limit(1);
  const existing = rows[0];
  const now = new Date();
  if (!existing) {
    if (event === "reversed") return;
    const affiliates = await db
      .select()
      .from(schema.affiliates)
      .where(eq(schema.affiliates.id, order.affiliateId))
      .limit(1);
    const affiliate = affiliates[0];
    if (!affiliate) return;
    const net = order.productPrice - order.discountAmount;
    await db.insert(schema.commissions).values({
      orderId: order.id,
      affiliateId: order.affiliateId,
      netSubtotal: net,
      commissionPct: affiliate.commissionPct,
      amount: Math.round((net * affiliate.commissionPct) / 100),
      status: event === "verified" ? "confirmed" : event === "completed" ? "payable" : "pending",
      createdAt: now,
      updatedAt: now,
    });
    return;
  }
  if (existing.status === "paid") return;
  let next = existing.status;
  if (event === "verified" && existing.status === "pending") next = "confirmed";
  if (event === "completed" && (existing.status === "pending" || existing.status === "confirmed")) next = "payable";
  if (event === "reversed") next = "reversed";
  if (next !== existing.status) {
    await db
      .update(schema.commissions)
      .set({ status: next, updatedAt: now })
      .where(eq(schema.commissions.id, existing.id));
  }
}

const affiliatePublicOut = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  couponCode: z.string(),
  discountPct: z.number(),
  commissionPct: z.number(),
  status: z.enum(["pending", "active", "suspended"]),
  createdAt: z.string(),
});

function toAffiliatePublic(row: AffiliateRow): z.infer<typeof affiliatePublicOut> {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    couponCode: row.couponCode,
    discountPct: row.discountPct,
    commissionPct: row.commissionPct,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export const Actions = {
  listProjects: defineAction({
    description: "Lists saved coloring projects, most recently updated first.",
    request: z.object({
      limit: z.number().int().positive().max(100).default(50),
    }),
    response: z.object({ projects: z.array(projectOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.projects)
        .orderBy(desc(schema.projects.updatedAt))
        .limit(args.limit);
      return { projects: rows.map(toOut) };
    },
  }),

  createProject: defineAction({
    description: "Creates a new coloring project and returns it with its id.",
    request: z.object(projectFields),
    response: z.object({ project: projectOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const result = await db
        .insert(schema.projects)
        .values({
          templateId: args.templateId,
          childName: args.childName,
          message: args.message,
          nameFont: args.nameFont,
          nameColor: args.nameColor,
          nameAlign: args.nameAlign,
          colors: JSON.stringify(args.colors),
          strokes: JSON.stringify(args.strokes),
          customDef: args.customDef,
          status: args.status,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const row = result[0];
      if (!row) throw new Error("createProject: insert returned no rows");
      ctx.invalidateQueries();
      return { project: toOut(row) };
    },
  }),

  updateProject: defineAction({
    description:
      "Saves edits to an existing coloring project (autosave, personalization, submit).",
    request: z.object({ id: z.number().int().positive(), ...projectFields }),
    response: z.object({ project: projectOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .update(schema.projects)
        .set({
          templateId: args.templateId,
          childName: args.childName,
          message: args.message,
          nameFont: args.nameFont,
          nameColor: args.nameColor,
          nameAlign: args.nameAlign,
          colors: JSON.stringify(args.colors),
          strokes: JSON.stringify(args.strokes),
          customDef: args.customDef,
          status: args.status,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, args.id))
        .returning();
      const row = result[0];
      if (!row) throw new Error("That project no longer exists.");
      ctx.invalidateQueries();
      return { project: toOut(row) };
    },
  }),

  deleteProject: defineAction({
    description: "Deletes one saved coloring project.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.projects)
        .where(eq(schema.projects.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  generateCharacter: defineAction({
    description:
      "Generates a custom character from a parent's text prompt: the AI composes one of the app's validated mix-and-match part combinations and a per-region color scheme matching the description.",
    request: z.object({
      prompt: z.string().trim().min(3).max(200),
    }),
    response: z.object({
      name: z.string(),
      base: z.string(),
      ears: z.string(),
      tail: z.string(),
      eyes: z.string(),
      accessory: z.string(),
      colors: z.record(z.string(), z.string()),
      blurb: z.string(),
    }),
    async handler(ctx, args) {
      const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
      const schema = z.object({
        name: z.string().min(1).max(24),
        base: z.enum(["bulat", "lonjong", "persegi", "tetes"]),
        ears: z.enum(["none", "kucing", "beruang", "kelinci", "tanduk"]),
        tail: z.enum(["none", "melengkung", "bulat", "gelombang"]),
        eyes: z.enum(["bulat", "besar", "sipit"]),
        accessory: z.enum(["none", "topi", "pita", "mahkota", "bintang"]),
        colors: z.object({
          badan: hex,
          perut: hex,
          telinga: hex,
          ekor: hex,
          mata: hex,
          aksesori: hex,
        }),
        blurb: z.string().min(1).max(120),
      });
      const out = await ctx.inference.complete(
        [
          "Orang tua mendeskripsikan karakter impian anaknya dalam Bahasa Indonesia:",
          `"${args.prompt}"`,
          "",
          "Rakit karakter itu dari bagian-bagian yang tersedia:",
          "- base (bentuk badan): bulat = bundar gemuk, lonjong = tinggi, persegi = kotak lembut, tetes = tetes air.",
          "- ears: none, kucing (segitiga lancip), beruang (bundar), kelinci (panjang), tanduk (tanduk kecil melengkung).",
          "- tail: none, melengkung, bulat, gelombang.",
          "- eyes: bulat, besar (besar berbinar), sipit (sipit senang).",
          "- accessory: none, topi (topi pesta), pita, mahkota, bintang (bintang di perut).",
          "Pilih kombinasi yang paling mirip dengan deskripsi (mis. kucing → ears kucing; astronot → accessory topi; putri → mahkota/pita).",
          "Beri nama karakter yang seru dalam Bahasa Indonesia (maks 24 huruf), dan warna heksadesimal (#RRGGBB) untuk setiap bagian sesuai deskripsi — bila warna tidak disebut, pilih warna ceria yang cocok dengan karakternya. Warna mata harus gelap (mis. #3B3230).",
          "blurb: satu kalimat Bahasa Indonesia yang menggambarkan karakter hasil rakitan ini.",
        ].join("\n"),
        { schema, timeout_secs: 60 },
      );
      return {
        name: out.name,
        base: out.base,
        ears: out.ears,
        tail: out.tail,
        eyes: out.eyes,
        accessory: out.accessory,
        colors: { ...out.colors },
        blurb: out.blurb,
      };
    },
  }),

  getSettings: defineAction({
    description: "Returns the configurable brand name for the app.",
    request: z.object({}),
    response: z.object({ brandName: z.string() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.id, 1))
        .limit(1);
      return { brandName: rows[0]?.brandName ?? "Bun & Fleur Kids" };
    },
  }),

  getTemplateQc: defineAction({
    description: "Returns papercraft QC records (status, prototype test, print adjustments) for all templates.",
    request: z.object({}),
    response: z.object({
      records: z.array(
        z.object({
          templateId: z.string(),
          status: z.enum(["draft", "needs_review", "validated", "production_ready"]),
          prototypeTested: z.boolean(),
          checksPassed: z.boolean(),
          scalePct: z.number(),
          tabDepthMm: z.number(),
          nameOffsetMm: z.number(),
          updatedAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.templateQc);
      return {
        records: rows.map((r) => ({
          templateId: r.templateId,
          status: r.status,
          prototypeTested: r.prototypeTested === 1,
          checksPassed: r.checksPassed === 1,
          scalePct: r.scalePct,
          tabDepthMm: r.tabDepthMm,
          nameOffsetMm: r.nameOffsetMm,
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    },
  }),

  updateTemplateQc: defineAction({
    description:
      "Saves a template's QC status and print adjustments, appending an audit version row. Production Ready requires passed geometry checks and a tested physical prototype.",
    request: z.object({
      templateId: z.string().min(1).max(64),
      status: z.enum(["draft", "needs_review", "validated", "production_ready"]),
      prototypeTested: z.boolean(),
      checksPassed: z.boolean(),
      scalePct: z.number().int().min(60).max(140),
      tabDepthMm: z.number().min(3).max(14),
      nameOffsetMm: z.number().min(-10).max(10),
      note: z.string().max(200),
    }),
    response: z.object({ ok: z.literal(true), version: z.number() }),
    async handler(ctx, args): Promise<{ ok: true; version: number }> {
      if (args.status === "production_ready" && (!args.prototypeTested || !args.checksPassed)) {
        throw new Error(
          "Siap Produksi mensyaratkan dua-duanya: cek geometri otomatis lolos DAN prototipe fisik yang sudah dibuat dan diuji.",
        );
      }
      const db = ctx.db<typeof schema>();
      const now = new Date();
      await db
        .insert(schema.templateQc)
        .values({
          templateId: args.templateId,
          status: args.status,
          prototypeTested: args.prototypeTested ? 1 : 0,
          checksPassed: args.checksPassed ? 1 : 0,
          scalePct: args.scalePct,
          tabDepthMm: args.tabDepthMm,
          nameOffsetMm: args.nameOffsetMm,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.templateQc.templateId,
          set: {
            status: args.status,
            prototypeTested: args.prototypeTested ? 1 : 0,
            checksPassed: args.checksPassed ? 1 : 0,
            scalePct: args.scalePct,
            tabDepthMm: args.tabDepthMm,
            nameOffsetMm: args.nameOffsetMm,
            updatedAt: now,
          },
        });
      const counted = await db
        .select({ n: count() })
        .from(schema.templateVersions)
        .where(eq(schema.templateVersions.templateId, args.templateId));
      const version = (counted[0]?.n ?? 0) + 1;
      await db.insert(schema.templateVersions).values({
        templateId: args.templateId,
        version,
        status: args.status,
        note: args.note,
        createdAt: now,
      });
      ctx.invalidateQueries();
      return { ok: true, version };
    },
  }),

  listTemplateVersions: defineAction({
    description: "Returns the audit version history for one papercraft template, newest first.",
    request: z.object({ templateId: z.string().min(1).max(64) }),
    response: z.object({
      versions: z.array(
        z.object({
          version: z.number(),
          status: z.string(),
          note: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.templateVersions)
        .where(eq(schema.templateVersions.templateId, args.templateId))
        .orderBy(desc(schema.templateVersions.version))
        .limit(30);
      return {
        versions: rows.map((r) => ({
          version: r.version,
          status: r.status,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  getShopConfig: defineAction({
    description:
      "Returns the centralized shop configuration: the three physical products with their base prices in IDR, the t-shirt fabric colors and sizes, and whether an online payment gateway is connected.",
    request: z.object({}),
    response: z.object({
      products: z.array(
        z.object({
          id: z.enum(["poster", "figurine", "tshirt"]),
          basePrice: z.number(),
          priceLabel: z.enum(["fixed", "from"]),
        }),
      ),
      tshirtColors: z.array(z.string()),
      tshirtSizes: z.array(z.string()),
      paymentGatewayConnected: z.boolean(),
    }),
    async handler(): Promise<{
      products: { id: "poster" | "figurine" | "tshirt"; basePrice: number; priceLabel: "fixed" | "from" }[];
      tshirtColors: string[];
      tshirtSizes: string[];
      paymentGatewayConnected: boolean;
    }> {
      return {
        products: [
          { id: "poster", basePrice: POSTER_BASE_PRICE, priceLabel: "fixed" },
          { id: "figurine", basePrice: FIGURINE_BASE_PRICE, priceLabel: "from" },
          { id: "tshirt", basePrice: TSHIRT_BASE_PRICE, priceLabel: "from" },
        ],
        tshirtColors: [...TSHIRT_COLORS],
        tshirtSizes: [...TSHIRT_SIZES],
        // No Midtrans/Xendit (or other gateway) credentials exist in this
        // project yet, so online payment stays off: orders are recorded
        // as Pending Payment and the team confirms payment manually.
        paymentGatewayConnected: false,
      };
    },
  }),

  createOrder: defineAction({
    description:
      "Creates a physical-product order from a saved coloring project. The price is computed on the server from the centralized product configuration (client-sent prices are never trusted), the artwork is snapshotted from the project row, and the order starts as Pending Payment.",
    request: z.object({
      projectId: z.number().int().positive(),
      productType: z.enum(["poster", "figurine", "tshirt"]),
      tshirtColor: z.string().max(40).default(""),
      tshirtSize: z.string().max(40).default(""),
      childName: z.string().trim().max(24).default(""),
      couponCode: z.string().trim().max(24).default(""),
      customerName: z.string().trim().min(2, "Nama pemesan wajib diisi.").max(80),
      whatsapp: z.string().trim().min(9, "Nomor WhatsApp wajib diisi.").max(20),
      email: z.string().trim().email("Format email belum benar.").max(120),
      address: z.string().trim().min(10, "Alamat pengiriman wajib diisi lengkap.").max(500),
      notes: z.string().trim().max(300).default(""),
    }),
    response: z.object({ order: orderOut }),
    async handler(ctx, args) {
      const digits = args.whatsapp.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 15) {
        throw new Error("Nomor WhatsApp harus 9–15 digit angka.");
      }
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, args.projectId))
        .limit(1);
      const project = rows[0];
      if (!project) {
        throw new Error("Karya untuk pesanan ini tidak ditemukan. Kembali ke Studio Mewarnai dan simpan dulu karyamu.");
      }
      let colors: Record<string, string> = {};
      try {
        const parsed = JSON.parse(project.colors) as Record<string, string>;
        if (parsed && typeof parsed === "object") colors = parsed;
      } catch {
        colors = {};
      }
      if (Object.keys(colors).length === 0) {
        throw new Error("Karya ini belum diwarnai — warnai dulu minimal satu bagian sebelum memesan.");
      }

      let variant = "";
      let price = 0;
      if (args.productType === "poster") {
        price = POSTER_BASE_PRICE;
        variant = "Poster berbingkai";
      } else if (args.productType === "figurine") {
        price = FIGURINE_BASE_PRICE;
        variant = "Figurine custom — melewati Design Review";
      } else {
        price = TSHIRT_BASE_PRICE;
        if (!(TSHIRT_COLORS as readonly string[]).includes(args.tshirtColor)) {
          throw new Error("Pilih warna kaos yang tersedia: Cream, Mustard, Terracotta, Sage Green, atau Brown.");
        }
        if (!(TSHIRT_SIZES as readonly string[]).includes(args.tshirtSize)) {
          throw new Error("Pilih ukuran kaos yang tersedia.");
        }
        variant = `Kaos ${args.tshirtColor} · ukuran ${args.tshirtSize}`;
      }

      // Affiliate coupon (brief Part 3.7): validated on the server —
      // the code must belong to an active affiliate. The discount comes
      // from the affiliate's configured rate, never from the client.
      let affiliate: AffiliateRow | null = null;
      let discountAmount = 0;
      const couponInput = args.couponCode.trim().toUpperCase();
      if (couponInput) {
        const rows = await db
          .select()
          .from(schema.affiliates)
          .where(eq(schema.affiliates.couponCode, couponInput))
          .limit(1);
        const found = rows[0];
        if (!found || found.status !== "active") {
          throw new Error("Kode kupon tidak ditemukan atau sudah tidak aktif. Periksa lagi kode-nya, atau lanjutkan tanpa kupon.");
        }
        affiliate = found;
        discountAmount = Math.floor((price * found.discountPct) / 100);
      }
      const netSubtotal = price - discountAmount;

      // Unique QRIS payment identifier (brief Part 4.2): Rp1–999 chosen
      // so the exact payable total (net + code, shipping still 0 at this
      // point) does not collide with any other order still waiting to be
      // matched to a real transfer. Stored on the order and never
      // regenerated, so a page refresh keeps the same amount.
      const activeOrders = await db
        .select({ total: schema.orders.total, uniqueCode: schema.orders.uniqueCode })
        .from(schema.orders)
        .where(inArray(schema.orders.payState, ["awaiting", "waiting_verification"]));
      const takenTotals = new Set(activeOrders.map((o) => o.total + o.uniqueCode));
      let uniqueCode = 0;
      for (let attempt = 0; attempt < 300 && uniqueCode === 0; attempt++) {
        const candidate = 1 + Math.floor(Math.random() * 999);
        if (!takenTotals.has(netSubtotal + candidate)) uniqueCode = candidate;
      }
      if (uniqueCode === 0) {
        for (let candidate = 1; candidate <= 999; candidate++) {
          if (!takenTotals.has(netSubtotal + candidate)) {
            uniqueCode = candidate;
            break;
          }
        }
      }
      if (uniqueCode === 0) throw new Error("Kode pembayaran unik sedang penuh — coba lagi sebentar.");

      const now = new Date();
      let code = "";
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        const candidate = makeOrderCode();
        const clash = await db
          .select({ id: schema.orders.id })
          .from(schema.orders)
          .where(eq(schema.orders.code, candidate))
          .limit(1);
        if (clash.length === 0) code = candidate;
      }
      if (!code) throw new Error("Kode pesanan tidak bisa dibuat — coba lagi sebentar.");

      const result = await db
        .insert(schema.orders)
        .values({
          code,
          projectId: project.id,
          templateId: project.templateId,
          customDef: project.customDef,
          childName: args.childName || project.childName,
          message: project.message,
          nameFont: project.nameFont,
          nameColor: project.nameColor,
          nameAlign: project.nameAlign,
          colors: project.colors,
          strokes: project.strokes,
          productType: args.productType,
          variant,
          productPrice: price,
          couponCode: affiliate ? affiliate.couponCode : "",
          affiliateId: affiliate ? affiliate.id : null,
          discountAmount,
          uniqueCode,
          payState: "awaiting",
          paymentConfirmedAt: null,
          shippingCost: null,
          total: netSubtotal,
          customerName: args.customerName,
          whatsapp: digits,
          email: args.email,
          address: args.address,
          notes: args.notes,
          paymentStatus: "pending",
          orderStatus: "pending_payment",
          trackingNumber: "",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const row = result[0];
      if (!row) throw new Error("Pesanan tidak bisa disimpan — coba lagi sebentar.");
      // Attribution is recorded once, at order creation (the unique
      // order_id on the commission row makes duplicates impossible).
      await syncCommission(db, row, "created");
      ctx.invalidateQueries();
      return { order: orderToOut(row) };
    },
  }),

  listOrders: defineAction({
    description: "Lists all physical-product orders for the admin dashboard, newest first.",
    request: z.object({
      limit: z.number().int().positive().max(100).default(50),
    }),
    response: z.object({ orders: z.array(orderOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.createdAt))
        .limit(args.limit);
      return { orders: rows.map(orderToOut) };
    },
  }),

  updateOrder: defineAction({
    description:
      "Admin update for one order: payment status, order status, tracking number, and the team-confirmed shipping cost. Enforces the fulfilment rules on the server: production stages require a verified paid payment, and Shipped requires a tracking number.",
    request: z.object({
      id: z.number().int().positive(),
      paymentStatus: z
        .enum(["pending", "waiting_verification", "paid", "rejected", "failed", "cancelled", "refunded"])
        .optional(),
      orderStatus: z
        .enum([
          "pending_payment",
          "paid",
          "confirmed",
          "design_review",
          "production",
          "ready_to_ship",
          "shipped",
          "completed",
          "cancelled",
        ])
        .optional(),
      trackingNumber: z.string().trim().max(60).optional(),
      shippingCost: z.number().int().min(0).max(1000000).optional(),
    }),
    response: z.object({ order: orderOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, args.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("Pesanan tidak ditemukan.");

      let paymentStatus = args.paymentStatus ?? row.paymentStatus;
      let orderStatus = args.orderStatus ?? row.orderStatus;
      // Marking payment as verified-paid advances a still-pending order.
      if (args.paymentStatus === "paid" && orderStatus === "pending_payment") {
        orderStatus = "paid";
      }
      const advanced = ["confirmed", "design_review", "production", "ready_to_ship", "shipped", "completed"];
      if (advanced.includes(orderStatus) && paymentStatus !== "paid") {
        throw new Error("Tahap produksi hanya bisa dimulai setelah pembayaran terverifikasi (status pembayaran = Lunas).");
      }
      const trackingNumber = args.trackingNumber ?? row.trackingNumber;
      if (orderStatus === "shipped" && !trackingNumber) {
        throw new Error("Nomor resi wajib diisi sebelum status diubah ke Dikirim.");
      }
      const shippingCost = args.shippingCost !== undefined ? args.shippingCost : row.shippingCost;
      const total = row.productPrice - row.discountAmount + (shippingCost ?? 0);

      // Keep the QRIS pay-state and the commission ledger in step when
      // the admin drives the order from this general editor too.
      let payState = row.payState;
      if (paymentStatus === "paid" && payState !== "verified") payState = "verified";
      if (paymentStatus === "refunded") payState = "refunded";

      const result = await db
        .update(schema.orders)
        .set({
          paymentStatus,
          orderStatus,
          trackingNumber,
          shippingCost,
          total,
          payState,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, args.id))
        .returning();
      const updated = result[0];
      if (!updated) throw new Error("Pesanan tidak ditemukan.");
      if (paymentStatus === "paid" && row.paymentStatus !== "paid") await syncCommission(db, updated, "verified");
      if (orderStatus === "completed" && row.orderStatus !== "completed") await syncCommission(db, updated, "completed");
      if (paymentStatus === "refunded" && row.paymentStatus !== "refunded") await syncCommission(db, updated, "reversed");
      ctx.invalidateQueries();
      return { order: orderToOut(updated) };
    },
  }),

  trackOrder: defineAction({
    description:
      "Customer order lookup by order code + WhatsApp number. Returns the order (including its artwork snapshot) only when both match, so order details and the paid poster production file cannot be reached by guessing a URL or code alone.",
    request: z.object({
      code: z.string().trim().min(4).max(24),
      whatsapp: z.string().trim().min(9).max(20),
    }),
    response: z.object({ order: orderOut.nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.code, args.code.trim().toUpperCase()))
        .limit(1);
      const row = rows[0];
      if (!row) return { order: null };
      if (normalizeWa(row.whatsapp) !== normalizeWa(args.whatsapp)) return { order: null };
      return { order: orderToOut(row) };
    },
  }),

  validateCoupon: defineAction({
    description:
      "Validates an affiliate coupon code at checkout and returns the customer discount percentage configured for it. Invalid, unknown, or non-active codes are rejected.",
    request: z.object({ code: z.string().trim().min(3).max(24) }),
    response: z.object({
      valid: z.boolean(),
      code: z.string(),
      discountPct: z.number(),
      message: z.string(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const code = args.code.trim().toUpperCase();
      const rows = await db
        .select()
        .from(schema.affiliates)
        .where(eq(schema.affiliates.couponCode, code))
        .limit(1);
      const affiliate = rows[0];
      if (!affiliate || affiliate.status !== "active") {
        return {
          valid: false,
          code,
          discountPct: 0,
          message: "Kode kupon tidak ditemukan atau sudah tidak aktif.",
        };
      }
      return {
        valid: true,
        code,
        discountPct: affiliate.discountPct,
        message: `Kupon aktif — diskon ${affiliate.discountPct}% dari harga produk.`,
      };
    },
  }),

  confirmTransfer: defineAction({
    description:
      "Customer one-click 'Saya Sudah Transfer' confirmation for a QRIS order (order code + WhatsApp must match). Records the timestamp and moves the order to Waiting for Verification — it never marks the order Paid; only an admin verification does that.",
    request: z.object({
      code: z.string().trim().min(4).max(24),
      whatsapp: z.string().trim().min(9).max(20),
    }),
    response: z.object({
      ok: z.boolean(),
      payState: z.enum(["awaiting", "waiting_verification", "verified", "rejected", "unmatched", "refunded", "not_found"]),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.code, args.code.trim().toUpperCase()))
        .limit(1);
      const row = rows[0];
      if (!row) return { ok: false, payState: "not_found" as const };
      if (normalizeWa(row.whatsapp) !== normalizeWa(args.whatsapp)) return { ok: false, payState: "not_found" as const };
      if (row.payState === "verified") return { ok: true, payState: "verified" as const };
      if (row.payState === "waiting_verification") return { ok: true, payState: "waiting_verification" as const };
      if (row.payState === "rejected" || row.payState === "refunded") return { ok: false, payState: row.payState };
      const now = new Date();
      await db
        .update(schema.orders)
        .set({
          payState: "waiting_verification",
          paymentStatus: "waiting_verification",
          paymentConfirmedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.orders.id, row.id));
      await audit(db, row.affiliateId, "payment.customer_confirmed", `Pesanan ${row.code} — pelanggan menekan "Saya Sudah Transfer".`);
      ctx.invalidateQueries();
      return { ok: true, payState: "waiting_verification" as const };
    },
  }),

  verifyOrderPayment: defineAction({
    description:
      "Admin QRIS payment verification for one order: verify (payment becomes Paid, commission confirmed), reject, mark unmatched, or refund (commission reversed). A customer confirmation alone never reaches Paid — only this action does.",
    request: z.object({
      id: z.number().int().positive(),
      decision: z.enum(["verify", "reject", "unmatched", "refund"]),
    }),
    response: z.object({ order: orderOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.orders).where(eq(schema.orders.id, args.id)).limit(1);
      const row = rows[0];
      if (!row) throw new Error("Pesanan tidak ditemukan.");
      const now = new Date();
      let updated: OrderRow | undefined;
      if (args.decision === "verify") {
        if (row.payState === "verified") return { order: orderToOut(row) };
        if (row.payState === "refunded" || row.payState === "rejected") {
          throw new Error("Pesanan ini sudah ditolak/direfund — tidak bisa diverifikasi lagi.");
        }
        const result = await db
          .update(schema.orders)
          .set({
            payState: "verified",
            paymentStatus: "paid",
            orderStatus: row.orderStatus === "pending_payment" ? "paid" : row.orderStatus,
            updatedAt: now,
          })
          .where(eq(schema.orders.id, row.id))
          .returning();
        updated = result[0];
        if (updated) await syncCommission(db, updated, "verified");
        await audit(db, row.affiliateId, "payment.verified", `Pesanan ${row.code} diverifikasi lunas oleh admin (total bayar ${row.total + row.uniqueCode}).`);
      } else if (args.decision === "reject") {
        const result = await db
          .update(schema.orders)
          .set({ payState: "rejected", paymentStatus: "rejected", updatedAt: now })
          .where(eq(schema.orders.id, row.id))
          .returning();
        updated = result[0];
        if (updated) await syncCommission(db, updated, "reversed");
        await audit(db, row.affiliateId, "payment.rejected", `Pesanan ${row.code} — pembayaran ditolak admin.`);
      } else if (args.decision === "unmatched") {
        const result = await db
          .update(schema.orders)
          .set({ payState: "unmatched", updatedAt: now })
          .where(eq(schema.orders.id, row.id))
          .returning();
        updated = result[0];
        await audit(db, row.affiliateId, "payment.unmatched", `Pesanan ${row.code} ditandai belum cocok (unmatched).`);
      } else {
        const result = await db
          .update(schema.orders)
          .set({ payState: "refunded", paymentStatus: "refunded", updatedAt: now })
          .where(eq(schema.orders.id, row.id))
          .returning();
        updated = result[0];
        if (updated) await syncCommission(db, updated, "reversed");
        await audit(db, row.affiliateId, "payment.refunded", `Pesanan ${row.code} direfund; komisi terkait dibalikkan.`);
      }
      if (!updated) throw new Error("Pesanan tidak ditemukan.");
      ctx.invalidateQueries();
      return { order: orderToOut(updated) };
    },
  }),

  /* ------------------------- Affiliate: admin ------------------------- */

  adminCreateAffiliate: defineAction({
    description:
      "Admin: creates an affiliate account (pending) with a unique coupon code and generates its secure single-use invitation token, expiring after the configured duration (default 72 hours).",
    request: z.object({
      fullName: z.string().trim().min(2, "Nama afiliasi wajib diisi.").max(80),
      email: z.string().trim().email("Format email belum benar.").max(120),
      whatsapp: z.string().trim().max(20).default(""),
      instagram: z.string().trim().max(40).default(""),
      tiktok: z.string().trim().max(40).default(""),
      couponCode: z
        .string()
        .trim()
        .min(3, "Kode kupon minimal 3 karakter.")
        .max(24)
        .regex(/^[A-Za-z0-9_-]+$/, "Kode kupon hanya boleh huruf, angka, strip, dan garis bawah."),
      discountPct: z.number().int().min(0).max(90).default(10),
      commissionPct: z.number().int().min(0).max(100).default(30),
    }),
    response: z.object({ affiliate: affiliatePublicOut, inviteToken: z.string(), inviteExpiresAt: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const coupon = args.couponCode.trim().toUpperCase();
      const email = args.email.trim().toLowerCase();
      const byCoupon = await db.select({ id: schema.affiliates.id }).from(schema.affiliates).where(eq(schema.affiliates.couponCode, coupon)).limit(1);
      if (byCoupon.length > 0) throw new Error(`Kode kupon ${coupon} sudah dipakai afiliasi lain.`);
      const byEmail = await db.select({ id: schema.affiliates.id }).from(schema.affiliates).where(eq(schema.affiliates.email, email)).limit(1);
      if (byEmail.length > 0) throw new Error("Email ini sudah terdaftar sebagai afiliasi.");
      const now = new Date();
      const inserted = await db
        .insert(schema.affiliates)
        .values({
          name: args.fullName.trim(),
          email,
          whatsapp: args.whatsapp.replace(/\D/g, ""),
          instagram: args.instagram.trim().replace(/^@/, ""),
          tiktok: args.tiktok.trim().replace(/^@/, ""),
          couponCode: coupon,
          discountPct: args.discountPct,
          commissionPct: args.commissionPct,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const affiliate = inserted[0];
      if (!affiliate) throw new Error("Afiliasi tidak bisa dibuat — coba lagi.");
      const cfg = await affiliateConfig(db);
      const token = randomToken(24);
      const expires = new Date(now.getTime() + cfg.inviteExpiryHours * 3600 * 1000);
      await db.insert(schema.affiliateInvitations).values({
        affiliateId: affiliate.id,
        token,
        expiresAt: expires,
        createdAt: now,
      });
      await audit(db, affiliate.id, "affiliate.created", `Afiliasi ${affiliate.name} dibuat dengan kupon ${coupon} (diskon ${args.discountPct}%, komisi ${args.commissionPct}%).`);
      ctx.invalidateQueries();
      return { affiliate: toAffiliatePublic(affiliate), inviteToken: token, inviteExpiresAt: expires.toISOString() };
    },
  }),

  adminListAffiliates: defineAction({
    description:
      "Admin: lists all affiliates with invitation state, performance totals (attributed orders, net sales, commission), and pending payout amounts.",
    request: z.object({}),
    response: z.object({
      affiliates: z.array(
        affiliatePublicOut.extend({
          whatsapp: z.string(),
          instagram: z.string(),
          tiktok: z.string(),
          inviteState: z.enum(["none", "pending", "used", "expired", "revoked"]),
          inviteToken: z.string(),
          inviteExpiresAt: z.string().nullable(),
          pinResetRequested: z.boolean(),
          totalOrders: z.number(),
          netSales: z.number(),
          totalCommission: z.number(),
          pendingPayout: z.number(),
          kpiTargetOrders: z.number(),
          kpiTargetRevenue: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.affiliates).orderBy(desc(schema.affiliates.createdAt));
      const out = [];
      for (const a of rows) {
        const invites = await db
          .select()
          .from(schema.affiliateInvitations)
          .where(eq(schema.affiliateInvitations.affiliateId, a.id))
          .orderBy(desc(schema.affiliateInvitations.createdAt))
          .limit(1);
        const invite = invites[0];
        let inviteState: "none" | "pending" | "used" | "expired" | "revoked" = "none";
        if (invite) {
          if (invite.usedAt) inviteState = "used";
          else if (invite.revokedAt) inviteState = "revoked";
          else if (invite.expiresAt.getTime() < Date.now()) inviteState = "expired";
          else inviteState = "pending";
        }
        const comms = await db.select().from(schema.commissions).where(eq(schema.commissions.affiliateId, a.id));
        const counted = comms.filter((c) => c.status === "confirmed" || c.status === "payable" || c.status === "paid");
        const payoutRows = await db
          .select()
          .from(schema.payouts)
          .where(and(eq(schema.payouts.affiliateId, a.id), inArray(schema.payouts.status, ["requested", "approved"])));
        out.push({
          ...toAffiliatePublic(a),
          whatsapp: a.whatsapp,
          instagram: a.instagram,
          tiktok: a.tiktok,
          inviteState,
          inviteToken: inviteState === "pending" && invite ? invite.token : "",
          inviteExpiresAt: invite ? invite.expiresAt.toISOString() : null,
          pinResetRequested: a.pinResetRequestedAt != null,
          totalOrders: counted.length,
          netSales: counted.reduce((s, c) => s + c.netSubtotal, 0),
          totalCommission: counted.reduce((s, c) => s + c.amount, 0),
          pendingPayout: payoutRows.reduce((s, p) => s + p.amount, 0),
          kpiTargetOrders: a.kpiTargetOrders,
          kpiTargetRevenue: a.kpiTargetRevenue,
        });
      }
      return { affiliates: out };
    },
  }),

  adminUpdateAffiliate: defineAction({
    description:
      "Admin: updates an affiliate's status (suspending revokes all sessions), coupon code, customer discount %, commission %, and monthly KPI targets. Every change is audit-logged.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["pending", "active", "suspended"]).optional(),
      couponCode: z.string().trim().min(3).max(24).optional(),
      discountPct: z.number().int().min(0).max(90).optional(),
      commissionPct: z.number().int().min(0).max(100).optional(),
      kpiTargetOrders: z.number().int().min(0).max(100000).optional(),
      kpiTargetRevenue: z.number().int().min(0).max(2000000000).optional(),
    }),
    response: z.object({ affiliate: affiliatePublicOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, args.id)).limit(1);
      const row = rows[0];
      if (!row) throw new Error("Afiliasi tidak ditemukan.");
      const changes: string[] = [];
      const patch: Partial<AffiliateRow> = { updatedAt: new Date() };
      if (args.status && args.status !== row.status) {
        patch.status = args.status;
        changes.push(`status ${row.status} → ${args.status}`);
      }
      if (args.couponCode) {
        const coupon = args.couponCode.trim().toUpperCase();
        if (coupon !== row.couponCode) {
          const clash = await db
            .select({ id: schema.affiliates.id })
            .from(schema.affiliates)
            .where(eq(schema.affiliates.couponCode, coupon))
            .limit(1);
          if (clash.length > 0) throw new Error(`Kode kupon ${coupon} sudah dipakai afiliasi lain.`);
          patch.couponCode = coupon;
          changes.push(`kupon ${row.couponCode} → ${coupon}`);
        }
      }
      if (args.discountPct !== undefined && args.discountPct !== row.discountPct) {
        patch.discountPct = args.discountPct;
        changes.push(`diskon ${row.discountPct}% → ${args.discountPct}%`);
      }
      if (args.commissionPct !== undefined && args.commissionPct !== row.commissionPct) {
        patch.commissionPct = args.commissionPct;
        changes.push(`komisi ${row.commissionPct}% → ${args.commissionPct}%`);
      }
      if (args.kpiTargetOrders !== undefined) patch.kpiTargetOrders = args.kpiTargetOrders;
      if (args.kpiTargetRevenue !== undefined) patch.kpiTargetRevenue = args.kpiTargetRevenue;
      if (args.kpiTargetOrders !== undefined || args.kpiTargetRevenue !== undefined) {
        changes.push(`target KPI diperbarui (${args.kpiTargetOrders ?? row.kpiTargetOrders} pesanan / Rp${args.kpiTargetRevenue ?? row.kpiTargetRevenue})`);
      }
      const result = await db
        .update(schema.affiliates)
        .set(patch)
        .where(eq(schema.affiliates.id, args.id))
        .returning();
      const updated = result[0];
      if (!updated) throw new Error("Afiliasi tidak ditemukan.");
      if (patch.status === "suspended") {
        await db
          .update(schema.affiliateSessions)
          .set({ revokedAt: new Date() })
          .where(eq(schema.affiliateSessions.affiliateId, args.id));
      }
      if (changes.length > 0) await audit(db, args.id, "affiliate.updated", changes.join("; "));
      ctx.invalidateQueries();
      return { affiliate: toAffiliatePublic(updated) };
    },
  }),

  adminRegenerateInvite: defineAction({
    description:
      "Admin: revokes any open invitation for an affiliate and issues a fresh single-use invitation token with a new expiry.",
    request: z.object({ affiliateId: z.number().int().positive() }),
    response: z.object({ inviteToken: z.string(), inviteExpiresAt: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, args.affiliateId)).limit(1);
      if (!rows[0]) throw new Error("Afiliasi tidak ditemukan.");
      const now = new Date();
      const open = await db
        .select()
        .from(schema.affiliateInvitations)
        .where(eq(schema.affiliateInvitations.affiliateId, args.affiliateId));
      for (const inv of open) {
        if (!inv.usedAt && !inv.revokedAt) {
          await db
            .update(schema.affiliateInvitations)
            .set({ revokedAt: now })
            .where(eq(schema.affiliateInvitations.id, inv.id));
        }
      }
      const cfg = await affiliateConfig(db);
      const token = randomToken(24);
      const expires = new Date(now.getTime() + cfg.inviteExpiryHours * 3600 * 1000);
      await db.insert(schema.affiliateInvitations).values({
        affiliateId: args.affiliateId,
        token,
        expiresAt: expires,
        createdAt: now,
      });
      await audit(db, args.affiliateId, "invite.regenerated", `Tautan undangan dibuat ulang; berlaku sampai ${expires.toISOString()}.`);
      ctx.invalidateQueries();
      return { inviteToken: token, inviteExpiresAt: expires.toISOString() };
    },
  }),

  adminRevokeInvite: defineAction({
    description: "Admin: revokes an affiliate's open invitation link so it can no longer activate the account.",
    request: z.object({ affiliateId: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const open = await db
        .select()
        .from(schema.affiliateInvitations)
        .where(eq(schema.affiliateInvitations.affiliateId, args.affiliateId));
      for (const inv of open) {
        if (!inv.usedAt && !inv.revokedAt) {
          await db
            .update(schema.affiliateInvitations)
            .set({ revokedAt: now })
            .where(eq(schema.affiliateInvitations.id, inv.id));
        }
      }
      await audit(db, args.affiliateId, "invite.revoked", "Tautan undangan dicabut oleh admin.");
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  adminGetPinReset: defineAction({
    description:
      "Admin: returns an affiliate's pending PIN-reset token (created when the affiliate used Forgot PIN) so the admin can share the reset link through the affiliate's verified email/WhatsApp. PINs themselves are never readable.",
    request: z.object({ affiliateId: z.number().int().positive() }),
    response: z.object({
      requested: z.boolean(),
      resetToken: z.string(),
      resetExpiresAt: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, args.affiliateId)).limit(1);
      const a = rows[0];
      if (!a) throw new Error("Afiliasi tidak ditemukan.");
      const valid = a.resetToken !== "" && a.resetExpiresAt != null && a.resetExpiresAt.getTime() > Date.now();
      return {
        requested: a.pinResetRequestedAt != null,
        resetToken: valid ? a.resetToken : "",
        resetExpiresAt: a.resetExpiresAt ? a.resetExpiresAt.toISOString() : null,
      };
    },
  }),

  getAffiliateConfig: defineAction({
    description: "Returns the affiliate program configuration: minimum withdrawal amount and invitation link lifetime in hours.",
    request: z.object({}),
    response: z.object({ minWithdrawal: z.number(), inviteExpiryHours: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      return await affiliateConfig(db);
    },
  }),

  updateAffiliateConfig: defineAction({
    description: "Admin: updates the affiliate program configuration (minimum withdrawal, invitation lifetime).",
    request: z.object({
      minWithdrawal: z.number().int().min(0).max(10000000),
      inviteExpiryHours: z.number().int().min(1).max(720),
    }),
    response: z.object({ minWithdrawal: z.number(), inviteExpiryHours: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
      if (rows[0]) {
        await db
          .update(schema.settings)
          .set({ minWithdrawal: args.minWithdrawal, inviteExpiryHours: args.inviteExpiryHours })
          .where(eq(schema.settings.id, 1));
      } else {
        await db.insert(schema.settings).values({
          id: 1,
          brandName: "Bun & Fleur Kids",
          minWithdrawal: args.minWithdrawal,
          inviteExpiryHours: args.inviteExpiryHours,
        });
      }
      await audit(db, null, "affiliate.config_updated", `Minimum penarikan Rp${args.minWithdrawal}; masa berlaku undangan ${args.inviteExpiryHours} jam.`);
      ctx.invalidateQueries();
      return { minWithdrawal: args.minWithdrawal, inviteExpiryHours: args.inviteExpiryHours };
    },
  }),

  adminListPayouts: defineAction({
    description: "Admin: lists all affiliate payout requests with the affiliate's name, newest first.",
    request: z.object({ limit: z.number().int().positive().max(100).default(50) }),
    response: z.object({
      payouts: z.array(
        z.object({
          id: z.number(),
          affiliateId: z.number(),
          affiliateName: z.string(),
          amount: z.number(),
          bankName: z.string(),
          accountName: z.string(),
          accountNumber: z.string(),
          status: z.enum(["requested", "approved", "paid", "rejected"]),
          note: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.payouts).orderBy(desc(schema.payouts.createdAt)).limit(args.limit);
      const out = [];
      for (const p of rows) {
        const aff = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, p.affiliateId)).limit(1);
        out.push({
          id: p.id,
          affiliateId: p.affiliateId,
          affiliateName: aff[0]?.name ?? "(afiliasi terhapus)",
          amount: p.amount,
          bankName: p.bankName,
          accountName: p.accountName,
          accountNumber: p.accountNumber,
          status: p.status,
          note: p.note,
          createdAt: p.createdAt.toISOString(),
        });
      }
      return { payouts: out };
    },
  }),

  adminUpdatePayout: defineAction({
    description:
      "Admin: approves, rejects, or marks an affiliate payout as paid. Marking paid settles the affiliate's oldest payable commissions up to the payout amount.",
    request: z.object({
      id: z.number().int().positive(),
      decision: z.enum(["approve", "reject", "paid"]),
      note: z.string().max(200).default(""),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.payouts).where(eq(schema.payouts.id, args.id)).limit(1);
      const payout = rows[0];
      if (!payout) throw new Error("Permintaan penarikan tidak ditemukan.");
      const now = new Date();
      if (args.decision === "approve") {
        if (payout.status !== "requested") throw new Error("Hanya permintaan berstatus Diminta yang bisa disetujui.");
        await db.update(schema.payouts).set({ status: "approved", note: args.note || payout.note, updatedAt: now }).where(eq(schema.payouts.id, args.id));
        await audit(db, payout.affiliateId, "payout.approved", `Penarikan Rp${payout.amount} disetujui.`);
      } else if (args.decision === "reject") {
        if (payout.status === "paid") throw new Error("Penarikan yang sudah dibayar tidak bisa ditolak.");
        await db.update(schema.payouts).set({ status: "rejected", note: args.note || payout.note, updatedAt: now }).where(eq(schema.payouts.id, args.id));
        await audit(db, payout.affiliateId, "payout.rejected", `Penarikan Rp${payout.amount} ditolak. ${args.note}`.trim());
      } else {
        if (payout.status !== "approved" && payout.status !== "requested") {
          throw new Error("Penarikan ini tidak bisa ditandai dibayar dari statusnya sekarang.");
        }
        await db
          .update(schema.payouts)
          .set({ status: "paid", paidAt: now, note: args.note || payout.note, updatedAt: now })
          .where(eq(schema.payouts.id, args.id));
        // Settle payable commissions oldest-first up to the paid amount.
        let remaining = payout.amount;
        const payable = await db
          .select()
          .from(schema.commissions)
          .where(and(eq(schema.commissions.affiliateId, payout.affiliateId), eq(schema.commissions.status, "payable")))
          .orderBy(schema.commissions.createdAt);
        for (const c of payable) {
          if (remaining <= 0) break;
          if (c.amount <= remaining) {
            await db
              .update(schema.commissions)
              .set({ status: "paid", payoutId: payout.id, updatedAt: now })
              .where(eq(schema.commissions.id, c.id));
            remaining -= c.amount;
          }
        }
        await audit(db, payout.affiliateId, "payout.paid", `Penarikan Rp${payout.amount} ditandai sudah ditransfer.`);
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  adminListAffiliateAudit: defineAction({
    description: "Admin: recent affiliate/payment audit-log entries, newest first.",
    request: z.object({ limit: z.number().int().positive().max(100).default(30) }),
    response: z.object({
      entries: z.array(
        z.object({ id: z.number(), affiliateId: z.number().nullable(), action: z.string(), detail: z.string(), createdAt: z.string() }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.affiliateAudit).orderBy(desc(schema.affiliateAudit.createdAt)).limit(args.limit);
      return {
        entries: rows.map((r) => ({
          id: r.id,
          affiliateId: r.affiliateId,
          action: r.action,
          detail: r.detail,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  /* ------------------------ Affiliate: public ------------------------ */

  getInvitation: defineAction({
    description:
      "Looks up an affiliate invitation token for the welcome page: returns the affiliate's name only while the invitation is still valid (unused, unrevoked, unexpired).",
    request: z.object({ token: z.string().trim().min(8).max(80) }),
    response: z.object({
      valid: z.boolean(),
      reason: z.enum(["ok", "not_found", "used", "revoked", "expired"]),
      affiliateName: z.string(),
      expiresAt: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.affiliateInvitations)
        .where(eq(schema.affiliateInvitations.token, args.token.trim()))
        .limit(1);
      const invite = rows[0];
      if (!invite) return { valid: false, reason: "not_found" as const, affiliateName: "", expiresAt: null };
      if (invite.usedAt) return { valid: false, reason: "used" as const, affiliateName: "", expiresAt: null };
      if (invite.revokedAt) return { valid: false, reason: "revoked" as const, affiliateName: "", expiresAt: null };
      if (invite.expiresAt.getTime() < Date.now()) {
        return { valid: false, reason: "expired" as const, affiliateName: "", expiresAt: invite.expiresAt.toISOString() };
      }
      const aff = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, invite.affiliateId)).limit(1);
      return {
        valid: true,
        reason: "ok" as const,
        affiliateName: aff[0]?.name ?? "",
        expiresAt: invite.expiresAt.toISOString(),
      };
    },
  }),

  acceptInvitation: defineAction({
    description:
      "Affiliate activation: verifies the invitation token plus the affiliate's registered email or WhatsApp, sets their 4-digit PIN (hashed, trivial PINs refused), marks the invitation used, and opens a server-side session.",
    request: z.object({
      token: z.string().trim().min(8).max(80),
      identity: z.string().trim().min(3).max(120),
      pin: z.string().regex(/^\d{4}$/, "PIN harus tepat 4 digit angka."),
    }),
    response: z.object({ sessionToken: z.string(), affiliate: affiliatePublicOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (isTrivialPin(args.pin)) {
        throw new Error("PIN itu terlalu mudah ditebak (contoh: 0000, 1111, 1234). Pilih kombinasi lain ya.");
      }
      const invites = await db
        .select()
        .from(schema.affiliateInvitations)
        .where(eq(schema.affiliateInvitations.token, args.token.trim()))
        .limit(1);
      const invite = invites[0];
      if (!invite || invite.usedAt || invite.revokedAt) {
        throw new Error("Tautan undangan ini sudah tidak berlaku. Minta tautan baru ke tim Bun & Fleur Kids.");
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        throw new Error("Tautan undangan sudah kedaluwarsa. Minta tautan baru ke tim Bun & Fleur Kids.");
      }
      const affRows = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, invite.affiliateId)).limit(1);
      const affiliate = affRows[0];
      if (!affiliate) throw new Error("Akun afiliasi untuk undangan ini tidak ditemukan.");
      if (affiliate.status === "suspended") throw new Error("Akun afiliasi ini sedang ditangguhkan.");
      // Identity confirmation: the email or WhatsApp the admin registered.
      const identity = args.identity.trim();
      const emailMatch = identity.includes("@") && identity.toLowerCase() === affiliate.email;
      const waMatch = !identity.includes("@") && affiliate.whatsapp !== "" && normalizeWa(identity) === normalizeWa(affiliate.whatsapp);
      if (!emailMatch && !waMatch) {
        throw new Error("Email / nomor WhatsApp tidak cocok dengan yang terdaftar. Periksa lagi, atau hubungi tim kami.");
      }
      const now = new Date();
      const pinHash = await hashPin(args.pin);
      await db
        .update(schema.affiliates)
        .set({ pinHash, status: "active", failedAttempts: 0, lockedUntil: null, updatedAt: now })
        .where(eq(schema.affiliates.id, affiliate.id));
      await db
        .update(schema.affiliateInvitations)
        .set({ usedAt: now })
        .where(eq(schema.affiliateInvitations.id, invite.id));
      const sessionToken = await createAffiliateSession(db, affiliate.id);
      await audit(db, affiliate.id, "affiliate.activated", "Akun diaktifkan lewat tautan undangan; PIN dibuat.");
      ctx.invalidateQueries();
      return { sessionToken, affiliate: toAffiliatePublic({ ...affiliate, status: "active" }) };
    },
  }),

  affiliateLogin: defineAction({
    description:
      "Returning affiliate login: identifier (registered email, WhatsApp, or coupon code) + 4-digit PIN. Five failed attempts lock the account for 15 minutes. Success returns a server-side session token.",
    request: z.object({
      identifier: z.string().trim().min(3).max(120),
      pin: z.string().regex(/^\d{4}$/, "PIN harus tepat 4 digit angka."),
    }),
    response: z.object({ sessionToken: z.string(), affiliate: affiliatePublicOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const identifier = args.identifier.trim();
      const all = await db.select().from(schema.affiliates);
      const affiliate = all.find(
        (a) =>
          a.email === identifier.toLowerCase() ||
          a.couponCode === identifier.toUpperCase() ||
          (a.whatsapp !== "" && normalizeWa(a.whatsapp) === normalizeWa(identifier)),
      );
      const genericError = "Identitas atau PIN salah. Periksa lagi ya.";
      if (!affiliate || affiliate.pinHash === "") throw new Error(genericError);
      if (affiliate.status === "suspended") {
        throw new Error("Akun afiliasi ini sedang ditangguhkan. Hubungi tim Bun & Fleur Kids untuk bantuan.");
      }
      const now = new Date();
      if (affiliate.lockedUntil && affiliate.lockedUntil.getTime() > now.getTime()) {
        const minutes = Math.max(1, Math.ceil((affiliate.lockedUntil.getTime() - now.getTime()) / 60000));
        throw new Error(`Terlalu banyak percobaan PIN salah. Akun terkunci sementara — coba lagi dalam ${minutes} menit.`);
      }
      const ok = await verifyPin(args.pin, affiliate.pinHash);
      if (!ok) {
        const attempts = affiliate.failedAttempts + 1;
        const lock = attempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null;
        await db
          .update(schema.affiliates)
          .set({ failedAttempts: lock ? 0 : attempts, lockedUntil: lock, updatedAt: now })
          .where(eq(schema.affiliates.id, affiliate.id));
        if (lock) {
          await audit(db, affiliate.id, "affiliate.locked", "Akun terkunci 15 menit setelah 5 PIN salah berturut-turut.");
          throw new Error("PIN salah 5 kali — akun terkunci sementara selama 15 menit demi keamanan.");
        }
        throw new Error(genericError);
      }
      await db
        .update(schema.affiliates)
        .set({ failedAttempts: 0, lockedUntil: null, updatedAt: now })
        .where(eq(schema.affiliates.id, affiliate.id));
      const sessionToken = await createAffiliateSession(db, affiliate.id);
      return { sessionToken, affiliate: toAffiliatePublic(affiliate) };
    },
  }),

  affiliateRequestPinReset: defineAction({
    description:
      "Forgot PIN: records a reset request and creates a single-use reset token valid for 1 hour. The token is shared by the admin through the affiliate's verified channel (the response never reveals whether the account exists).",
    request: z.object({ identifier: z.string().trim().min(3).max(120) }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const identifier = args.identifier.trim();
      const all = await db.select().from(schema.affiliates);
      const affiliate = all.find(
        (a) =>
          a.email === identifier.toLowerCase() ||
          a.couponCode === identifier.toUpperCase() ||
          (a.whatsapp !== "" && normalizeWa(a.whatsapp) === normalizeWa(identifier)),
      );
      if (affiliate && affiliate.pinHash !== "") {
        const now = new Date();
        await db
          .update(schema.affiliates)
          .set({
            pinResetRequestedAt: now,
            resetToken: randomToken(24),
            resetExpiresAt: new Date(now.getTime() + 3600 * 1000),
            updatedAt: now,
          })
          .where(eq(schema.affiliates.id, affiliate.id));
        await audit(db, affiliate.id, "pin.reset_requested", "Permintaan reset PIN diterima dari halaman login afiliasi.");
      }
      return { ok: true };
    },
  }),

  resetPinWithToken: defineAction({
    description:
      "Sets a new affiliate PIN from a single-use reset token (1-hour expiry), clears the request, revokes all existing sessions, and opens a fresh session.",
    request: z.object({
      token: z.string().trim().min(8).max(80),
      pin: z.string().regex(/^\d{4}$/, "PIN harus tepat 4 digit angka."),
    }),
    response: z.object({ sessionToken: z.string(), affiliate: affiliatePublicOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (isTrivialPin(args.pin)) {
        throw new Error("PIN itu terlalu mudah ditebak (contoh: 0000, 1111, 1234). Pilih kombinasi lain ya.");
      }
      const all = await db.select().from(schema.affiliates);
      const affiliate = all.find((a) => a.resetToken !== "" && a.resetToken === args.token.trim());
      if (!affiliate || !affiliate.resetExpiresAt || affiliate.resetExpiresAt.getTime() < Date.now()) {
        throw new Error("Tautan reset PIN tidak berlaku atau sudah kedaluwarsa. Minta tautan baru lewat admin.");
      }
      const now = new Date();
      const pinHash = await hashPin(args.pin);
      await db
        .update(schema.affiliates)
        .set({
          pinHash,
          status: affiliate.status === "pending" ? "active" : affiliate.status,
          failedAttempts: 0,
          lockedUntil: null,
          pinResetRequestedAt: null,
          resetToken: "",
          resetExpiresAt: null,
          updatedAt: now,
        })
        .where(eq(schema.affiliates.id, affiliate.id));
      await db
        .update(schema.affiliateSessions)
        .set({ revokedAt: now })
        .where(eq(schema.affiliateSessions.affiliateId, affiliate.id));
      const sessionToken = await createAffiliateSession(db, affiliate.id);
      await audit(db, affiliate.id, "pin.reset_completed", "PIN berhasil diatur ulang lewat tautan reset; semua sesi lama dicabut.");
      ctx.invalidateQueries();
      return { sessionToken, affiliate: toAffiliatePublic(affiliate) };
    },
  }),

  affiliateLogout: defineAction({
    description: "Revokes the affiliate's current dashboard session token.",
    request: z.object({ sessionToken: z.string().min(8).max(80) }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.affiliateSessions)
        .set({ revokedAt: new Date() })
        .where(eq(schema.affiliateSessions.token, args.sessionToken));
      return { ok: true };
    },
  }),

  affiliateMe: defineAction({
    description:
      "The private affiliate dashboard data for the session's affiliate only: profile, totals, commission wallet, daily sales series for the requested range, attributed order history (masked order codes, no customer personal data), monthly KPI progress against admin-configured targets, and payout history.",
    request: z.object({
      sessionToken: z.string().min(8).max(80),
      from: z.string().max(10).default(""),
      to: z.string().max(10).default(""),
    }),
    response: z.object({
      affiliate: affiliatePublicOut,
      minWithdrawal: z.number(),
      totalSales: z.number(),
      totalRevenue: z.number(),
      totalCommission: z.number(),
      availablePayout: z.number(),
      wallet: z.object({ pending: z.number(), confirmed: z.number(), payable: z.number(), paid: z.number() }),
      series: z.array(z.object({ date: z.string(), orders: z.number(), revenue: z.number(), commission: z.number() })),
      orders: z.array(
        z.object({
          date: z.string(),
          maskedCode: z.string(),
          productLabel: z.string(),
          netSubtotal: z.number(),
          commission: z.number(),
          status: z.enum(["pending", "confirmed", "payable", "paid", "reversed"]),
        }),
      ),
      kpi: z.object({
        configured: z.boolean(),
        targetOrders: z.number(),
        targetRevenue: z.number(),
        monthOrders: z.number(),
        monthRevenue: z.number(),
      }),
      payouts: z.array(
        z.object({
          id: z.number(),
          amount: z.number(),
          status: z.enum(["requested", "approved", "paid", "rejected"]),
          note: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const affiliate = await requireAffiliateSession(db, args.sessionToken);
      const cfg = await affiliateConfig(db);
      const comms = await db
        .select()
        .from(schema.commissions)
        .where(eq(schema.commissions.affiliateId, affiliate.id))
        .orderBy(desc(schema.commissions.createdAt));
      const orderRows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.affiliateId, affiliate.id))
        .orderBy(desc(schema.orders.createdAt));
      const orderById = new Map(orderRows.map((o) => [o.id, o]));
      const counted = comms.filter((c) => c.status === "confirmed" || c.status === "payable" || c.status === "paid");
      const sum = (list: typeof comms, key: "amount" | "netSubtotal") => list.reduce((s, c) => s + c[key], 0);
      const wallet = {
        pending: sum(comms.filter((c) => c.status === "pending"), "amount"),
        confirmed: sum(comms.filter((c) => c.status === "confirmed"), "amount"),
        payable: sum(comms.filter((c) => c.status === "payable"), "amount"),
        paid: sum(comms.filter((c) => c.status === "paid"), "amount"),
      };
      // Daily series over the requested range (default: last 30 days).
      const today = new Date();
      const dayKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const fromDate = args.from ? new Date(`${args.from}T00:00:00`) : new Date(today.getTime() - 29 * 86400000);
      const toDate = args.to ? new Date(`${args.to}T00:00:00`) : today;
      const series: { date: string; orders: number; revenue: number; commission: number }[] = [];
      const byDay = new Map<string, { orders: number; revenue: number; commission: number }>();
      for (const c of counted) {
        const k = dayKey(c.createdAt);
        const bucket = byDay.get(k) ?? { orders: 0, revenue: 0, commission: 0 };
        bucket.orders += 1;
        bucket.revenue += c.netSubtotal;
        bucket.commission += c.amount;
        byDay.set(k, bucket);
      }
      for (let t = fromDate.getTime(); t <= toDate.getTime(); t += 86400000) {
        const d = new Date(t);
        const k = dayKey(d);
        const bucket = byDay.get(k) ?? { orders: 0, revenue: 0, commission: 0 };
        series.push({ date: k, ...bucket });
        if (series.length > 366) break;
      }
      const productLabel = (t: string) =>
        t === "poster" ? "Printed Poster" : t === "figurine" ? "Custom 3D Figurine" : "Custom Printed T-Shirt";
      const orders = comms.slice(0, 50).map((c) => {
        const o = orderById.get(c.orderId);
        return {
          date: c.createdAt.toISOString(),
          maskedCode: o ? `${o.code.slice(0, 7)}•••` : "BFK-•••",
          productLabel: o ? productLabel(o.productType) : "Produk",
          netSubtotal: c.netSubtotal,
          commission: c.amount,
          status: c.status,
        };
      });
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthComms = counted.filter((c) => c.createdAt >= monthStart);
      const payoutRows = await db
        .select()
        .from(schema.payouts)
        .where(eq(schema.payouts.affiliateId, affiliate.id))
        .orderBy(desc(schema.payouts.createdAt))
        .limit(20);
      return {
        affiliate: toAffiliatePublic(affiliate),
        minWithdrawal: cfg.minWithdrawal,
        totalSales: counted.length,
        totalRevenue: sum(counted, "netSubtotal"),
        totalCommission: sum(counted, "amount"),
        availablePayout: wallet.payable,
        wallet,
        series,
        orders,
        kpi: {
          configured: affiliate.kpiTargetOrders > 0 || affiliate.kpiTargetRevenue > 0,
          targetOrders: affiliate.kpiTargetOrders,
          targetRevenue: affiliate.kpiTargetRevenue,
          monthOrders: monthComms.length,
          monthRevenue: sum(monthComms, "netSubtotal"),
        },
        payouts: payoutRows.map((p) => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          note: p.note,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    },
  }),

  affiliateRequestPayout: defineAction({
    description:
      "Affiliate withdrawal request: the amount must meet the admin-configured minimum and fit within the payable commission balance (minus amounts already requested/approved). Creates a payout the admin reviews.",
    request: z.object({
      sessionToken: z.string().min(8).max(80),
      amount: z.number().int().positive(),
      bankName: z.string().trim().min(2, "Nama bank / e-wallet wajib diisi.").max(60),
      accountName: z.string().trim().min(2, "Nama pemilik rekening wajib diisi.").max(80),
      accountNumber: z.string().trim().min(4, "Nomor rekening wajib diisi.").max(40),
    }),
    response: z.object({ ok: z.literal(true), payoutId: z.number() }),
    async handler(ctx, args): Promise<{ ok: true; payoutId: number }> {
      const db = ctx.db<typeof schema>();
      const affiliate = await requireAffiliateSession(db, args.sessionToken);
      const cfg = await affiliateConfig(db);
      if (args.amount < cfg.minWithdrawal) {
        throw new Error(`Minimum penarikan saat ini ${cfg.minWithdrawal.toLocaleString("id-ID")} rupiah.`);
      }
      const comms = await db
        .select()
        .from(schema.commissions)
        .where(and(eq(schema.commissions.affiliateId, affiliate.id), eq(schema.commissions.status, "payable")));
      const payableTotal = comms.reduce((s, c) => s + c.amount, 0);
      const open = await db
        .select()
        .from(schema.payouts)
        .where(and(eq(schema.payouts.affiliateId, affiliate.id), inArray(schema.payouts.status, ["requested", "approved"])));
      const openTotal = open.reduce((s, p) => s + p.amount, 0);
      if (args.amount > payableTotal - openTotal) {
        throw new Error("Jumlah melebihi komisi yang siap dicairkan saat ini.");
      }
      const now = new Date();
      const inserted = await db
        .insert(schema.payouts)
        .values({
          affiliateId: affiliate.id,
          amount: args.amount,
          bankName: args.bankName.trim(),
          accountName: args.accountName.trim(),
          accountNumber: args.accountNumber.trim(),
          status: "requested",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const payout = inserted[0];
      if (!payout) throw new Error("Permintaan penarikan tidak bisa disimpan — coba lagi.");
      await audit(db, affiliate.id, "payout.requested", `Permintaan penarikan Rp${args.amount} ke ${args.bankName.trim()}.`);
      ctx.invalidateQueries();
      return { ok: true, payoutId: payout.id };
    },
  }),

  updateSettings: defineAction({
    description: "Updates the configurable brand name shown across the app.",
    request: z.object({ brandName: z.string().trim().min(1).max(40) }),
    response: z.object({ brandName: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .insert(schema.settings)
        .values({ id: 1, brandName: args.brandName })
        .onConflictDoUpdate({
          target: schema.settings.id,
          set: { brandName: args.brandName },
        });
      ctx.invalidateQueries();
      return { brandName: args.brandName };
    },
  }),
} satisfies ActionsModule;
