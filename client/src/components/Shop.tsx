// "Free to Color, Pay to Create" — the monetization flow that starts when
// a parent taps "Jadikan Nyata" on a finished artwork:
//
//   Masterpiece (choose product) → Customize → Checkout → Confirmation
//
// plus the customer order tracking and the admin order manager used in
// the Parent Dashboard. Prices come from the server's getShopConfig and
// are recomputed by the createOrder action — nothing here can set a
// price. No payment gateway is connected to this project yet, so
// checkout honestly records a Pending Payment order that the team
// completes via WhatsApp; nothing on these screens pretends an online
// payment happened.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import { api, type ApiResponse } from "../api";
import type { Actions } from "../../../server/src/actions";
import { NAME_FONTS, type TemplateDef } from "../lib/model";
import { getTemplate } from "../lib/registry";
import { buildCustomTemplate, parseCustomDef } from "../lib/custom";
import { downloadBlob } from "../lib/pdf";
import { ArtworkSvg, type Stroke } from "./ColoringEditor";
import { ModelViewer } from "./ModelViewer";
import { PillowViewer } from "./PillowViewer";
import qrisUrl from "../assets/qris.png";

const FIELDS = actionFields<typeof Actions>();

export type ProductId = "poster" | "figurine" | "tshirt";
export type OrderOut = ApiResponse<typeof api, "listOrders">["orders"][number];

export interface ShopProject {
  id: number | null;
  templateId: string;
  childName: string;
  message: string;
  nameFont: string;
  nameColor: string;
  nameAlign: "left" | "center" | "right";
  colors: Record<string, string>;
  strokes: Stroke[];
  customDef: string;
  status: "draft" | "done";
}

export interface ShopSelection {
  product: ProductId;
  tshirtColor: string;
  tshirtSize: string;
  childName: string;
}

export function formatIDR(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function fontFamilyOf(id: string): string {
  return (NAME_FONTS.find((f) => f.id === id) ?? NAME_FONTS[0]!).family;
}

export function templateForSnapshot(snap: { templateId: string; customDef?: string }): TemplateDef {
  if (snap.templateId === "custom") {
    const def = parseCustomDef(snap.customDef);
    if (def) return buildCustomTemplate(def);
  }
  return getTemplate(snap.templateId);
}

/* ------------------------- Product definitions ------------------------- */

export const PRODUCT_META: Record<
  ProductId,
  { title: string; tagline: string; description: string; cta: string; see: string }
> = {
  poster: {
    title: "Printed Poster",
    tagline: "Poster Berbingkai",
    description: "Turn their artwork into a beautiful keepsake for their room.",
    cta: "Create My Poster",
    see: "See My Poster",
  },
  figurine: {
    title: "Custom 3D Figurine",
    tagline: "Figurine 3D Custom",
    description: "Watch their imagination come to life in 3D.",
    cta: "Create My Figurine",
    see: "See My 3D Figurine",
  },
  tshirt: {
    title: "Custom Printed T-Shirt",
    tagline: "Kaos Custom",
    description: "Wear your imagination, made just for you.",
    cta: "Create My T-Shirt",
    see: "See My T-Shirt",
  },
};

const FALLBACK_CONFIG: ApiResponse<typeof api, "getShopConfig"> = {
  products: [
    { id: "poster", basePrice: 49000, priceLabel: "fixed" },
    { id: "figurine", basePrice: 120000, priceLabel: "from" },
    { id: "tshirt", basePrice: 79000, priceLabel: "from" },
  ],
  tshirtColors: ["Cream", "Mustard", "Terracotta", "Sage Green", "Brown"],
  tshirtSizes: ["2–3 tahun", "4–5 tahun", "6–7 tahun", "8–9 tahun", "10–12 tahun"],
  paymentGatewayConnected: false,
};

// Fabric swatch hexes for the five brand t-shirt colors named in the
// product configuration (visual representation of each named fabric).
export const TSHIRT_FABRIC_HEX: Record<string, string> = {
  Cream: "#F1E6CE",
  Mustard: "#DFA62E",
  Terracotta: "#C4673F",
  "Sage Green": "#93A97E",
  Brown: "#7A4E2D",
};

function useShopConfig() {
  const q = useQuery({ queryKey: ["shopConfig"], queryFn: () => api.getShopConfig({}) });
  return q.data ?? FALLBACK_CONFIG;
}

function priceLine(cfg: ApiResponse<typeof api, "getShopConfig">, id: ProductId): string {
  const p = cfg.products.find((x) => x.id === id) ?? FALLBACK_CONFIG.products.find((x) => x.id === id)!;
  return p.priceLabel === "from" ? `Mulai ${formatIDR(p.basePrice)}` : formatIDR(p.basePrice);
}

function basePrice(cfg: ApiResponse<typeof api, "getShopConfig">, id: ProductId): number {
  return (cfg.products.find((x) => x.id === id) ?? FALLBACK_CONFIG.products.find((x) => x.id === id)!).basePrice;
}

/* ------------------------------ Previews ------------------------------ */

export function PosterPreview({
  project,
  name,
  large = false,
}: {
  project: ShopProject;
  name: string;
  large?: boolean;
}) {
  const template = templateForSnapshot(project);
  return (
    <div
      className={`mx-auto w-full ${large ? "max-w-sm" : "max-w-[220px]"}`}
      role="img"
      aria-label="Pratinjau karya pada poster berbingkai"
    >
      <div className="rounded-md bg-[#8A6642] p-2 shadow-lg ring-1 ring-black/25">
        <div className="bg-[#FDFBF5] p-3">
          <ArtworkSvg
            template={template}
            colors={project.colors}
            strokes={project.strokes}
            name={name}
            nameFont={project.nameFont}
            nameColor={project.nameColor}
            nameAlign={project.nameAlign}
          />
        </div>
      </div>
      <p className="pt-2 text-center text-xs font-bold text-[var(--dim)]">Poster berbingkai — karya persis seperti yang diwarnai anak</p>
    </div>
  );
}

export function FigurinePreview({
  project,
  height = 280,
}: {
  project: ShopProject;
  height?: number;
}) {
  const template = templateForSnapshot(project);
  if (template.custom) {
    return (
      <div>
        <PillowViewer
          template={template}
          colors={project.colors}
          strokes={project.strokes}
          name={project.childName}
          nameFontFamily={fontFamilyOf(project.nameFont)}
          nameColor={project.nameColor}
          height={height}
          showControls={false}
        />
        <p className="pt-1 text-center text-xs font-bold text-[var(--dim)]">
          Ilustrasi konsep digital dari karya anak — bukan model siap cetak
        </p>
      </div>
    );
  }
  return (
    <div>
      <ModelViewer
        template={template}
        colors={project.colors}
        name={project.childName}
        nameFontFamily={fontFamilyOf(project.nameFont)}
        nameColor={project.nameColor}
        height={height}
        showControls={false}
        autoRotate={false}
        restYaw={Math.PI + 0.6}
      />
      <p className="pt-1 text-center text-xs font-bold text-[var(--dim)]">
        Ilustrasi konsep digital dari karya anak — bukan model siap cetak
      </p>
    </div>
  );
}

export function TshirtPreview({
  project,
  name,
  fabric,
  large = false,
}: {
  project: ShopProject;
  name: string;
  fabric: string;
  large?: boolean;
}) {
  const template = templateForSnapshot(project);
  const hex = TSHIRT_FABRIC_HEX[fabric] ?? "#F1E6CE";
  const dark = fabric === "Brown" || fabric === "Terracotta";
  return (
    <div
      className={`relative mx-auto w-full ${large ? "max-w-sm" : "max-w-[220px]"}`}
      role="img"
      aria-label={`Pratinjau karya pada kaos warna ${fabric}`}
    >
      <svg viewBox="0 0 240 240" className="h-auto w-full drop-shadow-md" aria-hidden>
        <path
          d="M95 26 C108 42 132 42 145 26 L188 44 L218 92 L180 110 L180 214 Q180 221 173 221 L67 221 Q60 221 60 214 L60 110 L22 92 L52 44 Z"
          fill={hex}
          stroke="#3B2A22"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M95 26 C108 42 132 42 145 26 C136 34 104 34 95 26 Z"
          fill={dark ? "#00000022" : "#3B2A2214"}
        />
      </svg>
      <div className="absolute left-1/2 top-[31%] w-[34%] -translate-x-1/2 rounded-lg bg-white/95 p-1 shadow-sm ring-1 ring-black/10">
        <ArtworkSvg
          template={template}
          colors={project.colors}
          strokes={project.strokes}
          name={name}
          nameFont={project.nameFont}
          nameColor={project.nameColor}
          nameAlign={project.nameAlign}
        />
      </div>
      <p className="pt-1 text-center text-xs font-bold text-[var(--dim)]">Kaos {fabric} — desain di bagian depan</p>
    </div>
  );
}

function ProductPreview({
  product,
  project,
  name,
  fabric,
  large = false,
}: {
  product: ProductId;
  project: ShopProject;
  name: string;
  fabric: string;
  large?: boolean;
}) {
  if (product === "poster") return <PosterPreview project={project} name={name} large={large} />;
  if (product === "figurine") return <FigurinePreview project={project} height={large ? 320 : 210} />;
  return <TshirtPreview project={project} name={name} fabric={fabric} large={large} />;
}

/* ---------------------------- Masterpiece ---------------------------- */

export function Masterpiece({
  project,
  onBack,
  onCustomize,
  onMagic,
}: {
  project: ShopProject;
  onBack: () => void;
  onCustomize: (p: ProductId) => void;
  onMagic: () => void;
}) {
  const cfg = useShopConfig();
  const template = templateForSnapshot(project);
  const [featured, setFeatured] = useState<ProductId | "artwork">("artwork");
  const displayName = project.childName.trim();
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <div className="band-sky mt-4 rounded-[2rem] px-6 py-8 text-center sm:px-10">
        <button
          type="button"
          onClick={onBack}
          className="float-left rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5"
        >
          ← Lanjut mewarnai
        </button>
        <div className="clear-both pt-2">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-[2.6rem]">
            Your Little Masterpiece <span className="band-accent">Is Ready!</span>
          </h1>
          <p className="band-dim mx-auto mt-2 max-w-lg font-semibold">
            Turn your little one&rsquo;s imagination into something real.
          </p>
        </div>
      </div>

      {/* Pratinjau besar: karya asli, atau mockup produk yang sedang dilihat */}
      <section className="mt-5 rounded-[2rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Pratinjau karya">
        <div className="mx-auto max-w-md">
          {featured === "artwork" ? (
            <div>
              <div className="rounded-3xl bg-white p-3 ring-1 ring-black/5">
                <ArtworkSvg
                  template={template}
                  colors={project.colors}
                  strokes={project.strokes}
                  name={project.childName}
                  nameFont={project.nameFont}
                  nameColor={project.nameColor}
                  nameAlign={project.nameAlign}
                />
              </div>
              <p className="pt-2 text-center font-display text-base font-semibold">
                {displayName ? `${template.name} milik ${displayName}` : template.name}
              </p>
              <p className="text-center text-sm font-semibold text-[var(--dim)]">
                Mewarnainya selalu gratis — karya ini sudah tersimpan di Kreasiku dan tidak hilang walau kamu kembali nanti.
              </p>
            </div>
          ) : (
            <ProductPreview
              product={featured}
              project={project}
              name={project.childName}
              fabric="Cream"
              large
            />
          )}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onMagic}
            className="rounded-full bg-[var(--surface-alt)] px-5 py-2.5 font-display text-sm font-bold ring-1 ring-[var(--border)]"
          >
            Putar dalam 3D
          </button>
          {featured !== "artwork" && (
            <button
              type="button"
              onClick={() => setFeatured("artwork")}
              className="rounded-full bg-[var(--surface-alt)] px-5 py-2.5 font-display text-sm font-bold ring-1 ring-[var(--border)]"
            >
              Lihat karya aslinya
            </button>
          )}
        </div>
      </section>

      {/* CTA konversi */}
      <section className="band-olive mt-6 rounded-[2rem] px-6 py-8 text-center" aria-label="Jadikan nyata">
        <h2 className="mx-auto max-w-xl font-display text-2xl font-semibold leading-snug sm:text-3xl">
          Don&rsquo;t Let Their Imagination Stay on Screen.
        </h2>
        <p className="band-dim mx-auto mt-2 max-w-md font-semibold">
          Make their little masterpiece a memory they can keep.
        </p>
      </section>

      {/* Tiga pilihan produk */}
      <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="Pilih bentuk kreasimu">
        {(Object.keys(PRODUCT_META) as ProductId[]).map((id) => {
          const meta = PRODUCT_META[id];
          return (
            <article
              key={id}
              className={`flex flex-col rounded-[1.75rem] bg-[var(--surface)] p-4 ring-1 transition ${
                featured === id ? "shadow-md ring-2 ring-olive" : "ring-[var(--border)]"
              }`}
            >
              <div className="rounded-3xl bg-sky-soft p-3">
                <ProductPreview product={id} project={project} name={project.childName} fabric="Cream" />
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold">{meta.title}</h3>
              <p className="mt-1 font-semibold leading-relaxed text-[var(--dim)]">{meta.description}</p>
              <p className="mt-2 font-display text-lg font-semibold text-olive-deep">{priceLine(cfg, id)}</p>
              {id === "figurine" && (
                <p className="mt-1 text-xs font-bold text-[var(--dim)]">
                  Setiap pesanan melewati Design Review oleh tim kami sebelum diproduksi.
                </p>
              )}
              <div className="mt-auto grid gap-2 pt-4">
                <button
                  type="button"
                  aria-pressed={featured === id}
                  onClick={() => {
                    setFeatured(id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="rounded-full bg-[var(--surface-alt)] px-5 py-2.5 font-display text-sm font-bold ring-1 ring-[var(--border)]"
                >
                  {meta.see}
                </button>
                <button
                  type="button"
                  onClick={() => onCustomize(id)}
                  className="rounded-full bg-tang px-5 py-3 font-display text-base font-semibold text-white shadow-sm transition hover:bg-tang-deep"
                >
                  {meta.cta}
                </button>
              </div>
            </article>
          );
        })}
      </section>
      <p className="mt-4 text-center text-sm font-semibold text-[var(--dim)]">
        Melihat pratinjau bukan pesanan dan bukan pembayaran — pesanan baru dibuat di langkah checkout, dan karya anakmu tetap tersimpan apa pun yang kamu pilih.
      </p>
    </div>
  );
}

/* ----------------------------- Customize ----------------------------- */

export function Customize({
  project,
  selection,
  setSelection,
  onBack,
  onCheckout,
}: {
  project: ShopProject;
  selection: ShopSelection;
  setSelection: (s: ShopSelection) => void;
  onBack: () => void;
  onCheckout: () => void;
}) {
  const cfg = useShopConfig();
  const meta = PRODUCT_META[selection.product];
  const [error, setError] = useState("");
  const price = basePrice(cfg, selection.product);
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="band-butter mt-4 flex flex-wrap items-center gap-2 rounded-[1.75rem] px-5 py-4">
        <button type="button" onClick={onBack} className="rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5">
          ← Semua pilihan
        </button>
        <h1 className="font-display text-2xl font-semibold">Atur {meta.tagline} Kamu</h1>
      </div>

      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <section className="rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Pratinjau produk">
          <ProductPreview
            product={selection.product}
            project={project}
            name={selection.childName}
            fabric={selection.tshirtColor}
            large
          />
          <p className="mt-2 text-center text-sm font-semibold text-[var(--dim)]">
            Pratinjau memakai warna persis dari karya anakmu — bukan contoh generik.
          </p>
        </section>

        <section className="rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Pengaturan produk">
          <h2 className="font-display text-xl font-semibold">{meta.title}</h2>
          <p className="mt-1 font-semibold text-[var(--dim)]">{meta.description}</p>

          <div className="mt-4">
            <label htmlFor="order-child-name" className="font-display text-sm font-bold">
              Nama anak untuk personalisasi{selection.product === "tshirt" ? " (opsional)" : ""}
            </label>
            <input
              id="order-child-name"
              {...FIELDS.createOrder.childName}
              value={selection.childName}
              onChange={(e) => setSelection({ ...selection, childName: e.target.value })}
              placeholder="cth. BABA"
              className="mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-display text-lg font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
            />
            <p className="mt-1 text-xs font-semibold text-[var(--dim)]">
              {selection.product === "poster"
                ? "Nama tampil di bawah karya pada poster, dengan gaya huruf & warna dari Studio Mewarnai."
                : selection.product === "figurine"
                  ? "Nama tercetak pada alas figurine, dengan gaya huruf & warna dari Studio Mewarnai."
                  : "Bila diisi, nama anak dicetak di bawah desain pada kaos."}
            </p>
          </div>

          {selection.product === "tshirt" && (
            <>
              <div className="mt-4">
                <p className="font-display text-sm font-bold" id="fabric-label">Warna kaos</p>
                <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="fabric-label">
                  {cfg.tshirtColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={selection.tshirtColor === c}
                      onClick={() => setSelection({ ...selection, tshirtColor: c })}
                      className={`flex items-center gap-2 rounded-full py-2 pl-2.5 pr-4 font-display text-sm font-bold ring-1 transition ${
                        selection.tshirtColor === c ? "bg-olive text-white ring-olive" : "bg-[var(--bg)] ring-[var(--border)]"
                      }`}
                    >
                      <span
                        className="h-6 w-6 rounded-full ring-1 ring-black/20"
                        style={{ background: TSHIRT_FABRIC_HEX[c] ?? "#EEE" }}
                        aria-hidden
                      />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <p className="font-display text-sm font-bold" id="size-label">Ukuran kaos anak</p>
                <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="size-label">
                  {cfg.tshirtSizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={selection.tshirtSize === s}
                      onClick={() => {
                        setSelection({ ...selection, tshirtSize: s });
                        setError("");
                      }}
                      className={`rounded-full px-4 py-2 font-display text-sm font-bold ring-1 transition ${
                        selection.tshirtSize === s ? "bg-olive text-white ring-olive" : "bg-[var(--bg)] ring-[var(--border)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs font-semibold text-[var(--dim)]">Semua ukuran harganya sama — tidak ada biaya tambahan per ukuran.</p>
              </div>
            </>
          )}

          {selection.product === "figurine" && (
            <div className="mt-4 rounded-2xl bg-butter-soft px-4 py-3 text-sm font-semibold leading-relaxed text-ink ring-1 ring-[var(--border)]">
              <p className="font-display font-bold">Jujur soal prosesnya:</p>
              <p className="mt-1">
                Pratinjau di samping adalah ilustrasi konsep digital. Gambar 2D tidak otomatis menjadi
                model siap cetak 3D — setiap pesanan figurine melewati tahap <strong>Design Review</strong>:
                tim kami memeriksa karya anakmu dan memetakannya ke geometri karakter yang terverifikasi
                sebelum produksi dimulai. Bila sebuah karya ternyata tidak bisa diwujudkan dengan baik,
                tim akan menghubungimu via WhatsApp sebelum pembayaran dilanjutkan.
              </p>
            </div>
          )}

          {selection.product === "poster" && (
            <p className="mt-4 rounded-2xl bg-sky-soft px-4 py-3 text-sm font-semibold leading-relaxed ring-1 ring-[var(--border)]">
              Poster dicetak dari file karya anakmu dan dipasang pada bingkai, siap digantung di kamarnya.
              Harga poster tetap — tidak berubah oleh pilihan apa pun di halaman ini.
            </p>
          )}

          <dl className="mt-5 space-y-1.5 border-t-2 border-dashed border-[var(--border)] pt-4 text-sm font-semibold">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Harga produk</dt>
              <dd className="font-display">{selection.product === "poster" ? formatIDR(price) : `${formatIDR(price)} (harga awal)`}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Ongkos kirim</dt>
              <dd className="text-right">Dihitung terpisah — dikonfirmasi tim via WhatsApp</dd>
            </div>
          </dl>
          {error && <p className="mt-3 text-sm font-bold text-berry" role="alert">{error}</p>}
          <button
            type="button"
            onClick={() => {
              if (selection.product === "tshirt" && !selection.tshirtSize) {
                setError("Pilih dulu ukuran kaosnya ya.");
                return;
              }
              onCheckout();
            }}
            className="mt-4 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-semibold text-white shadow transition hover:bg-tang-deep"
          >
            Lanjut ke Checkout
          </button>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ Checkout ------------------------------ */

export function Checkout({
  project,
  selection,
  onBack,
  onPlaced,
}: {
  project: ShopProject;
  selection: ShopSelection;
  onBack: () => void;
  onPlaced: (o: OrderOut) => void;
}) {
  const cfg = useShopConfig();
  const meta = PRODUCT_META[selection.product];
  const price = basePrice(cfg, selection.product);
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPct: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const validate = useMutation({
    mutationFn: async (code: string) => await api.validateCoupon({ code }),
    onError: (e) => {
      setAppliedCoupon(null);
      setCouponMsg(e.message);
    },
    onSuccess: (res) => {
      if (res.valid) {
        setAppliedCoupon({ code: res.code, discountPct: res.discountPct });
        setCouponMsg(res.message);
      } else {
        setAppliedCoupon(null);
        setCouponMsg(res.message);
      }
    },
  });
  // Referral arrival (?ref=KODE, captured by the app shell) pre-fills
  // and validates the coupon automatically.
  useEffect(() => {
    let ref = "";
    try {
      ref = localStorage.getItem("bfk-ref") ?? "";
    } catch {
      ref = "";
    }
    if (ref) {
      setCouponInput(ref);
      validate.mutate(ref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const discount = appliedCoupon ? Math.floor((price * appliedCoupon.discountPct) / 100) : 0;
  const create = useMutation({
    mutationFn: async () =>
      await api.createOrder({
        projectId: project.id ?? 0,
        productType: selection.product,
        tshirtColor: selection.product === "tshirt" ? selection.tshirtColor : "",
        tshirtSize: selection.product === "tshirt" ? selection.tshirtSize : "",
        childName: selection.childName.trim(),
        couponCode: appliedCoupon?.code ?? "",
        customerName: customerName.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        address: address.trim(),
        notes: notes.trim(),
      }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => onPlaced(res.order),
  });
  const submit = () => {
    setError("");
    if (project.id == null) {
      setError("Karya ini belum tersimpan. Kembali ke Studio Mewarnai sebentar supaya tersimpan, lalu coba lagi.");
      return;
    }
    if (customerName.trim().length < 2) return setError("Isi nama pemesan dulu ya.");
    if (whatsapp.replace(/\D/g, "").length < 9) return setError("Nomor WhatsApp perlu 9–15 digit angka.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Format email belum benar.");
    if (address.trim().length < 10) return setError("Isi alamat pengiriman lengkap (jalan, kota, kode pos) ya.");
    create.mutate();
  };
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="band-sky mt-4 flex flex-wrap items-center gap-2 rounded-[1.75rem] px-5 py-4">
        <button type="button" onClick={onBack} className="rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5">
          ← Kembali ke pengaturan
        </button>
        <h1 className="font-display text-2xl font-semibold">Checkout</h1>
      </div>

      <div className="mt-4 grid items-start gap-4 md:grid-cols-[1fr_360px]">
        <form
          className="rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]"
          aria-label="Data pemesan"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2 className="font-display text-lg font-semibold">Data pemesan & pengiriman</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="co-name" className="font-display text-sm font-bold">Nama pemesan</label>
              <input
                id="co-name"
                {...FIELDS.createOrder.customerName}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoComplete="name"
                className="mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
              />
            </div>
            <div>
              <label htmlFor="co-wa" className="font-display text-sm font-bold">Nomor WhatsApp</label>
              <input
                id="co-wa"
                {...FIELDS.createOrder.whatsapp}
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                autoComplete="tel"
                placeholder="cth. 0812 3456 7890"
                className="mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
              />
              <p className="mt-1 text-xs font-semibold text-[var(--dim)]">Tim kami menghubungimu di nomor ini untuk pembayaran, konfirmasi ongkir, dan info pengiriman.</p>
            </div>
            <div>
              <label htmlFor="co-email" className="font-display text-sm font-bold">Email</label>
              <input
                id="co-email"
                {...FIELDS.createOrder.email}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
              />
            </div>
            <div>
              <label htmlFor="co-address" className="font-display text-sm font-bold">Alamat pengiriman lengkap</label>
              <textarea
                id="co-address"
                {...FIELDS.createOrder.address}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                autoComplete="street-address"
                placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota, kode pos"
                className="mt-1 w-full resize-none rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
              />
            </div>
            <div>
              <label htmlFor="co-notes" className="font-display text-sm font-bold">Catatan untuk tim kami (opsional)</label>
              <input
                id="co-notes"
                {...FIELDS.createOrder.notes}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
              />
            </div>
            <div>
              <label htmlFor="co-coupon" className="font-display text-sm font-bold">Kode kupon afiliasi (opsional)</label>
              <div className="mt-1 flex gap-2">
                <input
                  id="co-coupon"
                  {...FIELDS.validateCoupon.code}
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setAppliedCoupon(null);
                    setCouponMsg("");
                  }}
                  placeholder="cth. MAYA10"
                  className="min-w-0 flex-1 rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-display font-bold uppercase ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
                />
                <button
                  type="button"
                  disabled={validate.isPending || couponInput.trim().length < 3}
                  onClick={() => validate.mutate(couponInput.trim())}
                  className="rounded-full bg-olive px-5 py-2.5 font-display text-sm font-semibold text-white disabled:opacity-50"
                >
                  {validate.isPending ? "Memeriksa…" : "Pakai"}
                </button>
              </div>
              {couponMsg && (
                <p className={`mt-1 text-xs font-bold ${appliedCoupon ? "text-olive-deep" : "text-berry"}`} role="status">
                  {couponMsg}
                </p>
              )}
              <p className="mt-1 text-xs font-semibold text-[var(--dim)]">Satu kupon per pesanan. Diskon dihitung dari harga produk (tidak termasuk ongkir & kode unik) dan divalidasi ulang oleh server saat pesanan dibuat.</p>
            </div>
          </div>
          {error && <p className="mt-3 text-sm font-bold text-berry" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={create.isPending}
            className="mt-4 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-semibold text-white shadow transition hover:bg-tang-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending ? "Membuat pesanan…" : "Buat Pesanan"}
          </button>
        </form>

        <aside className="space-y-4">
          <section className="rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Ringkasan pesanan">
            <h2 className="font-display text-lg font-semibold">Ringkasan pesanan</h2>
            <div className="mx-auto mt-3 max-w-[180px]">
              <ProductPreview product={selection.product} project={project} name={selection.childName} fabric={selection.tshirtColor} />
            </div>
            <dl className="mt-3 space-y-1.5 text-sm font-semibold">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--dim)]">Produk</dt>
                <dd className="text-right font-display">{meta.title}</dd>
              </div>
              {selection.product === "tshirt" && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--dim)]">Varian</dt>
                  <dd className="text-right">Kaos {selection.tshirtColor} · {selection.tshirtSize}</dd>
                </div>
              )}
              {selection.childName.trim() && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--dim)]">Nama anak</dt>
                  <dd className="text-right">{selection.childName.trim()}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2">
                <dt className="text-[var(--dim)]">Harga produk</dt>
                <dd className="font-display">{formatIDR(price)}</dd>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--dim)]">Diskon kupon {appliedCoupon.code} ({appliedCoupon.discountPct}%)</dt>
                  <dd className="font-display text-olive-deep">−{formatIDR(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--dim)]">Ongkos kirim</dt>
                <dd className="text-right">Dikonfirmasi via WhatsApp</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2 text-base">
                <dt>Total produk</dt>
                <dd className="font-display text-olive-deep">{formatIDR(price - discount)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs font-semibold text-[var(--dim)]">
              Harga produk dan ongkos kirim selalu ditampilkan terpisah. Di halaman pembayaran, total yang
              ditransfer = total produk + ongkir terkonfirmasi + kode unik pembayaran (Rp1–999) yang dibuat
              server untuk pesananmu.
            </p>
          </section>

          <section className="rounded-[1.75rem] bg-butter-soft p-5 ring-1 ring-[var(--border)]" aria-label="Cara pembayaran">
            <h2 className="font-display text-base font-semibold text-ink">Cara pembayaran: QRIS</h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">
              Setelah pesanan dibuat, kamu membayar lewat QRIS statis resmi {QRIS_MERCHANT} dengan nominal
              persis (termasuk kode unik pesananmu), lalu menekan tombol “Saya Sudah Transfer”. Konfirmasi
              itu TIDAK otomatis melunasi pesanan — tim kami memverifikasi transfer masuk secara manual,
              dan produksi hanya dimulai setelah pembayaran terverifikasi.
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink">
              Batal atau berubah pikiran? Karyamu tetap tersimpan utuh di Kreasiku — tidak ada yang hilang.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------- Confirmation ---------------------------- */

export const ORDER_STATUS_LABELS: Record<OrderOut["orderStatus"], string> = {
  pending_payment: "Menunggu Pembayaran",
  paid: "Pembayaran Lunas",
  confirmed: "Terkonfirmasi",
  design_review: "Design Review",
  production: "Sedang Diproduksi",
  ready_to_ship: "Siap Dikirim",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const PAYMENT_STATUS_LABELS: Record<OrderOut["paymentStatus"], string> = {
  pending: "Menunggu Pembayaran",
  waiting_verification: "Menunggu Verifikasi",
  paid: "Lunas",
  rejected: "Ditolak",
  failed: "Gagal",
  cancelled: "Dibatalkan",
  refunded: "Direfund",
};

export const PAY_STATE_LABELS: Record<OrderOut["payState"], string> = {
  awaiting: "Menunggu Pembayaran",
  waiting_verification: "Menunggu Verifikasi",
  verified: "Pembayaran Terverifikasi",
  rejected: "Pembayaran Ditolak",
  unmatched: "Belum Cocok (Unmatched)",
  refunded: "Direfund",
};

export const QRIS_MERCHANT = "BUN AND FLEUR";
export const QRIS_NMID = "ID1026626210169";

/* --------------------- QRIS payment panel (Part 4) --------------------- */
// Static merchant QRIS + the order's exact payable amount (product net
// + shipping + the server-generated unique code). "Saya Sudah
// Transfer" only records the customer's confirmation — the order moves
// to Waiting for Verification and stays unpaid until an admin verifies
// the real incoming transfer.
export function PaymentPanel({ order }: { order: OrderOut }) {
  const [payState, setPayState] = useState<OrderOut["payState"]>(order.payState);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setPayState(order.payState), [order.payState]);
  const confirm = useMutation({
    mutationFn: async () => await api.confirmTransfer({ code: order.code, whatsapp: order.whatsapp }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      if (res.ok) setPayState(res.payState === "not_found" ? payState : res.payState);
      else setError("Konfirmasi tidak bisa dicatat. Periksa lagi sebentar, atau hubungi tim kami via WhatsApp.");
    },
  });
  const payable = order.total + order.uniqueCode;
  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(payable));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Tidak bisa menyalin otomatis — catat nominalnya persis ya: " + payable.toLocaleString("id-ID"));
    }
  };
  return (
    <section className="rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Pembayaran QRIS">
      <h2 className="font-display text-lg font-semibold">Bayar dengan QRIS</h2>
      <p className="mt-1 text-sm font-semibold text-[var(--dim)]">
        Status pembayaran: <span className="font-display text-ink">{PAY_STATE_LABELS[payState]}</span>
      </p>
      <div className="mt-4 grid items-start gap-5 sm:grid-cols-[240px_1fr]">
        <div className="mx-auto w-full max-w-[240px]">
          <img
            src={qrisUrl}
            alt={`QRIS resmi merchant ${QRIS_MERCHANT}`}
            className="w-full rounded-3xl ring-1 ring-[var(--border)]"
          />
          <p className="mt-2 text-center font-display text-sm font-bold">{QRIS_MERCHANT}</p>
          <p className="text-center text-xs font-semibold text-[var(--dim)]">NMID: {QRIS_NMID}</p>
          <a
            href={qrisUrl}
            download="QRIS-Bun-Fleur-Kids.png"
            className="mt-3 block rounded-full bg-[var(--surface-alt)] px-5 py-2.5 text-center font-display text-sm font-bold ring-1 ring-[var(--border)]"
          >
            Simpan QRIS
          </a>
        </div>
        <div>
          <dl className="space-y-1.5 text-sm font-semibold">
            <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Kode pesanan</dt><dd className="font-display">{order.code}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Produk</dt><dd className="text-right font-display">{PRODUCT_META[order.productType].title}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Subtotal produk</dt><dd className="font-display">{formatIDR(order.productPrice)}</dd></div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--dim)]">Diskon kupon {order.couponCode}</dt>
                <dd className="font-display text-olive-deep">−{formatIDR(order.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Ongkos kirim</dt>
              <dd className="text-right">{order.shippingCost == null ? "Dikonfirmasi tim via WhatsApp" : formatIDR(order.shippingCost)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Kode unik pembayaran</dt>
              <dd className="font-display">{formatIDR(order.uniqueCode)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2 text-base">
              <dt>Total yang dibayar</dt>
              <dd className="font-display text-xl text-olive-deep">{formatIDR(payable)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-[var(--dim)]">
            Transfer PERSIS sebesar total di atas ke QRIS {QRIS_MERCHANT} — kode unik di tiga digit terakhir
            membantu tim kami mencocokkan pembayaranmu. Masukkan nominalnya secara manual di aplikasi
            bank / e-wallet kamu. Kode unik ini tidak berubah walau halaman dimuat ulang.
            {order.shippingCost == null && " Ongkir belum termasuk — tim kami mengonfirmasinya via WhatsApp; bila ongkir ditambahkan sebelum kamu membayar, total di halaman Lacak Pesanan ikut terbarui dengan kode unik yang sama."}
          </p>
          {payState === "verified" ? (
            <p className="mt-4 rounded-2xl bg-sage-soft px-4 py-3 font-display text-sm font-bold text-olive-deep ring-1 ring-[var(--border)]">
              Pembayaranmu sudah terverifikasi oleh tim kami. Pesanan lanjut ke tahap berikutnya.
            </p>
          ) : payState === "rejected" ? (
            <p className="mt-4 rounded-2xl bg-[#FDECEA] px-4 py-3 font-display text-sm font-bold text-berry ring-1 ring-[var(--border)]">
              Pembayaran belum bisa diverifikasi. Hubungi tim kami via WhatsApp untuk mencocokkannya — jangan transfer ulang dulu.
            </p>
          ) : payState === "refunded" ? (
            <p className="mt-4 rounded-2xl bg-[var(--surface-alt)] px-4 py-3 font-display text-sm font-bold ring-1 ring-[var(--border)]">
              Pesanan ini sudah direfund.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyAmount()}
                  className="rounded-full bg-sky-deep px-5 py-2.5 font-display text-sm font-semibold text-white"
                >
                  {copied ? "Nominal tersalin ✓" : "Salin Nominal Pembayaran"}
                </button>
                <button
                  type="button"
                  disabled={confirm.isPending || payState === "waiting_verification"}
                  onClick={() => confirm.mutate()}
                  className="rounded-full bg-tang px-5 py-2.5 font-display text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {payState === "waiting_verification" ? "Menunggu Verifikasi Tim" : confirm.isPending ? "Mencatat…" : "Saya Sudah Transfer"}
                </button>
              </div>
              {payState === "waiting_verification" && (
                <p className="mt-2 text-sm font-semibold text-[var(--dim)]" role="status">
                  Konfirmasimu tercatat{order.paymentConfirmedAt ? ` pada ${new Date(order.paymentConfirmedAt).toLocaleString("id-ID")}` : ""}. Tim kami memeriksa transfer masuk yang cocok dengan nominal unikmu — status berubah menjadi Terverifikasi setelah cocok, bukan otomatis.
                </p>
              )}
              {payState === "unmatched" && (
                <p className="mt-2 text-sm font-semibold text-[var(--dim)]" role="status">
                  Tim kami belum menemukan transfer yang cocok dengan nominal unik ini. Pastikan nominal transfermu persis sama, lalu hubungi kami via WhatsApp bila sudah transfer.
                </p>
              )}
            </>
          )}
          {error && <p className="mt-2 text-sm font-bold text-berry" role="alert">{error}</p>}
        </div>
      </div>
    </section>
  );
}

export function OrderConfirmation({
  order,
  onCreations,
  onHome,
}: {
  order: OrderOut;
  onCreations: () => void;
  onHome: () => void;
}) {
  const meta = PRODUCT_META[order.productType];
  const snap: ShopProject = useMemo(
    () => ({
      id: order.projectId,
      templateId: order.templateId,
      childName: order.childName,
      message: order.message,
      nameFont: order.nameFont,
      nameColor: order.nameColor,
      nameAlign: order.nameAlign,
      colors: order.colors,
      strokes: order.strokes,
      customDef: order.customDef,
      status: "done",
    }),
    [order],
  );
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <section className="band-sage mt-4 rounded-[2rem] px-6 py-8 text-center" aria-label="Konfirmasi pesanan">
        <p className="font-display text-3xl font-semibold">Pesanan Diterima!</p>
        <p className="band-dim mx-auto mt-2 max-w-md font-semibold">
          Terima kasih — {meta.tagline.toLowerCase()} dari karya si kecil sudah tercatat di tim kami.
        </p>
        <p className="mt-4 inline-block rounded-2xl bg-white px-5 py-3 ring-1 ring-[var(--border)]">
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--dim)]">Kode pesanan</span>
          <span className="font-display text-2xl font-semibold tracking-wide text-olive-deep">{order.code}</span>
        </p>
        <p className="mt-3">
          <span className="rounded-full bg-butter px-3.5 py-1.5 font-display text-sm font-semibold text-ink">
            Status: {ORDER_STATUS_LABELS[order.orderStatus]}
          </span>
        </p>
      </section>

      <section className="mt-4 rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Detail pesanan">
        <div className="mx-auto max-w-[200px]">
          <ProductPreview
            product={order.productType}
            project={snap}
            name={order.childName}
            fabric={order.variant.startsWith("Kaos ") ? order.variant.slice(5).split(" · ")[0]! : "Cream"}
          />
        </div>
        <dl className="mx-auto mt-4 max-w-md space-y-1.5 text-sm font-semibold">
          <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Produk</dt><dd className="text-right font-display">{meta.title}</dd></div>
          {order.variant && <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Varian</dt><dd className="text-right">{order.variant}</dd></div>}
          {order.childName.trim() && <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Nama anak</dt><dd className="text-right">{order.childName.trim()}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Pemesan</dt><dd className="text-right">{order.customerName}</dd></div>
          <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2"><dt className="text-[var(--dim)]">Harga produk</dt><dd className="font-display">{formatIDR(order.productPrice)}</dd></div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Diskon kupon {order.couponCode}</dt><dd className="font-display text-olive-deep">−{formatIDR(order.discountAmount)}</dd></div>
          )}
          <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Ongkos kirim</dt><dd className="text-right">{order.shippingCost == null ? "Dikonfirmasi via WhatsApp" : formatIDR(order.shippingCost)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Total produk</dt><dd className="font-display text-olive-deep">{formatIDR(order.total)}</dd></div>
        </dl>
      </section>

      <div className="mt-4">
        <PaymentPanel order={order} />
      </div>

      <section className="mt-4 rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Langkah berikutnya">
        <h2 className="font-display text-lg font-semibold">Langkah berikutnya</h2>
        <ol className="mt-2 list-none space-y-2.5 font-semibold text-[var(--dim)]">
          <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-butter font-display text-sm font-bold text-ink">1</span><span className="pt-0.5">Scan QRIS {QRIS_MERCHANT} di atas dan transfer PERSIS sebesar total yang tertera (termasuk kode uniknya), lalu tekan “Saya Sudah Transfer”.</span></li>
          <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-butter font-display text-sm font-bold text-ink">2</span><span className="pt-0.5">Tim kami memverifikasi transfer masuk secara manual. Setelah cocok, status menjadi Terverifikasi / Lunas{order.productType === "figurine" ? " lalu masuk Design Review" : ""} dan produksi dimulai — pesanan tidak pernah diproduksi sebelum pembayaran terverifikasi.</span></li>
          <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-butter font-display text-sm font-bold text-ink">3</span><span className="pt-0.5">Cek status kapan saja di halaman Orang Tua → Lacak Pesanan, memakai kode pesanan + nomor WhatsApp-mu.</span></li>
        </ol>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onCreations} className="rounded-full bg-olive px-6 py-3 font-display text-base font-semibold text-white transition hover:bg-olive-deep">
            Lihat Kreasiku
          </button>
          <button type="button" onClick={onHome} className="rounded-full bg-[var(--surface-alt)] px-6 py-3 font-display text-base font-semibold ring-1 ring-[var(--border)]">
            Kembali ke Beranda
          </button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------- Tracking + download ------------------------- */

function downloadArtworkPng(svg: SVGSVGElement | null, filename: string) {
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const W = 2000;
    const H = Math.round((W * img.height) / Math.max(1, img.width)) || 1500;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(url);
    canvas.toBlob((b) => {
      if (b) downloadBlob(b, filename);
    }, "image/png");
  };
  img.src = url;
}

const TRACK_STEPS: { id: OrderOut["orderStatus"]; label: string }[] = [
  { id: "pending_payment", label: "Menunggu Pembayaran" },
  { id: "paid", label: "Lunas" },
  { id: "confirmed", label: "Terkonfirmasi" },
  { id: "design_review", label: "Design Review" },
  { id: "production", label: "Produksi" },
  { id: "ready_to_ship", label: "Siap Dikirim" },
  { id: "shipped", label: "Dikirim" },
  { id: "completed", label: "Selesai" },
];

export function OrderTracking() {
  const [code, setCode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [searched, setSearched] = useState(false);
  const exportRef = useRef<SVGSVGElement | null>(null);
  const track = useMutation({
    mutationFn: async () => await api.trackOrder({ code: code.trim(), whatsapp: whatsapp.trim() }),
    onSuccess: () => setSearched(true),
  });
  const order = track.data?.order ?? null;
  const stepIndex = order ? TRACK_STEPS.findIndex((s) => s.id === order.orderStatus) : -1;
  const snap: ShopProject | null = order
    ? {
        id: order.projectId,
        templateId: order.templateId,
        childName: order.childName,
        message: order.message,
        nameFont: order.nameFont,
        nameColor: order.nameColor,
        nameAlign: order.nameAlign,
        colors: order.colors,
        strokes: order.strokes,
        customDef: order.customDef,
        status: "done",
      }
    : null;
  return (
    <div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearched(false);
          track.mutate();
        }}
      >
        <div className="min-w-40 flex-1">
          <label htmlFor="track-code" className="sr-only">Kode pesanan</label>
          <input
            id="track-code"
            {...FIELDS.trackOrder.code}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Kode pesanan, cth. BFK-XXXXXX"
            className="w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-display font-bold uppercase ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
          />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="track-wa" className="sr-only">Nomor WhatsApp pemesan</label>
          <input
            id="track-wa"
            {...FIELDS.trackOrder.whatsapp}
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Nomor WhatsApp pemesan"
            className="w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-display font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
          />
        </div>
        <button
          type="submit"
          disabled={track.isPending || code.trim().length < 4 || whatsapp.trim().length < 9}
          className="rounded-full bg-sky-deep px-5 py-2.5 font-display font-semibold text-white disabled:opacity-50"
        >
          {track.isPending ? "Mencari…" : "Lacak"}
        </button>
      </form>
      {track.error && <p className="mt-2 text-sm font-bold text-berry" role="alert">{track.error.message}</p>}
      {searched && !track.isPending && !order && (
        <p className="mt-3 rounded-2xl bg-[var(--surface-alt)] px-4 py-3 font-semibold text-[var(--dim)]" role="status">
          Pesanan tidak ditemukan. Periksa lagi kode pesanan dan nomor WhatsApp yang dipakai saat memesan — keduanya harus cocok.
        </p>
      )}
      {order && snap && (
        <div className="mt-4 rounded-3xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-28 shrink-0 rounded-3xl bg-white p-1.5 ring-1 ring-black/5">
              <ArtworkSvg
                template={templateForSnapshot(snap)}
                colors={snap.colors}
                strokes={snap.strokes}
                name={snap.childName}
                nameFont={snap.nameFont}
                nameColor={snap.nameColor}
                nameAlign={snap.nameAlign}
              />
            </div>
            <div className="min-w-52 flex-1">
              <p className="font-display text-lg font-semibold">
                {order.code} · {PRODUCT_META[order.productType].title}
              </p>
              <p className="text-sm font-semibold text-[var(--dim)]">
                {order.variant} · Total {formatIDR(order.total)} · Pembayaran: {PAY_STATE_LABELS[order.payState]}
              </p>
              {order.orderStatus === "cancelled" ? (
                <p className="mt-2 font-display font-semibold text-berry">Pesanan ini dibatalkan. Karyamu tetap tersimpan di Kreasiku bila ingin memesan lagi.</p>
              ) : (
                <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Tahap pesanan">
                  {TRACK_STEPS.map((s, i) => (
                    <li
                      key={s.id}
                      className={`rounded-full px-3 py-1.5 font-display text-xs font-bold ${
                        i < stepIndex
                          ? "bg-olive text-white"
                          : i === stepIndex
                            ? "bg-tang text-white"
                            : "bg-[var(--surface)] text-[var(--dim)] ring-1 ring-[var(--border)]"
                      }`}
                    >
                      {s.label}
                    </li>
                  ))}
                </ol>
              )}
              {order.trackingNumber && (
                <p className="mt-2 text-sm font-semibold">Nomor resi: <span className="font-display">{order.trackingNumber}</span></p>
              )}
              {order.paymentStatus !== "paid" && order.orderStatus !== "cancelled" && (
                <p className="mt-2 text-sm font-semibold text-[var(--dim)]">
                  Menunggu pembayaran terverifikasi oleh tim kami. Bayar lewat panel QRIS di bawah dengan nominal persis termasuk kode uniknya, lalu tekan “Saya Sudah Transfer”.
                </p>
              )}
            </div>
          </div>

          {order.orderStatus !== "cancelled" && order.payState !== "refunded" && (
            <div className="mt-4">
              <PaymentPanel order={order} />
            </div>
          )}

          {/* File produksi poster: hanya terbuka setelah pembayaran
              terverifikasi di server (paymentStatus === "paid"). */}
          {order.productType === "poster" && order.paymentStatus === "paid" && (
            <div className="mt-4 border-t border-dashed border-[var(--border)] pt-3">
              <div className="sr-only" aria-hidden>
                <ArtworkSvg
                  svgRef={exportRef}
                  template={templateForSnapshot(snap)}
                  colors={snap.colors}
                  strokes={snap.strokes}
                  name={snap.childName}
                  nameFont={snap.nameFont}
                  nameColor={snap.nameColor}
                  nameAlign={snap.nameAlign}
                />
              </div>
              <button
                type="button"
                onClick={() => downloadArtworkPng(exportRef.current, `poster-${order.code}.png`)}
                className="rounded-full bg-olive px-6 py-3 font-display text-base font-semibold text-white transition hover:bg-olive-deep"
              >
                Unduh File Poster Resolusi Produksi (PNG)
              </button>
              <p className="mt-1.5 text-xs font-semibold text-[var(--dim)]">
                Pembayaranmu sudah terverifikasi, jadi file final postermu terbuka. Poster fisik berbingkainya tetap diproduksi &amp; dikirim oleh tim kami.
              </p>
            </div>
          )}
          {order.productType === "poster" && order.paymentStatus !== "paid" && order.orderStatus !== "cancelled" && (
            <p className="mt-4 border-t border-dashed border-[var(--border)] pt-3 text-sm font-semibold text-[var(--dim)]">
              File poster resolusi produksi terkunci sampai pembayaran terverifikasi oleh tim kami.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Admin orders ----------------------------- */

function AdminOrderCard({ order }: { order: OrderOut }) {
  const queryClient = useQueryClient();
  const [paymentStatus, setPaymentStatus] = useState<OrderOut["paymentStatus"]>(order.paymentStatus);
  const [orderStatus, setOrderStatus] = useState<OrderOut["orderStatus"]>(order.orderStatus);
  const [resi, setResi] = useState(order.trackingNumber);
  const [ongkir, setOngkir] = useState(order.shippingCost == null ? "" : String(order.shippingCost));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: async () =>
      await api.updateOrder({
        id: order.id,
        paymentStatus,
        orderStatus,
        trackingNumber: resi.trim(),
        ...(ongkir.trim() === "" ? {} : { shippingCost: Number(ongkir) }),
      }),
    onError: (e) => {
      setError(e.message);
      setSaved(false);
    },
    onSuccess: () => {
      setError("");
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  const verify = useMutation({
    mutationFn: async (decision: "verify" | "reject" | "unmatched" | "refund") =>
      await api.verifyOrderPayment({ id: order.id, decision }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      setError("");
      setPaymentStatus(res.order.paymentStatus);
      setOrderStatus(res.order.orderStatus);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  const snap: ShopProject = {
    id: order.projectId,
    templateId: order.templateId,
    childName: order.childName,
    message: order.message,
    nameFont: order.nameFont,
    nameColor: order.nameColor,
    nameAlign: order.nameAlign,
    colors: order.colors,
    strokes: order.strokes,
    customDef: order.customDef,
    status: "done",
  };
  const selectCls =
    "rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky";
  return (
    <article className="rounded-3xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-24 shrink-0 rounded-3xl bg-white p-1.5 ring-1 ring-black/5">
          <ArtworkSvg
            template={templateForSnapshot(snap)}
            colors={snap.colors}
            strokes={snap.strokes}
            name={snap.childName}
            nameFont={snap.nameFont}
            nameColor={snap.nameColor}
            nameAlign={snap.nameAlign}
          />
        </div>
        <div className="min-w-56 flex-1">
          <p className="font-display text-base font-semibold">
            {order.code} · {PRODUCT_META[order.productType].title}
          </p>
          <p className="text-sm font-semibold text-[var(--dim)]">
            {order.variant || "—"} · {new Date(order.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm font-semibold sm:grid-cols-2">
            <div><dt className="inline text-[var(--dim)]">Pemesan: </dt><dd className="inline">{order.customerName}</dd></div>
            <div><dt className="inline text-[var(--dim)]">WhatsApp: </dt><dd className="inline">{order.whatsapp}</dd></div>
            <div><dt className="inline text-[var(--dim)]">Email: </dt><dd className="inline">{order.email}</dd></div>
            <div><dt className="inline text-[var(--dim)]">Nama anak: </dt><dd className="inline">{order.childName.trim() || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-[var(--dim)]">Alamat: </dt><dd className="inline">{order.address}</dd></div>
            {order.notes && <div className="sm:col-span-2"><dt className="inline text-[var(--dim)]">Catatan: </dt><dd className="inline">{order.notes}</dd></div>}
            <div><dt className="inline text-[var(--dim)]">Harga produk: </dt><dd className="inline">{formatIDR(order.productPrice)}</dd></div>
            {order.discountAmount > 0 && (
              <div><dt className="inline text-[var(--dim)]">Diskon kupon {order.couponCode}: </dt><dd className="inline">−{formatIDR(order.discountAmount)}</dd></div>
            )}
            <div><dt className="inline text-[var(--dim)]">Ongkir: </dt><dd className="inline">{order.shippingCost == null ? "belum dikonfirmasi" : formatIDR(order.shippingCost)}</dd></div>
            <div><dt className="inline text-[var(--dim)]">Total: </dt><dd className="inline font-display text-olive-deep">{formatIDR(order.total)}</dd></div>
            <div className="sm:col-span-2">
              <dt className="inline text-[var(--dim)]">QRIS: </dt>
              <dd className="inline">
                kode unik {formatIDR(order.uniqueCode)} · total bayar <span className="font-display text-olive-deep">{formatIDR(order.payableTotal)}</span> ·{" "}
                <span className="font-display">{PAY_STATE_LABELS[order.payState]}</span>
                {order.paymentConfirmedAt && ` · konfirmasi pelanggan ${new Date(order.paymentConfirmedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Verifikasi pembayaran QRIS">
            <span className="font-display text-xs font-bold text-[var(--dim)]">Verifikasi QRIS:</span>
            {(order.payState === "awaiting" || order.payState === "waiting_verification" || order.payState === "unmatched") && (
              <>
                <button type="button" disabled={verify.isPending} onClick={() => verify.mutate("verify")} className="rounded-full bg-olive px-4 py-2 font-display text-xs font-semibold text-white disabled:opacity-50">
                  Verifikasi Pembayaran
                </button>
                <button type="button" disabled={verify.isPending} onClick={() => verify.mutate("reject")} className="rounded-full bg-berry px-4 py-2 font-display text-xs font-semibold text-white disabled:opacity-50">
                  Tolak Pembayaran
                </button>
                <button type="button" disabled={verify.isPending} onClick={() => verify.mutate("unmatched")} className="rounded-full bg-[var(--surface)] px-4 py-2 font-display text-xs font-bold ring-1 ring-[var(--border)] disabled:opacity-50">
                  Tandai Belum Cocok
                </button>
              </>
            )}
            {order.payState === "verified" && (
              <button type="button" disabled={verify.isPending} onClick={() => verify.mutate("refund")} className="rounded-full bg-[var(--surface)] px-4 py-2 font-display text-xs font-bold ring-1 ring-[var(--border)] disabled:opacity-50">
                Refund Pesanan Ini
              </button>
            )}
            <span className="text-xs font-semibold text-[var(--dim)]">
              Cocokkan nominal {formatIDR(order.payableTotal)} dengan mutasi QRIS {QRIS_MERCHANT} (NMID {QRIS_NMID}) sebelum memverifikasi — konfirmasi pelanggan bukan bukti pembayaran.
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-dashed border-[var(--border)] pt-3">
        <div>
          <label htmlFor={`pay-${order.id}`} className="block font-display text-xs font-bold text-[var(--dim)]">Pembayaran</label>
          <select id={`pay-${order.id}`} value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value as OrderOut["paymentStatus"]); setSaved(false); }} className={selectCls}>
            <option value="pending">Menunggu Pembayaran</option>
            <option value="waiting_verification">Menunggu Verifikasi</option>
            <option value="paid">Lunas (terverifikasi)</option>
            <option value="rejected">Ditolak</option>
            <option value="failed">Gagal</option>
            <option value="cancelled">Dibatalkan</option>
            <option value="refunded">Direfund</option>
          </select>
        </div>
        <div>
          <label htmlFor={`status-${order.id}`} className="block font-display text-xs font-bold text-[var(--dim)]">Status pesanan</label>
          <select id={`status-${order.id}`} value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value as OrderOut["orderStatus"]); setSaved(false); }} className={selectCls}>
            <option value="pending_payment">Menunggu Pembayaran</option>
            <option value="paid">Lunas</option>
            <option value="confirmed">Terkonfirmasi</option>
            <option value="design_review">Design Review</option>
            <option value="production">Produksi</option>
            <option value="ready_to_ship">Siap Dikirim</option>
            <option value="shipped">Dikirim</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
        <div>
          <label htmlFor={`resi-${order.id}`} className="block font-display text-xs font-bold text-[var(--dim)]">Nomor resi</label>
          <input
            id={`resi-${order.id}`}
            {...FIELDS.updateOrder.trackingNumber}
            value={resi}
            onChange={(e) => { setResi(e.target.value); setSaved(false); }}
            placeholder="Resi pengiriman"
            className="rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
          />
        </div>
        <div>
          <label htmlFor={`ongkir-${order.id}`} className="block font-display text-xs font-bold text-[var(--dim)]">Ongkir terkonfirmasi (Rp)</label>
          <input
            id={`ongkir-${order.id}`}
            {...FIELDS.updateOrder.shippingCost}
            type="number"
            value={ongkir}
            onChange={(e) => { setOngkir(e.target.value); setSaved(false); }}
            placeholder="cth. 15000"
            className="w-36 rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
          />
        </div>
        <button
          type="button"
          disabled={update.isPending}
          onClick={() => update.mutate()}
          className="rounded-full bg-olive px-5 py-2.5 font-display text-sm font-semibold text-white disabled:opacity-50"
        >
          {update.isPending ? "Menyimpan…" : "Simpan perubahan"}
        </button>
        {saved && <span className="pb-2 font-display text-sm font-bold text-[#2E7D46]">Tersimpan ✓</span>}
      </div>
      {error && <p className="mt-2 text-sm font-bold text-berry" role="alert">{error}</p>}
    </article>
  );
}

export function AdminOrders() {
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.listOrders({ limit: 50 }),
  });
  if (orders.isPending) return <p className="font-display font-bold">Memuat pesanan…</p>;
  if (orders.error) return <p className="font-display font-bold">Pesanan tidak bisa dimuat. Coba lagi sebentar.</p>;
  const list = orders.data.orders;
  if (list.length === 0) {
    return (
      <p className="font-semibold text-[var(--dim)]">
        Belum ada pesanan masuk. Pesanan dari tombol “Jadikan Nyata” akan tampil di sini lengkap dengan karyanya.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {list.map((o) => (
        <AdminOrderCard key={o.id} order={o} />
      ))}
    </div>
  );
}
