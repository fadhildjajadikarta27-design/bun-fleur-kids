import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "./components/SafeAreaTopScrim";
import { AdminGate } from "./components/AdminGate";
import { api, type ApiResponse } from "./api";
import { FIELDS } from "./fields";
import { NAME_COLORS, NAME_FONTS } from "./lib/model";
import { buildPillowNet } from "./lib/pillow";
import { AGE_BANDS, COLLECTIONS, DEMO_COLORS, DIFFICULTY_TIERS, EASY_MERGES, TEMPLATES, ageBandOf, collectionOf, difficultyTierOf, getTemplate, simplifyTemplate } from "./lib/registry";
import {
  CUSTOM_ACCESSORIES,
  CUSTOM_BASES,
  CUSTOM_EARS,
  CUSTOM_EYES,
  CUSTOM_TAILS,
  DEFAULT_CUSTOM_DEF,
  buildCustomTemplate,
  parseCustomDef,
  type CustomDef,
  type PartOption,
} from "./lib/custom";
import type { TemplateDef } from "./lib/model";
import { ArtworkSvg, ColoringEditor, type Stroke } from "./components/ColoringEditor";
import { ModelViewer } from "./components/ModelViewer";
import { PillowViewer } from "./components/PillowViewer";
import { NetPreview, PillowPreview, StandeePreview } from "./components/PrintPreview";
import type { CartLine, OrderOut, ShopSelection } from "./components/Shop";
import { ACTIVE_PRODUCT_IDS, PRODUCT_DEFAULT_PRICES, formatIDR, PRODUCT_META, type ProductId } from "./lib/shop";
import { logoUrl } from "./assets-inline";

const AdminCenter = lazy(() => import("./components/AdminCenter").then((m) => ({ default: m.AdminCenter })));
const Checkout = lazy(() => import("./components/Shop").then((m) => ({ default: m.Checkout })));
const Customize = lazy(() => import("./components/Shop").then((m) => ({ default: m.Customize })));
const Masterpiece = lazy(() => import("./components/Shop").then((m) => ({ default: m.Masterpiece })));
const OrderConfirmation = lazy(() => import("./components/Shop").then((m) => ({ default: m.OrderConfirmation })));
const OrderTracking = lazy(() => import("./components/Shop").then((m) => ({ default: m.OrderTracking })));
const CatalogProductPreview = lazy(() => import("./components/Shop").then((m) => ({ default: m.CatalogProductPreview })));
const AffiliateDashboard = lazy(() => import("./components/Affiliate").then((m) => ({ default: m.AffiliateDashboard })));
const AffiliateInvitePage = lazy(() => import("./components/Affiliate").then((m) => ({ default: m.AffiliateInvitePage })));
const AffiliateLoginPage = lazy(() => import("./components/Affiliate").then((m) => ({ default: m.AffiliateLoginPage })));
const AffiliateResetPage = lazy(() => import("./components/Affiliate").then((m) => ({ default: m.AffiliateResetPage })));
const AffiliateRegistrationPage = lazy(() => import("./components/AffiliateRegistration").then((m) => ({ default: m.AffiliateRegistrationPage })));

function DeferredPreview({ children }: { children: ReactNode }) {
  const marker = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!marker.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "240px" });
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={marker}>
      {visible ? <Suspense fallback={<div className="aspect-square" />}>{children}</Suspense> : <div className="aspect-square" />}
    </div>
  );
}

type ServerProject = ApiResponse<typeof api, "listProjects">["projects"][number];

export interface WorkProject {
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

type Route =
  | { view: "home" }
  | { view: "explore" }
  | { view: "custom" }
  | { view: "studio" }
  | { view: "magic" }
  | { view: "print" }
  | { view: "finish" }
  | { view: "customize" }
  | { view: "checkout" }
  | { view: "ordered" }
  | { view: "creations" }
  | { view: "aff-register" }
  | { view: "aff-invite"; token: string }
  | { view: "aff-login" }
  | { view: "aff-dashboard" }
  | { view: "aff-reset"; token: string }
  | { view: "aff-admin" }
  | { view: "parents" };

// Hash deep links for the affiliate program (invitations, PIN resets,
// referral attribution) — the only "URLs" this single-page app owns.
function parseHashRoute(): Route | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash;
  const invite = h.match(/^#\/affiliate\/invite\/([A-Za-z0-9]+)/);
  if (invite?.[1]) return { view: "aff-invite", token: invite[1] };
  const reset = h.match(/^#\/affiliate\/reset\/([A-Za-z0-9]+)/);
  if (reset?.[1]) return { view: "aff-reset", token: reset[1] };
  if (h.startsWith("#/affiliate/daftar")) return { view: "aff-register" };
  if (h.startsWith("#/affiliate/login")) return { view: "aff-login" };
  if (h.startsWith("#/affiliate/dashboard")) return { view: "aff-dashboard" };
  // Rute khusus admin untuk Manajemen Afiliasi: SENGAJA tidak ditautkan
  // dari menu, header, footer, Dasbor Orang Tua, atau halaman publik mana
  // pun — admin membukanya langsung lewat potongan alamat ini.
  if (h === "#/admin" || h === "#/admin/" || h === "#/admin/affiliate" || h === "#/admin/orders" || h === "#/kelola-afiliasi-4821") return { view: "aff-admin" };
  if (h === "#/orang-tua") return { view: "parents" };
  if (h === "#/koleksi") return { view: "explore" };
  if (h === "#/kreasiku") return { view: "creations" };
  return null;
}

function captureReferral(): string {
  if (typeof window === "undefined") return "";
  let ref = "";
  try {
    ref = new URLSearchParams(window.location.search).get("ref") ?? "";
    if (!ref) {
      const m = window.location.hash.match(/^#\/ref\/([A-Za-z0-9_-]+)/);
      if (m?.[1]) ref = m[1];
    }
    if (ref) localStorage.setItem("bfk-ref", ref.toUpperCase());
  } catch {
    ref = "";
  }
  return ref;
}

function fontFamilyOf(id: string): string {
  return (NAME_FONTS.find((f) => f.id === id) ?? NAME_FONTS[0]!).family;
}

function toWork(p: ServerProject): WorkProject {
  return {
    id: p.id,
    templateId: p.templateId,
    childName: p.childName,
    message: p.message,
    nameFont: p.nameFont,
    nameColor: p.nameColor,
    nameAlign: p.nameAlign,
    colors: p.colors,
    strokes: p.strokes as Stroke[],
    customDef: p.customDef,
    status: p.status,
  };
}

function newWork(templateId: string, customDef = ""): WorkProject {
  return {
    id: null,
    templateId,
    childName: "",
    message: "",
    nameFont: "baloo",
    nameColor: "#E4572E",
    nameAlign: "center",
    colors: {},
    strokes: [],
    customDef,
    status: "draft",
  };
}

/**
 * The template a project actually renders with: catalog characters come
 * from the registry; "custom" projects rebuild their mix-and-match
 * template from the saved part combination.
 */
function templateForProject(p: { templateId: string; customDef?: string }): TemplateDef {
  if (p.templateId === "custom") {
    const def = parseCustomDef(p.customDef);
    if (def) return buildCustomTemplate(def);
  }
  return getTemplate(p.templateId);
}

/**
 * Proyek yatim: proyek tersimpan yang karakter dasarnya sudah tidak ada
 * di katalog saat ini (mis. template lama yang dihapus). Proyek seperti
 * ini disaring dari daftar sampai templatnya tersedia lagi.
 */
function isOrphanProject(p: { templateId: string }): boolean {
  return p.templateId !== "custom" && !TEMPLATES.some((t) => t.id === p.templateId);
}

function downloadArtworkPng(svg: SVGSVGElement | null, filename: string) {
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const W = 1400;
    const H = Math.round((W * img.height) / Math.max(1, img.width)) || 1050;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(url);
    canvas.toBlob((b) => {
      if (b) void import("./lib/pdf").then(({ downloadBlob }) => downloadBlob(b, filename));
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

/* ------------------------------ Shell ------------------------------ */

type NavView = "home" | "explore" | "custom" | "creations" | "parents";

const NAV_ITEMS: { view: NavView; label: string; short: string; icon: ReactNode }[] = [
  {
    view: "home",
    label: "Beranda",
    short: "Beranda",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M9.5 20v-5h5v5" /></svg>
    ),
  },
  {
    view: "explore",
    label: "Jelajahi",
    short: "Jelajahi",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 18V5.5" /><path d="M8 7.5h8" /></svg>
    ),
  },
  {
    view: "custom",
    label: "Buat Sendiri",
    short: "Buat",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14" /><path d="M5 12h14" /></svg>
    ),
  },
  {
    view: "creations",
    label: "Kreasiku",
    short: "Kreasiku",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m5 19 5-5 3 3 3.5-3.5L21 18" /></svg>
    ),
  },
  {
    view: "parents",
    label: "Orang Tua",
    short: "Orang Tua",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.9" /><path d="M17.8 15.4c1.6.7 2.6 2.2 3 4.6" /></svg>
    ),
  },
];

// Views that belong to a nav destination (studio/magic/print follow Kreasiku's
// flow but light up "Jelajahi" while a fresh artwork is in progress).
function navActiveView(route: Route): NavView {
  if (
    route.view === "studio" ||
    route.view === "magic" ||
    route.view === "print" ||
    route.view === "finish" ||
    route.view === "customize" ||
    route.view === "checkout" ||
    route.view === "ordered"
  )
    return "explore";
  if (
    route.view === "aff-register" ||
    route.view === "aff-invite" ||
    route.view === "aff-login" ||
    route.view === "aff-dashboard" ||
    route.view === "aff-reset" ||
    route.view === "aff-admin"
  )
    return "parents";
  return route.view as NavView;
}

function Header({
  brandName,
  route,
  go,
  onCustom,
}: {
  brandName: string;
  route: Route;
  go: (r: Route) => void;
  onCustom: () => void;
}) {
  const active = navActiveView(route);
  const item = (view: NavView, label: string) => (
    <button
      key={view}
      type="button"
      aria-current={active === view ? "page" : undefined}
      onClick={() => (view === "custom" ? onCustom() : go({ view } as Route))}
      className={`whitespace-nowrap rounded-full px-3.5 py-2 font-display text-sm font-semibold transition ${
        active === view
          ? "bg-olive text-white"
          : "text-[var(--text)] hover:bg-[var(--surface-alt)]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[#F8F4EC]/90 pt-safe backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => go({ view: "home" })}
          className="flex min-w-0 shrink items-center gap-2.5"
          aria-label={`${brandName} beranda`}
        >
          <img
            src={logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-1 ring-black/10 sm:h-11 sm:w-11"
          />
          <span className="truncate font-display text-base font-semibold tracking-tight text-olive sm:text-lg">
            {brandName}
          </span>
        </button>
        {/* Navigasi atas hanya untuk tablet/desktop; di ponsel navigasi
            pindah ke tab bar bawah (MobileTabBar) supaya tidak ada item
            yang terpotong atau harus digeser menyamping. */}
        <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="Utama">
          {NAV_ITEMS.map((n) => item(n.view, n.label))}
        </nav>
        <button
          type="button"
          onClick={() => go({ view: "explore" })}
          className="ml-auto shrink-0 rounded-full bg-tang px-4 py-2 font-display text-sm font-semibold text-ink shadow-sm transition hover:bg-tang-deep sm:ml-1"
        >
          Mulai Berkreasi
        </button>
      </div>
      {/* Pita empat warna logo di bawah header — penanda warna merek
          yang tampil di semua halaman, terang maupun gelap. */}
      <div aria-hidden className="flex h-1.5">
        <span className="flex-1 bg-olive" />
        <span className="flex-1 bg-sky" />
        <span className="flex-1 bg-butter" />
        <span className="flex-1 bg-tang" />
      </div>
    </header>
  );
}

/* Tab bar bawah khusus ponsel: semua tujuan utama selalu terlihat penuh
   dan terjangkau jempol, tanpa scroll menyamping. */
function MobileTabBar({
  route,
  go,
  onCustom,
}: {
  route: Route;
  go: (r: Route) => void;
  onCustom: () => void;
}) {
  const active = navActiveView(route);
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[#F8F4EC]/95 pb-safe backdrop-blur-md sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.map((n) => {
          const isActive = active === n.view;
          return (
            <button
              key={n.view}
              type="button"
              aria-current={isActive ? "page" : undefined}
              aria-label={n.label}
              onClick={() => (n.view === "custom" ? onCustom() : go({ view: n.view } as Route))}
              className={`flex flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 font-display text-[11px] font-semibold leading-tight transition ${
                isActive ? "text-olive" : "text-[var(--dim)]"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                  isActive ? "bg-olive text-white" : ""
                }`}
              >
                {n.icon}
              </span>
              {n.short}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------ Home ------------------------------ */

function Home({
  brandName,
  catalogPrices,
  startTemplate,
  go,
  onAge,
  onCustom,
}: {
  brandName: string;
  catalogPrices: Partial<Record<ProductId, number>>;
  startTemplate: (id: string) => void;
  go: (r: Route) => void;
  onAge: (bandId: string) => void;
  onCustom: () => void;
}) {
  const customPreview = buildCustomTemplate(DEFAULT_CUSTOM_DEF);
  const dino = getTemplate("pb-dino");
  // Contoh hasil warnai untuk etalase transformasi — diberi label jelas
  // sebagai contoh. Katalog & halaman awal tetap hitam putih; warna di
  // etalase ini hanya mendemonstrasikan alur layar → karya jadi.
  const demo = DEMO_COLORS["pb-dino"] ?? {};
  // Bentuk proyek dari karya contoh, untuk pratinjau mockup produk di
  // bagian Tiga Cara (poster berbingkai & kaos) — data contoh berlabel.
  const demoProject = {
    id: null,
    templateId: "pb-dino",
    childName: "Adam",
    message: "",
    nameFont: "baloo",
    nameColor: "#E4572E",
    nameAlign: "center" as const,
    colors: demo,
    strokes: [],
    customDef: "",
    status: "done" as const,
  };
  // Jaring Bantal Kertas asli untuk tahap 4 perbandingan — file cetak
  // yang sama dengan yang melipat menjadi model digital di tahap 3.
  const dinoPillowNet = useMemo(() => buildPillowNet(dino), [dino]);
  const creations = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects({ limit: 50 }),
  });
  const madeList = (creations.data?.projects ?? []).filter(
    (p) => Object.keys(p.colors).length > 0 && !isOrphanProject(p),
  );
  const scrollToSteps = () => {
    document.getElementById("cara-kerja")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      {/* HERO — dua kolom: naskah di kiri, etalase produk di kanan */}
      <section className="grid items-center gap-10 pt-8 sm:pt-12 lg:grid-cols-2">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-tang-ink">
            Bermain Kreatif, Karya Milik Sendiri
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.04] text-[var(--text)]">
            <span className="text-olive">Warnai Sendiri.</span>
            <br />
            Kami <span className="text-tang-ink">Wujudkan.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-[var(--dim)]">
            Si kecil bebas memilih karakter, mewarnai, dan menambahkan namanya — selalu
            gratis. Setelah selesai, wujudkan kreasinya menjadi poster, papercraft 3D, alas makan,
            celengan, puzzle, growth chart atau kaos yang dikirim langsung ke rumah.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => startTemplate("pb-dino")}
              className="rounded-full bg-tang px-7 py-3 font-display text-base font-semibold text-ink shadow-sm transition hover:bg-tang-deep"
            >
              Mulai Mewarnai
            </button>
            <button
              type="button"
              onClick={scrollToSteps}
              className="rounded-full bg-[var(--surface)] px-7 py-3 font-display text-base font-semibold text-[var(--text)] ring-1 ring-[var(--border)] transition hover:bg-[var(--surface-alt)]"
            >
              Lihat Cara Kerjanya
            </button>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[var(--dim)]">
            <li>Custom Nama</li>
            <li>Preview 3D</li>
            <li>Dicetak &amp; Dikirim</li>
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Contoh transformasi dari gambar warna menjadi model 3D">
          <div aria-hidden className="absolute -inset-3 rounded-[3rem] bg-[#E7F3FB]" />
          <div aria-hidden className="absolute -right-2 -top-5 h-24 w-24 rounded-full bg-butter ring-4 ring-[var(--bg)]" />
          <div className="anim-floaty relative ml-auto w-[84%] rounded-[1.75rem] bg-white p-3 shadow-lg ring-1 ring-black/5 sm:w-[62%]">
            <PillowViewer
              template={dino}
              colors={demo}
              strokes={[]}
              name="Adam"
              nameFontFamily={fontFamilyOf("baloo")}
              nameColor="#E4572E"
              height={215}
              showControls={false}
              autoRotate
              restYaw={Math.PI + 0.6}
            />
          </div>
          <div className="relative -mt-5 w-[78%] rounded-[1.75rem] bg-white p-3 shadow-lg ring-1 ring-black/5 sm:-mt-6 sm:w-[58%]">
            <ArtworkSvg
              template={dino}
              colors={demo}
              strokes={[]}
              name="Adam"
              nameFont="baloo"
              nameColor="#E4572E"
            />
            <p className="pb-1 pt-2 text-center font-display text-sm font-semibold text-[var(--dim)]">Hasil warnai anak (contoh)</p>
          </div>
          <p className="relative mt-3 text-center text-xs font-semibold text-[var(--dim)]">
            Atas: model digital Bantal Kertas dari karya contoh di bawah — kedua sisinya
            persis gambar anak, tepinya strip gusset, berdiri di alas lipat bernama.
            Pratinjau digital, bukan foto produk jadi. Untuk wujud fisik yang diproduksi
            &amp; dikirim tim kami, pesan Poster, Figurine 3D, atau Kaos dari karya anakmu
            lewat tombol Jadikan Nyata setelah mewarnai (lihat bagian Tiga Cara di bawah).
          </p>
        </div>
      </section>

      {/* CARA KERJA — linimasa empat langkah di panel sage pucat #EDF2E6 */}
      <section id="cara-kerja" className="band-sage mt-20 scroll-mt-24 rounded-[2.5rem] px-6 py-10 sm:px-10" aria-label="Cara kerjanya">
        <p className="band-accent font-display text-xs font-semibold uppercase tracking-[0.22em]">Cara Kerjanya</p>
        <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Dari Imajinasi, <span className="band-accent">Jadi Kreasi.</span></h2>
        <div className="relative mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div aria-hidden className="absolute left-0 right-0 top-5 hidden border-t-2 border-dashed border-[#3B2A22]/30 lg:block" />
          {[
            { n: "01", title: "Pilih Karakter", body: "200 karakter hitam putih dalam lima kategori umur — dari bidang super besar untuk bayi sampai detail seru untuk anak 5 tahun." },
            { n: "02", title: "Warnai & Custom Nama", body: "Ketuk untuk mengisi warna, gambar bebas dengan kuas, lalu tulis nama dan pesan si kecil dengan gaya huruf favoritnya." },
            { n: "03", title: "Pilih Bentuk Kreasi", body: "Poster, papercraft 3D, alas makan, celengan, puzzle, growth chart, atau kaos — semuanya mengikuti warna karya anakmu." },
            { n: "04", title: "Kami Cetak & Kirim", body: "Pesan dari halaman karya, selesaikan pembayaran lewat konfirmasi tim kami, dan kami produksi lalu kirim langsung ke rumah." },
          ].map((s) => (
            <article key={s.n} className="relative">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-olive font-display text-sm font-semibold text-white">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-xl font-semibold">{s.title}</h3>
              <p className="band-dim mt-1 leading-relaxed">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Etalase: tujuh produk aktif; karya demo diberi label sebagai contoh. */}
      <section className="mt-20" aria-label="Tujuh bentuk kreasi fisik">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-olive">Tujuh Cara Mewujudkan Karya</p>
        <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Satu Karya, Banyak Cara <span className="hero-word-sky">untuk Jadi Nyata.</span></h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-[var(--dim)]">Mewarnai selalu gratis. Pilih produk setelah mewarnai dan lihat bagaimana karya serta nama si kecil tampil pada produk pilihanmu. Ongkir ditampilkan terpisah.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ACTIVE_PRODUCT_IDS.map((id) => (
            <article key={id} className="flex flex-col overflow-hidden rounded-[2rem] bg-[var(--surface)] ring-1 ring-[var(--border)]">
              <div className="bg-[#EEF4E4] p-4">
                <DeferredPreview><CatalogProductPreview key={id} product={id} project={demoProject} /></DeferredPreview>
                <p className="pt-2 text-center text-xs font-semibold text-[var(--dim)]">Contoh personalisasi</p>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-2xl font-extrabold">{PRODUCT_META[id].title}</h3>
                <p className="mt-2 leading-relaxed text-[var(--dim)]">{PRODUCT_META[id].description}</p>
                <p className="mt-3 font-display text-xl font-extrabold text-olive-deep">{formatIDR(catalogPrices[id] ?? PRODUCT_DEFAULT_PRICES[id])}</p>
                <button type="button" onClick={() => startTemplate("pb-dino")} className="mt-5 rounded-full bg-olive px-5 py-2.5 font-display text-base font-semibold text-white transition hover:bg-olive-deep">{PRODUCT_META[id].cta}</button>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--dim)]">Pola DIY gratis tetap tersedia di Studio Cetak. Harga papercraft fisik {formatIDR(catalogPrices.papercraft ?? PRODUCT_DEFAULT_PRICES.papercraft)} belum termasuk ongkir.</p>
      </section>

      {/* KOLEKSI — kartu editorial ala kemasan mainan, di panel putih */}
      <section className="mt-20 rounded-[2.5rem] bg-white px-6 py-10 ring-1 ring-[var(--border)] sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-olive">Jelajahi Koleksi</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Petualangan Dimulai <span className="hero-word-olive">dari Satu Warna.</span></h2>
          </div>
          <button type="button" onClick={() => go({ view: "explore" })} className="font-display text-sm font-semibold text-sky-deep underline underline-offset-4">
            Lihat semua karakter
          </button>
        </div>
        <p className="mt-2 max-w-xl leading-relaxed text-[var(--dim)]">Setiap halaman mulai hitam putih — bidang putih kosong bergaris hitam, siap diwarnai anakmu sendiri.</p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {COLLECTIONS.map((c) => {
            const first = TEMPLATES.find((t) => t.collection === c.id)!;
            const count = TEMPLATES.filter((t) => t.collection === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => go({ view: "explore" })}
                className="group rounded-[1.75rem] p-4 text-left ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: c.soft }}
              >
                <div className="rounded-3xl bg-white p-2.5">
                  <ArtworkSvg template={first} colors={{}} strokes={[]} name="" nameFont="baloo" nameColor="#E4572E" />
                </div>
                <p className="mt-3 font-display text-lg font-semibold leading-tight text-ink">{c.name}</p>
                <p className="text-sm font-semibold text-ink-soft">{c.tagline}</p>
                <p className="mt-1.5 font-display text-sm font-semibold text-olive-deep">{count} karakter →</p>
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2" aria-label="Belanja berdasarkan umur">
          <span className="font-display text-sm font-semibold text-[var(--dim)]">Berdasarkan umur:</span>
          {AGE_BANDS.map((b) => {
            const count = TEMPLATES.filter((t) => t.ageBand === b.id).length;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onAge(b.id)}
                className="rounded-full px-4 py-2 font-display text-sm font-semibold text-ink ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-sm"
                style={{ background: b.soft }}
              >
                {b.label} <span className="font-body font-bold text-ink">· {count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* KOLEKSI BUKU MEWARNAI — cuplikan dari semua tahap usia */}
      <section className="mt-20" aria-label="Koleksi Buku Mewarnai">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-olive">Koleksi Buku Mewarnai</p>
        <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Dua ratus halaman mewarnai, <span className="hero-word-olive">lima tahap usia.</span></h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-[var(--dim)]">
          Setiap ilustrasi bergaya buku cerita yang sama — siluet bulat yang lembut, wajah ramah, dan garis yang bersih.
          Empat puluh untuk setiap tahap: bidang raksasa bergaris tebal untuk bayi 9–18 bulan yang ditemani orang tua, sampai adegan
          penuh cerita untuk anak 4–5 tahun. Semuanya halaman hitam putih yang siap diwarnai, dijadikan 3D, dan dicetak.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {AGE_BANDS.flatMap((b) => TEMPLATES.filter((t) => t.ageBand === b.id).slice(0, 2)).map((t) => {
            const tier = difficultyTierOf(t);
            return (
              <article key={t.id} className="flex flex-col rounded-[1.75rem] bg-[var(--surface)] p-3 ring-1 ring-[var(--border)] transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="rounded-3xl bg-white p-2 ring-1 ring-black/5">
                  <ArtworkSvg template={t} colors={{}} strokes={[]} name="" nameFont="baloo" nameColor="#E4572E" />
                </div>
                <h3 className="mt-2 font-display text-base font-semibold leading-tight">{t.name}</h3>
                <p className="text-sm font-semibold text-[var(--dim)]">{t.blurb}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <span className="rounded-full px-2 py-0.5 text-ink" style={{ background: ageBandOf(t.ageBand).soft }}>Usia {t.age}</span>
                  <span className="rounded-full px-2 py-0.5 text-ink" style={{ background: tier.soft }}>{tier.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => startTemplate(t.id)}
                  className="mt-auto pt-3 text-left font-display text-sm font-semibold text-sky-deep"
                >
                  <span className="block rounded-full bg-sky-deep px-4 py-2 text-center text-white shadow transition hover:opacity-90">Mulai Mewarnai</span>
                </button>
              </article>
            );
          })}
        </div>
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => go({ view: "explore" })}
            className="rounded-full bg-olive px-8 py-3.5 font-display text-lg font-extrabold text-white shadow-lg transition hover:bg-olive-deep"
          >
            Lihat Semua Karakter
          </button>
        </div>
      </section>

      {/* DARI LAYAR MENJADI NYATA — perbandingan empat tahap di panel biru langit logo */}
      <section className="band-sky mt-20 rounded-[2.5rem] px-6 py-10 sm:px-10" aria-label="Dari layar menjadi nyata">
        <p className="band-accent font-display text-xs font-semibold uppercase tracking-[0.22em]">Dari Layar Menjadi Nyata</p>
        <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Perjalanan satu <span className="band-accent">karya kecil</span></h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <figure className="rounded-[1.75rem] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
            <div className="rounded-3xl bg-white p-2 ring-1 ring-black/5">
              <ArtworkSvg template={dino} colors={{}} strokes={[]} name="" nameFont="baloo" nameColor="#E4572E" />
            </div>
            <figcaption className="pt-3">
              <span className="font-display text-sm font-semibold text-olive">Tahap 1</span>
              <p className="font-display text-base font-semibold">Ilustrasi asli</p>
              <p className="text-sm leading-relaxed text-[var(--dim)]">Halaman hitam putih kosong — titik awal setiap kreasi.</p>
            </figcaption>
          </figure>
          <figure className="rounded-[1.75rem] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
            <div className="rounded-3xl bg-white p-2 ring-1 ring-black/5">
              <ArtworkSvg template={dino} colors={demo} strokes={[]} name="Adam" nameFont="baloo" nameColor="#E4572E" />
            </div>
            <figcaption className="pt-3">
              <span className="font-display text-sm font-semibold text-olive">Tahap 2</span>
              <p className="font-display text-base font-semibold">Hasil warnai anak</p>
              <p className="text-sm leading-relaxed text-[var(--dim)]">Warna dan nama pilihan si kecil (gambar contoh berlabel).</p>
            </figcaption>
          </figure>
          <figure className="rounded-[1.75rem] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
            <div className="rounded-3xl bg-sky-soft p-1">
              <PillowViewer template={dino} colors={demo} strokes={[]} name="Adam" nameFontFamily={fontFamilyOf("baloo")} nameColor="#E4572E" height={190} showControls={false} autoRotate={false} restYaw={Math.PI + 0.6} />
            </div>
            <figcaption className="pt-3">
              <span className="font-display text-sm font-semibold text-olive">Tahap 3</span>
              <p className="font-display text-base font-semibold">Model digital Bantal Kertas</p>
              <p className="text-sm leading-relaxed text-[var(--dim)]">Bentuk yang akan kamu terima — dibangun dari garis bentuk dan warna yang sama dengan lembar cetak tahap berikutnya.</p>
            </figcaption>
          </figure>
          <figure className="rounded-[1.75rem] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
            <div className="max-h-64 overflow-hidden rounded-3xl bg-white p-2 ring-1 ring-black/5">
              <PillowPreview net={dinoPillowNet} template={dino} colors={demo} strokes={[]} name="Adam" nameFont="baloo" nameColor="#E4572E" />
            </div>
            <figcaption className="pt-3">
              <span className="font-display text-sm font-semibold text-olive">Tahap 4</span>
              <p className="font-display text-base font-semibold">Lembar kit-nya</p>
              <p className="text-sm leading-relaxed text-[var(--dim)]">Lembar cetak asli Bantal Kertas dari file produksinya — panel depan, panel belakang, strip gusset, dan alas lipat yang terlipat menjadi model di tahap 3. Bukan foto produk manufaktur.</p>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* DIBUAT OLEH SENIMAN KECIL — hanya karya tersimpan nyata, panel putih */}
      <section className="mt-20 rounded-[2.5rem] bg-white px-6 py-10 ring-1 ring-[var(--border)] sm:px-10" aria-label="Dibuat oleh seniman kecil">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-olive">Dibuat oleh Seniman Kecil</p>
        <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Galeri <span className="hero-word-sky">keluargamu sendiri</span></h2>
        {madeList.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] bg-[var(--surface)] p-6 ring-1 ring-[var(--border)]">
            <p className="max-w-lg leading-relaxed text-[var(--dim)]">
              Galeri ini hanya menampilkan karya yang benar-benar dibuat dan disimpan di
              perangkat ini — kami tidak memasang contoh palsu. Kreasi pertama keluargamu
              akan tampil di sini.
            </p>
            <button
              type="button"
              onClick={() => go({ view: "explore" })}
              className="mt-4 rounded-full bg-tang px-6 py-2.5 font-display text-base font-semibold text-ink transition hover:bg-tang-deep"
            >
              Buat Kreasi Pertama
            </button>
          </div>
        ) : (
          <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4">
            {madeList.slice(0, 8).map((p) => {
              const t = templateForProject(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => go({ view: "creations" })}
                  className="mb-4 block w-full break-inside-avoid rounded-[1.75rem] bg-[var(--surface)] p-3 text-left ring-1 ring-[var(--border)] transition hover:shadow-md"
                >
                  <div className="rounded-3xl bg-white p-2 ring-1 ring-black/5">
                    <ArtworkSvg template={t} colors={p.colors} strokes={p.strokes as Stroke[]} name={p.childName} nameFont={p.nameFont} nameColor={p.nameColor} />
                  </div>
                  <p className="px-1 pb-1 pt-2 font-display text-sm font-semibold">
                    {p.childName.trim() ? `${t.name} milik ${p.childName.trim()}` : t.name}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* KENAPA ORANG TUA MENYUKAINYA */}
      <section className="mt-20 grid gap-8 lg:grid-cols-[1fr_1.4fr]" aria-label="Kenapa orang tua menyukainya">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-olive">Untuk Orang Tua</p>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Bukan Sekadar <span className="hero-word-olive">Mewarnai.</span></h2>
          <p className="mt-3 max-w-sm leading-relaxed text-[var(--dim)]">
            {brandName} dirancang untuk anak, dan dibuat meyakinkan untuk orang tua:
            aktivitasnya nyata, hasilnya bisa dipegang, dan datanya tetap privat.
          </p>
          <button
            type="button"
            onClick={() => go({ view: "parents" })}
            className="mt-5 rounded-full bg-[var(--surface)] px-6 py-2.5 font-display text-base font-semibold ring-1 ring-[var(--border)] transition hover:bg-[var(--surface-alt)]"
          >
            Baca Panduan Orang Tua
          </button>
        </div>
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {[
            { t: "Ruang untuk berekspresi", d: "Setiap warna adalah keputusan si kecil sendiri — tidak ada jawaban benar atau salah di halaman ini." },
            { t: "Aktivitas kreatif bersama keluarga", d: "Mewarnai, menggunting, melipat, dan merakit adalah waktu bersama, bukan waktu layar sendirian." },
            { t: "Nama anak pada setiap karya", d: "Papan nama personal membuat setiap hasil terasa miliknya — dan mudah dikenali sebagai karyanya." },
            { t: "Kenang-kenangan yang bisa disimpan", d: "Hasil jadi yang berdiri di rak buku: gambar masa kecil yang tidak hilang di galeri foto." },
          ].map((b) => (
            <div key={b.t} className="border-t-2 border-[var(--border)] pt-4">
              <dt className="font-display text-lg font-semibold">{b.t}</dt>
              <dd className="mt-1 leading-relaxed text-[var(--dim)]">{b.d}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* BUAT KARAKTER SENDIRI — panel oranye logo */}
      <section className="band-tang mt-20 grid items-center gap-6 rounded-[2rem] p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="band-accent font-display text-xs font-semibold uppercase tracking-[0.22em]">Buat Karakter Sendiri</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">Tidak ada di buku? <span className="band-accent">Ceritakan saja.</span></h2>
          <p className="band-dim mt-2 max-w-lg leading-relaxed">
            Tulis cerita karakter impian — “kucing astronot pakai topi bintang” — dan AI kami
            merakitnya dari bagian-bagian Bun &amp; Fleur yang sudah teruji, lengkap dengan
            warna per bagian. Atau rakit sendiri bagian demi bagian. Hasilnya bisa diwarnai
            ulang dan dicetak sebagai Bantal Kertas atau Standee.
          </p>
          <button
            type="button"
            onClick={onCustom}
            className="mt-5 rounded-full bg-olive px-6 py-2.5 font-display text-base font-semibold text-white shadow-sm transition hover:bg-olive-deep"
          >
            Rakit Karakterku
          </button>
        </div>
        <div className="mx-auto w-52 rounded-[1.75rem] bg-white p-3 shadow-sm ring-1 ring-black/5 sm:w-60">
          <ArtworkSvg template={customPreview} colors={{}} strokes={[]} name="" nameFont="baloo" nameColor="#E4572E" />
          <p className="pb-1 pt-2 text-center font-display text-xs font-semibold text-[var(--dim)]">Mulai hitam putih juga — warnanya dari kamu</p>
        </div>
      </section>

      {/* CTA PENUTUP — satu-satunya panel warna pekat: olive #667C3E */}
      <section className="band-olive mt-20 rounded-[2.5rem] px-6 py-12 text-center sm:px-12">
        <h2 className="mx-auto max-w-xl font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Little Hands. Big Creations.
        </h2>
        <p className="band-dim mx-auto mt-3 max-w-md leading-relaxed">
          Satu karya kecil bisa menjadi kenangan yang besar.
        </p>
        <button
          type="button"
          onClick={() => go({ view: "explore" })}
          className="mt-6 rounded-full bg-tang px-8 py-3 font-display text-lg font-semibold text-ink shadow-sm transition hover:bg-tang-deep"
        >
          Mulai Berkreasi
        </button>
      </section>
    </div>
  );
}

/* ------------------------------ Explore ------------------------------ */

const EXPLORE_PAGE = 24;

function Explore({ startTemplate, initialAge = "all" }: { startTemplate: (id: string) => void; initialAge?: string }) {
  const [filter, setFilter] = useState<string>("all");
  const [ageFilter, setAgeFilter] = useState<string>(initialAge);
  const [diffFilter, setDiffFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(EXPLORE_PAGE);
  useEffect(() => {
    setVisible(EXPLORE_PAGE);
  }, [filter, ageFilter, diffFilter, query]);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = TEMPLATES.filter(
      (t) =>
        (filter === "all" || t.collection === filter) &&
        (ageFilter === "all" || t.ageBand === ageFilter) &&
        (diffFilter === "all" || difficultyTierOf(t).id === diffFilter) &&
        (q === "" || t.name.toLowerCase().includes(q)),
    );
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [filter, ageFilter, diffFilter, query]);
  const shown = items.slice(0, visible);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <div className="band-sky mt-4 rounded-[2rem] px-6 py-8 sm:px-8">
        <p className="band-accent font-display text-xs font-semibold uppercase tracking-[0.22em]">Buku Mewarnai</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Jelajahi <span className="band-accent">Buku</span></h1>
        <p className="band-dim mt-2 max-w-2xl leading-relaxed">Semua karakter tampil hitam putih: bidang putih kosong bergaris hitam tebal, siap diwarnai dari nol. Ada 200 karakter dalam lima kategori umur — 40 untuk setiap tahap, dari bidang raksasa untuk bayi 9–18 bulan sampai adegan penuh cerita untuk anak 4–5 tahun. Setelah diwarnai, warnanya hidup di 3D dan hasil cetaknya.</p>
        <div className="mt-4">
          <label htmlFor="explore-search" className="sr-only">Cari karakter berdasarkan nama</label>
          <input
            id="explore-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari karakter… cth. kucing, roket, kaktus"
            className="w-full rounded-full bg-white px-5 py-3 font-display text-base font-bold text-ink ring-1 ring-black/5 focus:outline-2 focus:outline-sky-deep sm:max-w-md"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter berdasarkan koleksi">
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${filter === "all" ? "bg-ink text-white" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
        >
          Semua buku
        </button>
        {COLLECTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold ${filter === c.id ? "bg-ink text-white" : "ring-1 ring-black/5"}`}
            style={filter === c.id ? undefined : { background: c.soft, color: "var(--text)" }}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter berdasarkan umur">
        <span className="font-display text-sm font-extrabold text-olive">Umur:</span>
        <button
          type="button"
          aria-pressed={ageFilter === "all"}
          onClick={() => setAgeFilter("all")}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${ageFilter === "all" ? "bg-olive text-white shadow" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
        >
          Semua umur
        </button>
        {AGE_BANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={ageFilter === b.id}
            onClick={() => setAgeFilter(b.id)}
            className="rounded-full px-4 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]"
            style={
              ageFilter === b.id
                ? { background: b.color, color: "#fff" }
                : { background: b.soft, color: b.color }
            }
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter berdasarkan tingkat kesulitan">
        <span className="font-display text-sm font-extrabold text-olive">Kesulitan:</span>
        <button
          type="button"
          aria-pressed={diffFilter === "all"}
          onClick={() => setDiffFilter("all")}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${diffFilter === "all" ? "bg-olive text-white shadow" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
        >
          Semua tingkat
        </button>
        {DIFFICULTY_TIERS.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={diffFilter === d.id}
            onClick={() => setDiffFilter(d.id)}
            aria-label={`${d.label} — ${d.hint}`}
            className="rounded-full px-4 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]"
            style={
              diffFilter === d.id
                ? { background: d.color, color: "#fff" }
                : { background: d.soft, color: d.color }
            }
          >
            {d.label}
          </button>
        ))}
      </div>
      {items.length === 0 && (
        <p className="mt-8 rounded-3xl bg-[var(--surface)] p-6 text-center font-display font-bold ring-1 ring-[var(--border)]">
          Belum ada karakter di kombinasi ini — coba koleksi, umur, atau tingkat kesulitan lain ya.
        </p>
      )}
      {items.length > 0 && (
        <p className="mt-4 text-sm font-bold text-[var(--dim)]" role="status">
          Menampilkan {shown.length} dari {items.length} karakter
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((t) => {
          const c = collectionOf(t.collection);
          return (
            <article key={t.id} className="flex flex-col rounded-[1.75rem] bg-[var(--surface)] p-3 ring-1 ring-[var(--border)] transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="rounded-3xl bg-white p-2 ring-1 ring-black/5">
                <ArtworkSvg template={t} colors={{}} strokes={[]} name="" nameFont="baloo" nameColor="#E4572E" />
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold leading-tight">{t.name}</h2>
              <p className="text-sm font-semibold text-[var(--dim)]">{t.blurb}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
                <span className="rounded-full bg-ink px-2.5 py-1 text-white">
                  Hitam Putih
                </span>
                <span className="rounded-full px-2.5 py-1" style={{ background: c.soft, color: "var(--text)" }}>
                  {c.name}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-ink"
                  style={{ background: ageBandOf(t.ageBand).soft }}
                >
                  Umur {t.age}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-ink"
                  style={{ background: difficultyTierOf(t).soft }}
                  title={difficultyTierOf(t).hint}
                >
                  {difficultyTierOf(t).label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => startTemplate(t.id)}
                className="mt-3 rounded-full bg-sky-deep px-4 py-2.5 font-display text-base font-semibold text-white shadow transition hover:opacity-90"
              >
                Mulai Mewarnai
              </button>
            </article>
          );
        })}
      </div>
      {visible < items.length && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + EXPLORE_PAGE)}
            className="rounded-full bg-olive px-8 py-3.5 font-display text-lg font-extrabold text-white shadow-lg transition hover:opacity-90"
          >
            Muat Lebih Banyak ({items.length - visible} lagi)
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------- Buat Karakter Sendiri --------------------- */

function PartPicker({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: PartOption[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <p className="font-display text-sm font-extrabold" id={`picker-${label}`}>{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`picker-${label}`}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onPick(o.id)}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold transition ${
              value === o.id
                ? "bg-olive text-white shadow"
                : "bg-[var(--bg)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const AI_PROMPT_EXAMPLES = [
  "Kucing astronot pakai topi bintang",
  "Beruang merah muda pakai pita besar",
  "Naga hijau kecil bermahkota emas",
  "Kelinci ungu yang suka menari",
  "Panda koki bertopi tinggi",
];

function CustomBuilder({
  initial,
  editing,
  onDone,
  go,
}: {
  initial: CustomDef;
  editing: boolean;
  onDone: (def: CustomDef, colors?: Record<string, string>) => void;
  go: (r: Route) => void;
}) {
  const [def, setDef] = useState<CustomDef>(initial);
  const [nameError, setNameError] = useState("");
  const [mode, setMode] = useState<"ai" | "parts">(editing ? "parts" : "ai");
  const [prompt, setPrompt] = useState("");
  const [aiError, setAiError] = useState("");
  const template = useMemo(() => buildCustomTemplate(def), [def]);
  const set = (patch: Partial<CustomDef>) => setDef((d) => ({ ...d, ...patch }));
  const generateMut = useMutation({
    mutationFn: async (p: string) => await api.generateCharacter({ prompt: p }),
    onError: () => {
      setAiError("AI-nya sedang tidak bisa merakit sekarang. Coba lagi sebentar, atau pakai mode Rakit dari Bagian di bawah.");
    },
    onSuccess: (res) => {
      setAiError("");
      onDone(
        {
          name: res.name,
          base: res.base,
          ears: res.ears,
          tail: res.tail,
          eyes: res.eyes,
          accessory: res.accessory,
        },
        res.colors,
      );
    },
  });
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="band-tang mt-4 rounded-[2rem] px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => go({ view: editing ? "creations" : "explore" })} className="rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5">
            ← Kembali
          </button>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Buat Karakter <span className="band-accent">Sendiri</span></h1>
        </div>
        <p className="band-dim mt-3 font-semibold">
          Setiap bagian karakter adalah bidang warna sendiri di Studio Mewarnai.
          Karakter buatan sendiri tampil sebagai model digital <strong>Bantal Kertas</strong> yang
          bisa diputar — bentuk yang akan kamu terima — dan bisa dicetak sebagai
          <strong> Bantal Kertas</strong> dan <strong>Standee</strong>; jaring 3D lanjutan hanya untuk
          karakter-karakter di buku, jadi karakter ini tidak dibuatkan mesh 3D-nya.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Cara membuat karakter">
        <button
          type="button"
          aria-pressed={mode === "ai"}
          onClick={() => setMode("ai")}
          className={`rounded-full px-5 py-2.5 font-display text-base font-extrabold transition ${mode === "ai" ? "bg-tang text-ink shadow" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
        >
          Buat dengan AI
        </button>
        <button
          type="button"
          aria-pressed={mode === "parts"}
          onClick={() => setMode("parts")}
          className={`rounded-full px-5 py-2.5 font-display text-base font-extrabold transition ${mode === "parts" ? "bg-olive text-white shadow" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
        >
          Rakit dari Bagian
        </button>
      </div>

      {mode === "ai" ? (
        <section className="mt-4 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Buat karakter dengan AI">
          <label htmlFor="ai-prompt" className="font-display text-lg font-extrabold">
            Ceritakan karakter impianmu
          </label>
          <textarea
            id="ai-prompt"
            {...FIELDS.generateCharacter.prompt}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setAiError("");
            }}
            rows={3}
            placeholder="cth. Kucing astronot pakai topi bintang, badannya biru langit"
            className="mt-2 w-full rounded-2xl bg-[var(--bg)] px-4 py-3 font-display text-lg font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
          />
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Contoh cerita">
            {AI_PROMPT_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full bg-sky-soft px-3.5 py-1.5 font-display text-sm font-bold text-sky-deep ring-1 ring-[var(--border)] transition hover:bg-sky-deep hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
          {aiError && <p className="mt-2 text-sm font-bold text-berry" role="alert">{aiError}</p>}
          <button
            type="button"
            disabled={generateMut.isPending || prompt.trim().length < 3}
            onClick={() => generateMut.mutate(prompt.trim())}
            className="mt-4 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-extrabold text-ink shadow-lg transition hover:bg-tang-deep disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {generateMut.isPending ? "AI sedang merakit karaktermu…" : "Buat Karakter dengan AI"}
          </button>
          <p className="mt-3 text-sm font-semibold text-[var(--dim)]">
            Cara kerjanya, sejujurnya: AI tidak menggambar bebas. Ia membaca ceritamu lalu
            merakit karakter dari bagian-bagian Bun &amp; Fleur yang sudah teruji (bentuk badan,
            telinga, ekor, mata, aksesori) dan mewarnai tiap bagian sesuai ceritamu — sebutkan
            warnanya di cerita bila ingin warna tertentu. Karena dirakit dari bagian yang rapi,
            hasilnya selalu bisa kamu warnai ulang per bagian dan dicetak jadi Bantal Kertas
            atau Standee yang garis potongnya persis mengikuti bentuknya.
          </p>
        </section>
      ) : (
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-[1fr_320px]">
        <section className="space-y-4 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]" aria-label="Pilih bagian karakter">
          <div>
            <label htmlFor="custom-name" className="font-display text-sm font-extrabold">Nama karaktermu</label>
            <input
              id="custom-name"
              value={def.name}
              onChange={(e) => {
                set({ name: e.target.value.slice(0, 24) });
                setNameError("");
              }}
              placeholder="cth. Bimo si Pemberani"
              className="mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-display text-lg font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
            />
            {nameError && <p className="mt-1 text-sm font-bold text-berry">{nameError}</p>}
          </div>
          <PartPicker label="Bentuk badan" options={CUSTOM_BASES} value={def.base} onPick={(v) => set({ base: v })} />
          <PartPicker label="Telinga / tanduk" options={CUSTOM_EARS} value={def.ears} onPick={(v) => set({ ears: v })} />
          <PartPicker label="Ekor" options={CUSTOM_TAILS} value={def.tail} onPick={(v) => set({ tail: v })} />
          <PartPicker label="Mata" options={CUSTOM_EYES} value={def.eyes} onPick={(v) => set({ eyes: v })} />
          <PartPicker label="Aksesori" options={CUSTOM_ACCESSORIES} value={def.accessory} onPick={(v) => set({ accessory: v })} />
        </section>

        <div className="sm:sticky sm:top-24">
          <div className="rounded-3xl bg-white p-3 shadow-md ring-1 ring-[var(--border)]">
            <ArtworkSvg template={template} colors={{}} strokes={[]} name="" nameFont="baloo" nameColor="#E4572E" />
            <p className="pb-1 pt-2 text-center font-display text-sm font-bold text-[var(--dim)]">
              {def.name.trim() || "Karakterku"} · {template.regions.length} bagian untuk diwarnai · hitam putih
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!def.name.trim()) {
                setNameError("Beri nama dulu untuk karaktermu — nama itu yang muncul di Kreasiku.");
                return;
              }
              onDone(def);
            }}
            className="mt-3 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-extrabold text-ink shadow-lg transition hover:bg-tang-deep"
          >
            {editing ? "Simpan & Lanjut Mewarnai" : "Mulai Mewarnai Karakter Ini"}
          </button>
          <p className="mt-2 text-center text-sm font-semibold text-[var(--dim)]">
            Pratinjaunya hitam putih seperti halaman mewarnai aslinya — warna tiap bagian kamu pilih sendiri di Studio Mewarnai.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}

/* ------------------------------ Studio ------------------------------ */

function Studio({
  project,
  setProject,
  saveState,
  onDone,
  onSave,
  onMakeReal,
  onEditCustom,
  go,
}: {
  project: WorkProject;
  setProject: (p: WorkProject) => void;
  saveState: string;
  onDone: () => void;
  onSave: () => void;
  onMakeReal: () => void;
  onEditCustom: () => void;
  go: (r: Route) => void;
}) {
  const template = templateForProject(project);
  const [nameError, setNameError] = useState("");
  const simpleTemplate = useMemo(() => simplifyTemplate(template), [template]);
  const [mode, setMode] = useState<"mudah" | "lengkap">("lengkap");
  useEffect(() => setMode("lengkap"), [template.id]);
  const editorTemplate = mode === "mudah" && simpleTemplate ? simpleTemplate : template;
  const mergeMap = simpleTemplate ? (EASY_MERGES[template.id] ?? null) : null;
  const coloredCount = template.regions.filter(
    (r) => project.colors[r.id] && project.colors[r.id] !== "#FFFFFF",
  ).length;
  const progressPct = Math.round((coloredCount / Math.max(1, template.regions.length)) * 100);
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="band-sky mt-4 flex flex-wrap items-center gap-2 rounded-[1.75rem] px-5 py-4">
        <button type="button" onClick={() => go({ view: "explore" })} className="rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5">
          ← Semua buku
        </button>
        <h1 className="font-display text-3xl font-semibold">Studio Mewarnai · {template.name}</h1>
        <span className="rounded-full bg-ink px-3 py-1.5 font-display text-xs font-extrabold text-white">Gosok bidang untuk mengisinya</span>
        {template.custom && (
          <button
            type="button"
            onClick={onEditCustom}
            className="rounded-full bg-white px-4 py-2 font-display text-sm font-extrabold text-olive-deep ring-1 ring-black/5"
          >
            Ubah Bagian Karakter
          </button>
        )}
        <span className="band-dim ml-auto text-sm font-bold" role="status">{saveState}</span>
      </div>

      {/* Indikator kemajuan: dihitung dari bagian yang benar-benar sudah diwarnai */}
      <div className="mt-4 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-sm font-semibold">Kemajuan mewarnai</p>
          <p className="text-sm font-bold text-[var(--dim)]">{coloredCount} dari {template.regions.length} bagian · {progressPct}%</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--surface-alt)] ring-1 ring-[var(--border)]" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Kemajuan mewarnai">
          <div className="h-full rounded-full bg-olive transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Personalization */}
      <section className="mt-4 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]" aria-label="Personalisasi">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="child-name" className="font-display text-sm font-bold">Nama Si Kecil</label>
            <input
              id="child-name"
              {...FIELDS.createProject.childName}
              value={project.childName}
              onChange={(e) => {
                setProject({ ...project, childName: e.target.value });
                setNameError("");
              }}
              placeholder="cth. BABA"
              className="mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-display text-lg font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
            />
            {nameError && <p className="mt-1 text-sm font-bold text-berry">{nameError}</p>}
            <label htmlFor="child-message" className="mt-3 block font-display text-sm font-bold">Keterangan Kreasi</label>
            <textarea
              id="child-message"
              {...FIELDS.createProject.message}
              value={project.message}
              onChange={(e) => setProject({ ...project, message: e.target.value })}
              placeholder="Tuliskan cerita kecil tentang karyamu..."
              rows={3}
              className="mt-1 w-full resize-none rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
            />
            <p className="mt-1 text-right text-xs font-bold text-[var(--dim)]">{project.message.length}/100</p>
          </div>
          <div>
            <p className="font-display text-sm font-bold" id="font-label">Gaya nama</p>
            <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="font-label">
              {NAME_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={project.nameFont === f.id}
                  onClick={() => setProject({ ...project, nameFont: f.id })}
                  className={`rounded-2xl px-3 py-2 text-lg ${project.nameFont === f.id ? "bg-sky-deep text-white shadow" : "bg-[var(--bg)] ring-1 ring-[var(--border)]"}`}
                  style={{ fontFamily: f.family }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-3 font-display text-sm font-bold" id="namecolor-label">Warna nama</p>
            <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="namecolor-label">
              {NAME_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  role="radio"
                  aria-checked={project.nameColor === c.hex}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => setProject({ ...project, nameColor: c.hex })}
                  className={`h-10 w-10 rounded-full ${project.nameColor === c.hex ? "ring-4 ring-ink/70" : "ring-1 ring-black/15"}`}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
            <p className="mt-3 font-display text-sm font-bold" id="namealign-label">Posisi nama</p>
            <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="namealign-label">
              {([
                { id: "left", label: "Kiri" },
                { id: "center", label: "Tengah" },
                { id: "right", label: "Kanan" },
              ] as const).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={project.nameAlign === a.id}
                  onClick={() => setProject({ ...project, nameAlign: a.id })}
                  className={`rounded-full px-4 py-2 font-display text-sm font-bold ${project.nameAlign === a.id ? "bg-olive text-white shadow" : "bg-[var(--bg)] ring-1 ring-[var(--border)]"}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {simpleTemplate && (
        <div className="mt-4 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Mode kesulitan mewarnai">
            <span className="font-display text-sm font-extrabold">Mode mewarnai:</span>
            <button
              type="button"
              aria-pressed={mode === "mudah"}
              onClick={() => setMode("mudah")}
              className={`rounded-full px-4 py-2 font-display text-sm font-extrabold ${mode === "mudah" ? "bg-olive text-white shadow" : "bg-[var(--bg)] ring-1 ring-[var(--border)]"}`}
            >
              Mode Mudah · {simpleTemplate.regions.length} bagian
            </button>
            <button
              type="button"
              aria-pressed={mode === "lengkap"}
              onClick={() => setMode("lengkap")}
              className={`rounded-full px-4 py-2 font-display text-sm font-extrabold ${mode === "lengkap" ? "bg-olive text-white shadow" : "bg-[var(--bg)] ring-1 ring-[var(--border)]"}`}
            >
              Mode Lengkap · {template.regions.length} bagian
            </button>
          </div>
          <p className="mt-2 text-sm font-semibold text-[var(--dim)]">
            {mode === "mudah"
              ? "Detail terkecil digabung ke bagian besarnya — bidang ketuknya lebih besar dan warnanya lebih sedikit. Hasil cetaknya tetap sama persis."
              : "Semua bagian tampil apa adanya, termasuk detail terkecil untuk diwarnai satu-satu."}
          </p>
        </div>
      )}

      <div className="mt-4">
        <ColoringEditor
          key={editorTemplate === template ? "full" : "simple"}
          template={editorTemplate}
          colors={project.colors}
          strokes={project.strokes}
          name={project.childName}
          message={project.message}
          nameFont={project.nameFont}
          nameColor={project.nameColor}
          nameAlign={project.nameAlign}
          onChange={(colors, strokes) => {
            let next = colors;
            if (mode === "mudah" && mergeMap) {
              // Keep merged detail regions in sync with their parent, so
              // the 3D view and the prints (which use the full template)
              // show exactly what the child colored in Mode Mudah.
              next = { ...colors };
              for (const [child, parent] of Object.entries(mergeMap)) {
                const pv = next[parent];
                if (pv !== undefined) next[child] = pv;
              }
            }
            setProject({ ...project, colors: next, strokes });
          }}
        />
      </div>

      {/* Lembar karya personal: nama dan keterangan tampil sebagai lapisan
          teks tersendiri DI BAWAH gambar utama — persis komposisi cetak
          A4-nya (gambar ±72%, nama ±10%, keterangan ±10%, merek kecil). */}
      <section className="mt-4 rounded-[1.75rem] bg-white px-6 py-6 text-center shadow-sm ring-1 ring-[var(--border)]" aria-label="Pratinjau lembar karya">
        <p
          className="font-display font-bold uppercase leading-tight"
          style={{
            fontFamily: fontFamilyOf(project.nameFont),
            color: project.nameColor,
            fontSize: `clamp(28px, ${Math.max(20, 340 / Math.max(1, project.childName.trim().length || 1))}px, 52px)`,
            textAlign: project.nameAlign,
          }}
        >
          {project.childName.trim() ? project.childName.trim().toUpperCase() : "Nama Si Kecil"}
        </p>
        <p
          className="mx-auto mt-2 max-w-md leading-relaxed"
          style={{ textAlign: project.nameAlign === "center" ? "center" : project.nameAlign }}
        >
          {project.message.trim() ? (
            <span className="font-semibold">{project.message.trim()}</span>
          ) : (
            <span className="italic text-[var(--dim)]">{template.blurb}</span>
          )}
        </p>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--dim)]">Bun &amp; Fleur Kids</p>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onSave}
          className="rounded-full bg-[var(--surface)] px-7 py-3.5 font-display text-lg font-extrabold text-olive-deep ring-2 ring-olive transition hover:bg-sage-soft"
        >
          Simpan Kreasi
        </button>
        <button
          type="button"
          onClick={() => {
            if (Object.keys(project.colors).length === 0 && project.strokes.length === 0) {
              setNameError("Warnai minimal satu bagian dulu — baru keajaibannya bekerja!");
              return;
            }
            onDone();
          }}
          className="rounded-full bg-tang px-9 py-4 font-display text-xl font-extrabold text-ink shadow-lg transition hover:scale-[1.03] hover:bg-tang-deep"
        >
          Lihat Hasilnya
        </button>
        <button
          type="button"
          onClick={() => {
            if (Object.keys(project.colors).length === 0 && project.strokes.length === 0) {
              setNameError("Warnai minimal satu bagian dulu — baru bisa dijadikan nyata!");
              return;
            }
            onMakeReal();
          }}
          className="rounded-full bg-olive px-7 py-3.5 font-display text-lg font-extrabold text-white shadow transition hover:bg-olive-deep"
        >
          Jadikan Nyata
        </button>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-[var(--dim)]">Gambarmu juga tersimpan otomatis selagi kamu mewarnai.</p>
    </div>
  );
}

/* ------------------------------ Magic (3D) ------------------------------ */

function Magic({
  project,
  brandName,
  go,
  onMakeReal,
}: {
  project: WorkProject;
  brandName: string;
  go: (r: Route) => void;
  onMakeReal: () => void;
}) {
  const template = templateForProject(project);
  const exportRef = useRef<SVGSVGElement | null>(null);
  const [reveal, setReveal] = useState(0);
  const [compare, setCompare] = useState(false);
  const [product, setProduct] = useState<"paper" | "figure">("paper");
  // Model digital bawaan adalah Bantal Kertas — bentuk yang benar-benar
  // diterima pelanggan. Mesh faset hanya tampil bila pengguna memilih
  // format lanjutan Jaring 3D secara eksplisit, atau memilih Figurine.
  const [paperModel, setPaperModel] = useState<"pillow" | "mesh">("pillow");
  useEffect(() => {
    setReveal((n) => n + 1);
  }, [project.id, template.id]);
  const showMesh = !template.custom && (product === "figure" || paperModel === "mesh");
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="band-butter mt-4 flex flex-wrap items-center gap-2 rounded-[1.75rem] px-5 py-4">
        <button type="button" onClick={() => go({ view: "studio" })} className="rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5">
          ← Lanjut mewarnai
        </button>
        <h1 className="font-display text-2xl font-semibold">{template.custom ? "Pratinjau Karakter" : "Studio Kreasi 3D"}</h1>
        {!template.custom && (
          <button
            type="button"
            aria-pressed={compare}
            onClick={() => setCompare(!compare)}
            className={`ml-auto rounded-full px-4 py-2 font-display text-sm font-bold ring-1 ring-black/5 ${compare ? "bg-ink text-white" : "bg-white text-ink"}`}
          >
            Bandingkan 2D ↔ 3D
          </button>
        )}
      </div>
      <p className="mt-2 text-center font-display text-xl font-bold">
        {project.childName.trim()
          ? <>Ta-da! {template.name} milik <span style={{ color: project.nameColor }}>{project.childName.trim().toUpperCase()}</span> hidup!</>
          : <>Ta-da! {template.name} kamu hidup!</>}
      </p>
      {template.custom ? (
        <div className="mx-auto mt-3 max-w-md">
          <div className="anim-pop-in rounded-3xl bg-sky-soft p-2 ring-1 ring-[var(--border)]">
            <PillowViewer
              template={template}
              colors={project.colors}
              strokes={project.strokes}
              name={project.childName}
              nameFontFamily={fontFamilyOf(project.nameFont)}
              nameColor={project.nameColor}
              height={360}
              revealKey={reveal}
            />
            <p className="pb-1 pt-1 text-center font-display text-sm font-bold text-[var(--dim)]">Model digital Bantal Kertas — bentuk yang akan kamu terima</p>
          </div>
          <p className="mt-3 rounded-2xl bg-butter-soft px-4 py-3 text-center font-display text-sm font-bold text-ink">
            Karakter buatan sendiri tampil sebagai model digital Bantal Kertas yang bisa diputar —
            garis bentuknya ditelusuri dari gambarmu sendiri. Jaring 3D lanjutan tidak tersedia
            untuk karakter rakitan; format cetaknya Bantal Kertas atau Standee.
          </p>
        </div>
      ) : (
      <>
      <div className={`mt-3 grid items-start gap-3 ${compare ? "sm:grid-cols-2" : ""}`}>
        {compare && (
          <div className="rounded-3xl bg-white p-3 ring-1 ring-[var(--border)]">
            <ArtworkSvg
              template={template}
              colors={project.colors}
              strokes={project.strokes}
              name={project.childName}
              nameFont={project.nameFont}
              nameColor={project.nameColor}
            />
            <p className="pb-1 pt-2 text-center font-display text-sm font-bold text-[var(--dim)]">Gambar 2D aslinya</p>
          </div>
        )}
        <div className="rounded-3xl bg-sky-soft p-2 ring-1 ring-[var(--border)]">
          {showMesh ? (
            <ModelViewer
              template={template}
              colors={project.colors}
              name={project.childName}
              nameFontFamily={fontFamilyOf(project.nameFont)}
              nameColor={project.nameColor}
              height={380}
              revealKey={reveal}
            />
          ) : (
            <PillowViewer
              template={template}
              colors={project.colors}
              strokes={project.strokes}
              name={project.childName}
              nameFontFamily={fontFamilyOf(project.nameFont)}
              nameColor={project.nameColor}
              height={380}
              revealKey={reveal}
            />
          )}
          <p className="pb-1 pt-1 text-center font-display text-sm font-bold text-[var(--dim)]">
            {product === "figure"
              ? "Model digital Figurine 3D — figurine fisiknya diproduksi & dikirim oleh tim kami"
              : showMesh
                ? "Model digital Jaring 3D (lanjutan) — dibuka menjadi jaring kertas dari mesh yang sama di Studio Cetak"
                : "Model digital Bantal Kertas — bentuk yang akan kamu terima"}
          </p>
        </div>
      </div>
      {product === "paper" && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Pilih model digital">
          <span className="font-display text-sm font-bold text-[var(--dim)]">Model digital:</span>
          <button
            type="button"
            aria-pressed={paperModel === "pillow"}
            onClick={() => setPaperModel("pillow")}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold ring-1 ring-black/5 transition ${paperModel === "pillow" ? "bg-olive text-white" : "bg-white text-ink"}`}
          >
            Bantal Kertas · yang kamu terima
          </button>
          <button
            type="button"
            aria-pressed={paperModel === "mesh"}
            onClick={() => setPaperModel("mesh")}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold ring-1 ring-black/5 transition ${paperModel === "mesh" ? "bg-olive text-white" : "bg-white text-ink"}`}
          >
            Jaring 3D · Lanjutan
          </button>
        </div>
      )}
      <p className="mt-2 text-center text-sm font-bold text-[var(--dim)]">
        {showMesh
          ? "Seret untuk memutar · cubit atau gulir untuk memperbesar · coba tampilan meledak untuk melihat setiap potongan kertas"
          : "Seret untuk memutar · cubit atau gulir untuk memperbesar · putar ke samping untuk melihat tebal tepi gussetnya, ke belakang untuk melihat gambar yang sama di sisi belakangnya"}
      </p>
      </>
      )}

      {!template.custom && (
        <section className="mt-6" aria-label="Pilih bentuk kreasi fisik">
          <h2 className="font-display text-xl font-semibold">Pilih bentuk kreasinya</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" role="group" aria-label="Bentuk kreasi fisik">
            <button
              type="button"
              aria-pressed={product === "paper"}
              onClick={() => setProduct("paper")}
              className={`rounded-[1.75rem] p-5 text-left ring-1 transition ${product === "paper" ? "bg-[var(--surface)] shadow-md ring-2 ring-olive" : "bg-[var(--surface)] ring-[var(--border)] hover:shadow"}`}
            >
              <span className="font-display text-lg font-semibold">Papercraft Kit</span>
              <span className="mt-1 block leading-relaxed text-[var(--dim)]">
                Bantal Kertas 5 potong (±10 menit) — model digitalnya persis yang kamu lihat
                di atas: kedua panel gambar anak, tepi gusset, dan alas bernama. Jaring 3D
                penuh tersedia sebagai pilihan lanjutan untuk anak besar. Pola rakitannya
                bisa diunduh dari Studio Cetak; untuk wujud jadi tanpa merakit, pesan Poster
                atau Kaos dari karya yang sama.
              </span>
              <span className="mt-2 block font-display text-sm font-semibold text-olive">Waktu rakit ±10 menit · bahan kertas tebal 160–200 gsm</span>
            </button>
            <button
              type="button"
              aria-pressed={product === "figure"}
              onClick={() => setProduct("figure")}
              className={`relative rounded-[1.75rem] p-5 text-left ring-1 transition ${product === "figure" ? "bg-olive text-white shadow-md ring-2 ring-olive-deep" : "bg-[var(--surface)] ring-[var(--border)] hover:shadow"}`}
            >
              <span className="absolute right-4 top-4 rounded-full bg-tang px-2.5 py-0.5 font-display text-xs font-semibold text-ink">Premium</span>
              <span className="font-display text-lg font-semibold">Model Figur 3D Digital</span>
              <span className={`mt-1 block leading-relaxed ${product === "figure" ? "text-[#EDF3E2]" : "text-[var(--dim)]"}`}>
                Model figur digital dari geometri karakter yang tersedia. Warna setiap bagian mengikuti pilihan anak. Pilih kartu ini untuk menjelajahi model digital 3D; figur fisik tidak tersedia dalam katalog.
              </span>
              <span className={`mt-2 block font-display text-sm font-semibold ${product === "figure" ? "text-white" : "text-olive"}`}>Hanya visualisasi digital — produk figur ini tidak dijual.</span>
            </button>
          </div>
          {product === "paper" && (
            <p className="mt-3 rounded-2xl bg-[var(--surface-alt)] px-4 py-3 font-semibold text-[var(--dim)] ring-1 ring-[var(--border)]">
              Untuk Papercraft Kit, bentuk rakitan akhirnya adalah Bantal Kertas di atas — buka Studio Cetak untuk melihat lembar pola rakitannya: panel depan, panel belakang, strip gusset, dan alas lipatnya.
            </p>
          )}
        </section>
      )}

      {/* Hidden full artwork for PNG export */}
      <div className="sr-only" aria-hidden>
        <ArtworkSvg
          svgRef={exportRef}
          template={template}
          colors={project.colors}
          strokes={project.strokes}
          name={project.childName}
          nameFont={project.nameFont}
          nameColor={project.nameColor}
        />
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onMakeReal}
          className="rounded-full bg-olive px-8 py-3.5 font-display text-lg font-extrabold text-white shadow-lg transition hover:bg-olive-deep"
        >
          Jadikan Nyata — Pesan Poster, Figurine, atau Kaos
        </button>
        <button
          type="button"
          onClick={() => go({ view: "print" })}
          className="rounded-full bg-tang px-8 py-3.5 font-display text-lg font-extrabold text-ink shadow-lg transition hover:bg-tang-deep"
        >
          Lihat Wujud Kertasnya
        </button>
        <button
          type="button"
          onClick={() =>
            downloadArtworkPng(
              exportRef.current,
              `${brandName.replace(/\s+/g, "-")}-${template.id}-artwork.png`,
            )
          }
          className="rounded-full bg-[var(--surface)] px-8 py-3.5 font-display text-lg font-extrabold shadow ring-1 ring-[var(--border)]"
        >
          Unduh gambar
        </button>
      </div>
      {project.message.trim() && (
        <p className="mt-4 text-center font-display text-lg font-bold" style={{ color: project.nameColor }}>
          “{project.message.trim()}”
        </p>
      )}
    </div>
  );
}

/* ------------------------------ Print ------------------------------ */

function PrintStudio({
  project,
  brandName,
  go,
}: {
  project: WorkProject;
  brandName: string;
  go: (r: Route) => void;
}) {
  const template = templateForProject(project);
  const [format, setFormat] = useState<"pillow" | "toy" | "standee">("pillow");
  const [inkSave, setInkSave] = useState(false);
  const net = useMemo(() => template.buildNet(), [template]);
  const pillowNet = useMemo(() => buildPillowNet(template), [template]);
  const data = {
    template,
    colors: project.colors,
    strokes: project.strokes,
    name: project.childName,
    message: project.message,
    nameColor: project.nameColor,
    brandName,
    inkSave,
  };
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="band-tang mt-4 flex flex-wrap items-center gap-2 rounded-[1.75rem] px-5 py-4">
        <button type="button" onClick={() => go({ view: "magic" })} className="rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5">
          {template.custom ? "← Kembali ke pratinjau" : "← Kembali ke 3D"}
        </button>
        <h1 className="font-display text-3xl font-semibold">Studio Cetak · {template.name}</h1>
      </div>

      {/* Ringkasan kreasi: karya final, nama personalisasi, dan cara produksinya */}
      <section className="mt-4 flex flex-wrap items-center gap-4 rounded-[1.75rem] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]" aria-label="Ringkasan kreasi">
        <div className="w-24 shrink-0 rounded-3xl bg-white p-1.5 ring-1 ring-black/5">
          <ArtworkSvg template={template} colors={project.colors} strokes={project.strokes} name={project.childName} nameFont={project.nameFont} nameColor={project.nameColor} />
        </div>
        <div className="min-w-52 flex-1">
          <p className="font-display text-lg font-semibold leading-tight">
            {project.childName.trim() ? `${template.name} milik ${project.childName.trim()}` : template.name}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--dim)]">
            Karya ini dibuat sesuai pesanan (made-to-order): warna dan nama mengikuti persis
            yang tersimpan. Pola rakitan Bantal Kertasnya bisa kamu pratinjau dan unduh
            sebagai PDF A4 di bawah ini; untuk wujud jadi yang diproduksi &amp; dikirim tim
            kami — Poster, Figurine 3D, atau Kaos — pesan dari karya yang sama lewat tombol
            Jadikan Nyata.
          </p>
          <button
            type="button"
            onClick={() => go({ view: "finish" })}
            className="mt-2 rounded-full bg-olive px-5 py-2.5 font-display text-sm font-semibold text-white transition hover:bg-olive-deep"
          >
            Jadikan Nyata — Pesan Produk Fisiknya
          </button>
        </div>
      </section>

      <p className="mt-5 font-display text-base font-semibold">Pilih tingkat kesulitan merakitnya:</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-label="Format cetak berdasarkan tingkat kesulitan">
        {([
          {
            id: "standee" as const,
            name: "Standee",
            tier: DIFFICULTY_TIERS[0]!,
            time: "±5 menit",
            age: "Semua umur, termasuk balita",
            desc: "Gunting karakternya, lipat alasnya ke bawah, langsung berdiri.",
            available: true,
          },
          {
            id: "pillow" as const,
            name: "Bantal Kertas",
            tier: DIFFICULTY_TIERS[1]!,
            time: "±10 menit",
            age: "Umur 2–6 tahun bersama orang dewasa",
            desc: "Kedua panelnya gambarmu persis, strip tepi memberi ketebalan. Hanya 5 potong.",
            available: true,
          },
          {
            id: "toy" as const,
            name: "Jaring 3D Penuh",
            tier: DIFFICULTY_TIERS[3]!,
            time: "±45–60 menit",
            age: "Anak besar & orang dewasa yang sabar",
            desc: "Papercraft 3D lengkap dari mesh pratinjau 3D — ratusan sambungan bernomor.",
            available: !template.custom,
          },
        ]).map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={format === f.id}
            disabled={!f.available}
            onClick={() => setFormat(f.id)}
            className={`rounded-3xl p-4 text-left ring-1 ring-[var(--border)] transition disabled:cursor-not-allowed disabled:opacity-50 ${
              format === f.id ? "shadow-md" : "bg-[var(--surface)] hover:shadow"
            }`}
            style={format === f.id ? { background: f.tier.soft, boxShadow: `0 0 0 2px ${f.tier.color}` } : undefined}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-extrabold">{f.name}</span>
              <span className="rounded-full px-2.5 py-1 text-xs font-extrabold text-white" style={{ background: f.tier.color }}>
                {f.tier.label}
              </span>
            </span>
            <span className="mt-1 block text-sm font-extrabold" style={{ color: f.tier.color }}>
              {f.time} · {f.age}
            </span>
            <span className="mt-1 block text-sm font-semibold text-[var(--dim)]">
              {f.available ? f.desc : "Tidak tersedia untuk karakter buatan sendiri — format ini butuh mesh 3D karakter buku."}
            </span>
          </button>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 font-display text-sm font-bold">
        <input
          type="checkbox"
          checked={inkSave}
          onChange={(e) => setInkSave(e.target.checked)}
          className="h-5 w-5 accent-[#2E7FB8]"
        />
        Warna hemat tinta
      </label>
      <p className="mt-2 font-semibold text-[var(--dim)]">
        {format === "pillow"
          ? "Bagian depan bantal adalah gambar anakmu persis — gunting mengikuti garis bentuknya, rekatkan strip tepi mengelilinginya, dan ia berdiri di alas lipatnya. Hanya 5 potong, sekitar 10 menit, dibuat untuk umur 2–6 tahun bersama orang dewasa."
          : format === "toy"
            ? "Model papercraft 3D lengkap: jaring gunting-lipat asli dengan warna persismu, lengkap dengan tab lem dan sambungan bernomor. Indah, tapi rakitnya lama — paling cocok untuk anak yang lebih besar dan orang dewasa yang sabar."
            : "Rakit paling sederhana: gunting karakternya, lipat alasnya ke bawah, dan ia berdiri sendiri. Cocok untuk tangan mungil."}
      </p>
      {template.custom && (
        <p className="mt-2 inline-block rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--dim)] ring-1 ring-[var(--border)]">
          Karakter buatan sendiri: garis potongnya ditelusuri langsung dari gambarmu saat PDF dibuat.
        </p>
      )}

      <div className="mt-4">
        {format === "pillow" ? (
          <PillowPreview
            net={pillowNet}
            template={template}
            colors={project.colors}
            strokes={project.strokes}
            name={project.childName}
            nameFont={project.nameFont}
            nameColor={project.nameColor}
          />
        ) : format === "toy" ? (
          <NetPreview net={net} template={template} colors={project.colors} name={project.childName} nameColor={project.nameColor} />
        ) : (
          <StandeePreview
            template={template}
            colors={project.colors}
            strokes={project.strokes}
            name={project.childName}
            nameFont={project.nameFont}
            nameColor={project.nameColor}
          />
        )}
      </div>

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={async () => {
            const { buildPillowPdf, buildStandeePdf, buildToyPdf, downloadBlob } = await import("./lib/pdf");
            const blob = format === "pillow" ? buildPillowPdf(data) : format === "toy" ? buildToyPdf(data) : buildStandeePdf(data);
            downloadBlob(blob, `${template.id}-${format === "pillow" ? "paper-pillow" : format === "toy" ? "paper-toy" : "standee"}.pdf`);
          }}
          className="rounded-full bg-tang px-10 py-4 font-display text-xl font-extrabold text-ink shadow-lg transition hover:bg-tang-deep"
        >
          Unduh PDF A4
        </button>
        <p className="mt-2 text-sm font-semibold text-[var(--dim)]">
          Pola yang sama persis dengan yang dipakai tim kami untuk memproduksi kit-nya:
          skala 100%, kertas tebal 160–200 gsm.
        </p>
      </div>

      <section className="mt-6 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Langkah merakit">
        <h2 className="font-display text-lg font-extrabold">Cara merakitnya</h2>
        <ol className="mt-2 list-none space-y-2">
          {(format === "pillow" ? pillowNet.steps : format === "toy" ? net.steps : [
            "Gunting mengelilingi seluruh gambar mengikuti garis tebal.",
            "Lipat pada setiap garis putus-putus; lipat alasnya menjauhi kamu, lalu ke bawah.",
            "Rekatkan flap terakhir di bawah alas sampai membentuk segitiga. Berdirikan — ta-da!",
          ]).map((s, i) => (
            <li key={i} className="flex gap-3 font-semibold text-[var(--dim)]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-butter font-display text-sm font-extrabold text-ink">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-2xl bg-butter-soft px-4 py-3 font-display font-bold text-ink">
          Orang dewasa: mohon yang menggunting, dan dampingi saat melipat dan merekatkan. Gunting dan kertas yang tajam adalah urusan orang tua.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------ Creations ------------------------------ */

function Creations({
  openProject,
  startTemplate,
  onEditCustom,
  onCustomNew,
}: {
  openProject: (p: ServerProject, view: "studio" | "magic" | "print" | "finish") => void;
  startTemplate: (id: string) => void;
  onEditCustom: (p: ServerProject) => void;
  onCustomNew: () => void;
}) {
  const queryClient = useQueryClient();
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects({ limit: 50 }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => await api.deleteProject({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
  const [confirmId, setConfirmId] = useState<number | null>(null);

  if (projects.isPending) return <p className="px-4 py-10 text-center font-display font-bold">Memuat kreasimu…</p>;
  if (projects.error) return <p className="px-4 py-10 text-center font-display font-bold">Kami tidak bisa memuat kreasimu. Tarik untuk mencoba lagi.</p>;
  const list = projects.data.projects.filter((p) => !isOrphanProject(p));
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <div className="band-butter mt-4 rounded-[2rem] px-6 py-8 sm:px-8">
        <p className="band-accent font-display text-xs font-semibold uppercase tracking-[0.22em]">Koleksi Pribadi Si Kecil</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Kreasi<span className="band-accent">ku</span></h1>
        <p className="band-dim mt-2 max-w-xl leading-relaxed">Semua gambar tersimpan ada di sini — buka lagi drafnya, putar dalam 3D, atau wujudkan jadi mainan kertas lagi. Karya yang sudah selesai ditandai “Selesai”.</p>
      </div>
      {list.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-[var(--surface)] p-8 text-center ring-1 ring-[var(--border)]">
          <p className="font-display text-xl font-extrabold">Belum ada kreasi</p>
          <p className="mt-1 font-semibold text-[var(--dim)]">Warnai karakter pertamamu dan ia akan tersimpan di sini.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => startTemplate("pb-dino")} className="rounded-full bg-tang px-6 py-3 font-display font-extrabold text-ink shadow">
              Warnai Dino
            </button>
            <button type="button" onClick={onCustomNew} className="rounded-full bg-[var(--surface)] px-6 py-3 font-display font-extrabold shadow ring-1 ring-[var(--border)]">
              Buat Karakter Sendiri
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => {
            const t = templateForProject(p);
            return (
              <article key={p.id} className="flex flex-col rounded-[1.75rem] bg-[var(--surface)] p-3 ring-1 ring-[var(--border)] transition hover:shadow-md">
                <div className="rounded-3xl bg-white p-2 ring-1 ring-black/5">
                  <ArtworkSvg template={t} colors={p.colors} strokes={p.strokes as Stroke[]} name={p.childName} nameFont={p.nameFont} nameColor={p.nameColor} />
                </div>
                <h2 className="mt-2 font-display text-base font-semibold leading-tight">
                  {p.childName.trim() ? `${t.name} milik ${p.childName.trim()}` : t.name}
                </h2>
                {t.custom && (
                  <span className="mt-1 inline-block self-start rounded-full bg-sage-soft px-2.5 py-1 text-xs font-extrabold text-olive">
                    Karakter Buatan Sendiri
                  </span>
                )}
                <p className="text-xs font-bold text-[var(--dim)]">
                  {p.status === "done" ? "Selesai · " : "Sedang dibuat · "}
                  {new Date(p.updatedAt).toLocaleDateString("id-ID", { month: "short", day: "numeric" })}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <button type="button" onClick={() => openProject(p, "studio")} className="rounded-full bg-sky-deep px-2 py-2 font-display text-xs font-extrabold text-white">Warnai</button>
                  <button type="button" onClick={() => openProject(p, "magic")} className="rounded-full bg-sage px-2 py-2 font-display text-xs font-extrabold text-white">{t.custom ? "Lihat" : "3D"}</button>
                  <button type="button" onClick={() => openProject(p, "print")} className="rounded-full bg-tang px-2 py-2 font-display text-xs font-extrabold text-ink">Cetak</button>
                </div>
                {Object.keys(p.colors).length > 0 && (
                  <button
                    type="button"
                    onClick={() => openProject(p, "finish")}
                    className="mt-1.5 rounded-full bg-olive px-2 py-2 font-display text-xs font-extrabold text-white"
                  >
                    Jadikan Nyata — Pesan Produk
                  </button>
                )}
                {t.custom && (
                  <button
                    type="button"
                    onClick={() => onEditCustom(p)}
                    className="mt-1.5 rounded-full px-2 py-1.5 font-display text-xs font-extrabold text-olive ring-1 ring-[var(--border)]"
                  >
                    Ubah Bagian Karakter
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirmId === p.id) {
                      del.mutate(p.id);
                      setConfirmId(null);
                    } else {
                      setConfirmId(p.id);
                    }
                  }}
                  className={`mt-2 rounded-full px-2 py-1.5 font-display text-xs font-bold ${confirmId === p.id ? "bg-berry text-white" : "text-[var(--dim)] ring-1 ring-[var(--border)]"}`}
                >
                  {confirmId === p.id ? "Ketuk lagi untuk menghapus" : "Hapus"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Parents ------------------------------ */

function Parents() {
  const queryClient = useQueryClient();
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects({ limit: 50 }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => await api.deleteProject({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const list = (projects.data?.projects ?? []).filter((p) => !isOrphanProject(p));
  const doneCount = list.filter((p) => p.status === "done").length;
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="band-sage mt-4 rounded-[2rem] px-6 py-8 sm:px-8">
        <p className="band-accent font-display text-xs font-semibold uppercase tracking-[0.22em]">Untuk Orang Tua</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Panduan &amp; <span className="band-accent">Dasbor Orang Tua</span></h1>
        <p className="band-dim mt-2 max-w-2xl leading-relaxed">Cara platform ini bekerja, produk fisiknya, bahan dan batasannya — plus pengelolaan proyek tersimpan. Tanpa akun, tanpa daftar — proyek tersimpan secara privat di aplikasi ini.</p>
      </div>

      <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Perpustakaan proyek">
        <h2 className="font-display text-lg font-extrabold">Perpustakaan proyek</h2>
        <p className="text-sm font-semibold text-[var(--dim)]">
          {list.length} proyek tersimpan · {doneCount} selesai. Pola rakitan dibuat baru dari warna tersimpan setiap kali kamu membuka Studio Cetak, jadi pratinjaunya selalu yang terbaru.
        </p>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {list.map((p) => {
            const t = templateForProject(p);
            return (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="font-display font-extrabold">{p.childName.trim() ? `${t.name} milik ${p.childName.trim()}` : t.name}</span>
                <span className="text-sm font-semibold text-[var(--dim)]">
                  {p.status === "done" ? "Selesai" : "Draf"} · diperbarui {new Date(p.updatedAt).toLocaleDateString("id-ID", { month: "short", day: "numeric" })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmId === p.id) {
                      del.mutate(p.id);
                      setConfirmId(null);
                    } else setConfirmId(p.id);
                  }}
                  className={`ml-auto rounded-full px-3 py-1.5 font-display text-xs font-bold ${confirmId === p.id ? "bg-berry text-white" : "ring-1 ring-[var(--border)]"}`}
                >
                  {confirmId === p.id ? "Ketuk lagi untuk menghapus" : "Hapus"}
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="py-3 font-semibold text-[var(--dim)]">Belum ada yang tersimpan.</li>}
        </ul>
      </section>




      <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Lacak pesanan">
        <h2 className="font-display text-lg font-extrabold">Lacak pesanan</h2>
        <p className="text-sm font-semibold text-[var(--dim)]">
          Masukkan kode pesanan dan nomor WhatsApp yang dipakai saat memesan. File poster
          resolusi produksi hanya terbuka di sini setelah pembayaran terverifikasi.
        </p>
        <div className="mt-3">
          <OrderTracking />
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Panduan untuk orang tua">
        <h2 className="font-display text-lg font-semibold">Panduan singkat</h2>
        <div className="mt-3 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div>
            <h3 className="font-display text-base font-semibold">Cara platform bekerja</h3>
            <p className="mt-1 leading-relaxed text-[var(--dim)]">Anak memilih karakter hitam putih, mewarnainya di Studio Mewarnai, dan memberi nama. Warna yang sama persis tampil di model 3D dan di semua hasil cetak — satu karya, satu sumber warna.</p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">Sesuai umur</h3>
            <p className="mt-1 leading-relaxed text-[var(--dim)]">Kategori 9–18 bulan berisi bidang sangat besar bergaris tebal untuk pengalaman mewarnai pertama bersama orang tua; detail bertambah bertahap sampai kategori 4–5 tahun. Anak di bawah 3 tahun selalu didampingi.</p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">Produk fisiknya</h3>
            <p className="mt-1 leading-relaxed text-[var(--dim)]">Tujuh produk fisik bisa dipesan dari karya anak: Poster, Papercraft 3D, Alas Makan, Celengan, Puzzle, Growth Chart, dan Kaos. Harga terbaru tersedia di katalog. Pola DIY gratis tetap tersedia di Studio Cetak. Kami tidak menampilkan janji waktu produksi yang belum bisa kami tepati — estimasi diberikan tim saat mengkonfirmasi pesananmu via WhatsApp.</p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">Bahan & batasan, sejujurnya</h3>
            <p className="mt-1 leading-relaxed text-[var(--dim)]">Papercraft memakai kertas tebal 160–200 gsm. Karakter buatan sendiri (termasuk hasil AI) pratinjau 3D-nya adalah model digital Bantal Kertas — bentuk yang akan diterima — dengan format cetak Bantal Kertas/Standee; tidak ada mesh atau jaring 3D untuk mereka. Gambar bebas tidak otomatis menjadi model siap cetak 3D; figurine hanya dibuat dari geometri karakter yang sudah terverifikasi.</p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">Keamanan</h3>
            <p className="mt-1 leading-relaxed text-[var(--dim)]">Figurine 3D adalah pajangan kenang-kenangan, bukan mainan bayi — jauhkan dari anak di bawah 3 tahun dan jangan dianggap aman untuk digigit. Menggunting dan mengelem selalu tugas orang dewasa untuk anak di bawah 6 tahun.</p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">Produksi & pengiriman</h3>
            <p className="mt-1 leading-relaxed text-[var(--dim)]">Setiap karya fisik bersifat made-to-order: ditinjau dulu warnanya, diproduksi, dicek kualitasnya, lalu dikemas dan dikirim. Status pesananmu nyata dan bisa dilacak di bagian Lacak Pesanan di halaman ini dengan kode pesanan + nomor WhatsApp — tahapnya: Menunggu Pembayaran → Lunas → Peninjauan Desain → Produksi → Dikirim → Selesai. Pembayaran lewat QRIS statis resmi dengan kode unik per pesanan, diverifikasi manual oleh tim sebelum produksi dimulai; kupon afiliasi tervalidasi di server dan komisinya tercatat otomatis mengikuti status pesanan.</p>
          </div>
        </div>
        <h3 className="mt-6 font-display text-base font-semibold">Sering ditanyakan</h3>
        <div className="mt-2 space-y-2">
          {[
            { q: "Apakah produknya saya cetak sendiri?", a: "Tidak. Ketujuh produk di katalog dipesan sebagai produk fisik yang diproduksi dan dikirim oleh tim kami. Pola DIY gratis di Studio Cetak tetap bisa diunduh untuk dirakit sendiri." },
            { q: "Bisakah warna anak saya berubah di hasil jadi?", a: "Tidak. Editor, pratinjau 3D, dan file cetak membaca peta warna tersimpan yang sama, jadi bagian yang diwarnai biru di layar tetap biru di kertas." },
            { q: "Bagaimana cara membayar pesanannya?", a: "Lewat QRIS statis resmi BUN AND FLEUR, PAKAIAN (NMID ID1026626210169) di halaman pembayaran pesananmu. Setiap pesanan punya kode unik Rp1–999 dari server, jadi total yang kamu transfer selalu khas (mis. Rp49.137) dan tidak berubah walau halaman dimuat ulang. Setelah transfer, tekan tombol “Saya Sudah Transfer” — pesanan masuk status Menunggu Verifikasi, BUKAN langsung lunas. Tim kami mencocokkan transfer masuk secara manual; hanya setelah cocok statusnya menjadi Terverifikasi/Lunas dan produksi dimulai. File poster resolusi produksi terkunci sampai status itu tercapai." },
            { q: "Berapa lama produksinya?", a: "Kami tidak menampilkan perkiraan yang belum bisa kami tepati. Estimasi produksi & pengiriman diberikan tim kami via WhatsApp saat mengkonfirmasi pesananmu, sebelum kamu membayar." },
            { q: "Apakah data anak saya aman?", a: "Anak tidak memasukkan email atau data kontak — hanya nama depan untuk papan nama, yang Anda kendalikan. Karya hanya tersimpan di aplikasi ini dan tidak diterbitkan ke mana pun." },
          ].map((f) => (
            <details key={f.q} className="rounded-2xl bg-[var(--surface-alt)] px-4 py-3 ring-1 ring-[var(--border)]">
              <summary className="cursor-pointer font-display font-semibold">{f.q}</summary>
              <p className="mt-1.5 leading-relaxed text-[var(--dim)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-sage-soft p-5 ring-1 ring-[var(--border)]" aria-label="Catatan keamanan dan pencetakan">
        <h2 className="font-display text-lg font-extrabold">Perlu diketahui</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 font-semibold text-[var(--dim)]">
          <li>Anak tidak pernah memasukkan alamat email atau data kontak — hanya nama depan untuk papan nama, yang kamu kendalikan. Data pemesan (nama, WhatsApp, email, alamat) hanya diisi orang tua saat checkout dan hanya dipakai untuk memproses pesanan itu.</li>
          <li>Gambar tidak pernah diterbitkan ke mana pun. Ia tersimpan di Kreasiku; salinannya hanya terlampir pada pesananmu sendiri bila kamu memesan produk fisiknya, supaya tim kami bisa memproduksinya.</li>
          <li>Papercraft Kit diproduksi pada kertas tebal 160–200 gsm supaya setiap potongannya pas dan mainannya kokoh saat dirakit.</li>
          <li>Menggunting adalah tugas orang dewasa: dampingi gunting, lipatan, dan pengeleman untuk anak di bawah 6 tahun.</li>
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------ Celebration ------------------------------ */

function Celebration({ name }: { name: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-6" role="alertdialog" aria-label="Perayaan">
      <div className="anim-pop-in relative rounded-[2rem] bg-[var(--surface)] px-10 py-10 text-center shadow-2xl">
        <p className="font-display text-4xl font-semibold">Ta-da!</p>
        <p className="mt-2 font-display text-lg font-semibold text-[var(--dim)]">
          {name.trim() ? `Gambar ${name.trim()} sedang hidup…` : "Gambarmu sedang hidup…"}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ App root ------------------------------ */

export function App() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings({}),
    staleTime: 60000,
  });
  const brandName = settings.data?.brandName ?? "Bun & Fleur Kids";
  const [route, setRoute] = useState<Route>(() => parseHashRoute() ?? { view: "home" });
  // Referral attribution + affiliate deep links arriving via the hash.
  useEffect(() => {
    captureReferral();
    const onHash = () => {
      captureReferral();
      const r = parseHashRoute() ?? (window.location.hash === "" ? { view: "home" } as const : null);
      if (r) {
        setRoute(r);
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goAffiliate = (r: Route) => {
    if (r.view === "aff-register") window.location.hash = "/affiliate/daftar";
    else if (r.view === "aff-invite") window.location.hash = `/affiliate/invite/${r.token}`;
    else if (r.view === "aff-reset") window.location.hash = `/affiliate/reset/${r.token}`;
    else if (r.view === "aff-login") window.location.hash = "/affiliate/login";
    else if (r.view === "aff-dashboard") window.location.hash = "/affiliate/dashboard";
    else if (r.view === "aff-admin") window.location.hash = "/admin";
    setRoute(r);
    window.scrollTo({ top: 0 });
  };
  const [exploreAge, setExploreAge] = useState<string>("all");
  const [project, setProjectState] = useState<WorkProject>(() => newWork("pb-dino"));
  const [saveState, setSaveState] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectRef = useRef(project);
  const activeDraft = useRef<{ id: number | null; tail: Promise<unknown> }>({ id: project.id, tail: Promise.resolve() });

  const updateWorkingCopy = (next: WorkProject) => {
    projectRef.current = next;
    setProjectState(next);
  };
  const switchDraft = (next: WorkProject) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void persist(projectRef.current).catch(() => undefined);
    }
    activeDraft.current = { id: next.id, tail: Promise.resolve() };
    updateWorkingCopy(next);
    setSaveState("");
  };
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const createMut = useMutation({
    mutationFn: async (p: WorkProject) =>
      await api.createProject({
        templateId: p.templateId,
        childName: p.childName,
        message: p.message,
        nameFont: p.nameFont,
        nameColor: p.nameColor,
        nameAlign: p.nameAlign,
        colors: p.colors,
        strokes: p.strokes,
        customDef: p.customDef,
        status: p.status,
      }),
  });
  const updateMut = useMutation({
    mutationFn: async (p: WorkProject & { id: number }) =>
      await api.updateProject({
        id: p.id,
        templateId: p.templateId,
        childName: p.childName,
        message: p.message,
        nameFont: p.nameFont,
        nameColor: p.nameColor,
        nameAlign: p.nameAlign,
        colors: p.colors,
        strokes: p.strokes,
        customDef: p.customDef,
        status: p.status,
      }),
  });

  const persist = (p: WorkProject): Promise<WorkProject> => {
    const draft = activeDraft.current;
    const task = draft.tail.catch(() => undefined).then(async () => {
      const isNew = draft.id === null;
      const res = draft.id === null
        ? await createMut.mutateAsync(p)
        : await updateMut.mutateAsync({ ...p, id: draft.id });
      const saved = toWork(res.project);
      draft.id = saved.id;
      if (activeDraft.current === draft) {
        const current = projectRef.current;
        updateWorkingCopy(current === p ? saved : { ...current, id: saved.id });
      }
      if (isNew || p.status === "done") void queryClient.invalidateQueries({ queryKey: ["projects"] });
      return saved;
    });
    draft.tail = task;
    return task;
  };

  // Autosave the edits against their original draft, including when changing artwork.
  const setProject = (p: WorkProject) => {
    updateWorkingCopy(p);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("Menyimpan…");
    const draft = activeDraft.current;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist(projectRef.current)
        .then(() => { if (activeDraft.current === draft && !saveTimer.current) setSaveState("Tersimpan ✓"); })
        .catch(() => { if (activeDraft.current === draft) setSaveState("Tidak bisa menyimpan. Coba simpan lagi."); });
    }, 900);
  };

  const go = (r: Route) => {
    const hash = r.view === "explore" ? "#/koleksi" : r.view === "parents" ? "#/orang-tua" : r.view === "creations" ? "#/kreasiku" : "";
    const path = window.location.pathname + window.location.search + hash;
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, "", path);
    setRoute(r);
    window.scrollTo({ top: 0 });
  };

  const startTemplate = (id: string) => {
    switchDraft(newWork(id));
    go({ view: "studio" });
  };

  const openProject = (p: ServerProject, view: "studio" | "magic" | "print" | "finish") => {
    const w = toWork(p);
    switchDraft(w);
    if (view === "finish") {
      setShopSel({
        product: "poster",
        tshirtColor: "Cream",
        tshirtSize: "",
        childName: w.childName,
      });
      setLastOrder(null);
    }
    go({ view });
  };

  /* -------- Buat Karakter Sendiri session -------- */
  const [builderKey, setBuilderKey] = useState(0);
  const [builderInit, setBuilderInit] = useState<{ def: CustomDef; editing: WorkProject | null }>({
    def: DEFAULT_CUSTOM_DEF,
    editing: null,
  });

  const startCustomNew = () => {
    setBuilderInit({ def: DEFAULT_CUSTOM_DEF, editing: null });
    setBuilderKey((k) => k + 1);
    go({ view: "custom" });
  };

  const editCustomWork = (w: WorkProject) => {
    setBuilderInit({ def: parseCustomDef(w.customDef) ?? DEFAULT_CUSTOM_DEF, editing: w });
    setBuilderKey((k) => k + 1);
    go({ view: "custom" });
  };

  const handleBuilderDone = (def: CustomDef, colors?: Record<string, string>) => {
    const json = JSON.stringify(def);
    if (builderInit.editing) {
      // Same project, new part combination; region ids are stable, so the
      // child's colors carry over. When the AI regenerated the character,
      // its suggested colors replace the old scheme.
      setProject({
        ...builderInit.editing,
        customDef: json,
        ...(colors ? { colors } : {}),
      });
    } else {
      const w = newWork("custom", json);
      if (colors) w.colors = colors;
      switchDraft(w);
    }
    go({ view: "studio" });
  };

  const persistNow = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    setSaveState("Menyimpan…");
    try {
      await persist(projectRef.current);
      setSaveState("Tersimpan ✓");
    } catch {
      setSaveState("Tidak bisa menyimpan — coba lagi sebentar ya");
    }
  };

  /* -------- Toko: Free to Color, Pay to Create -------- */
  const [shopSel, setShopSel] = useState<ShopSelection>({
    product: "poster",
    tshirtColor: "Cream",
    tshirtSize: "",
    childName: "",
  });
  const [lastOrder, setLastOrder] = useState<OrderOut | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartProject, setCartProject] = useState<number | null>(null);
  const [cartName, setCartName] = useState("");
  const cartCheckoutId = useRef<string | null>(null);
  const cartLines = cartProject === project.id ? cart : [];
  const cartCount = cartLines.reduce((n, line) => n + line.quantity, 0);
  const changeCart = (lines: CartLine[]) => {
    setCart(lines);
    cartCheckoutId.current = null;
  };
  const addToCart = () => {
    const pid = projectRef.current.id;
    if (pid == null) return;
    const current = cartProject === pid ? cart : [];
    const line = { product: shopSel.product, tshirtColor: shopSel.product === "tshirt" ? shopSel.tshirtColor : "",
      tshirtSize: shopSel.product === "tshirt" ? shopSel.tshirtSize : "", quantity: 1 };
    const same = current.findIndex(x => x.product === line.product && x.tshirtColor === line.tshirtColor && x.tshirtSize === line.tshirtSize);
    if ((same >= 0 && current[same]!.quantity >= 20) || (same < 0 && current.length >= 20) || current.reduce((n,x) => n+x.quantity,0) >= 140) {
      window.alert("Keranjang sudah mencapai batas jumlah pesanan.");
      return;
    }
    if (!current.length) setCartName(shopSel.childName.trim());
    setCartProject(pid);
    changeCart(same < 0 ? [...current,line] : current.map((x,i) => i === same ? {...x, quantity:x.quantity+1} : x));
    go({ view: "finish" });
  };

  // "Jadikan Nyata" / Finish Coloring: tandai karya selesai, pastikan
  // tersimpan (pesanan membaca snapshot dari baris proyek di server),
  // lalu buka halaman masterpiece dengan empat pilihan produk.
  const handleFinish = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const p = { ...projectRef.current, status: "done" as const };
    updateWorkingCopy(p);
    let saved: WorkProject;
    try {
      saved = await persist(p);
    } catch {
      setSaveState("Karya belum tersimpan. Coba simpan lagi sebelum memesan.");
      return;
    }
    setShopSel({
      product: "poster",
      tshirtColor: "Cream",
      tshirtSize: "",
      childName: saved.childName,
    });
    setLastOrder(null);
    go({ view: "finish" });
  };

  const startCustomize = (product: ProductId) => {
    setShopSel((s) => ({ ...s, product, childName: cartLines.length ? cartName : projectRef.current.childName || s.childName }));
    go({ view: "customize" });
  };

  const handleDone = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const p = { ...projectRef.current, status: "done" as const };
    updateWorkingCopy(p);
    try {
      await persist(p);
    } catch {
      // Even if the save hiccups, the child still gets their 3D moment;
      // the local copy carries the exact colors.
      updateWorkingCopy(p);
    }
    setCelebrating(true);
    setTimeout(() => {
      setCelebrating(false);
      go({ view: "magic" });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] font-body text-[var(--text)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:rounded-xl focus:bg-white focus:p-3">Lewati ke konten utama</a>
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <Header brandName={brandName} route={route} go={go} onCustom={startCustomNew} />
      <main id="main-content" style={route.view === "studio" ? { overflowAnchor: "none" } : undefined}>
        <Suspense fallback={<p role="status" className="p-6 text-center">Memuat halaman…</p>}>
        {route.view === "home" && (
          <Home
            brandName={brandName}
            catalogPrices={settings.data?.catalogPrices ?? {}}
            startTemplate={startTemplate}
            go={go}
            onCustom={startCustomNew}
            onAge={(bandId) => {
              setExploreAge(bandId);
              go({ view: "explore" });
            }}
          />
        )}
        {route.view === "explore" && <Explore key={exploreAge} initialAge={exploreAge} startTemplate={startTemplate} />}
        {route.view === "custom" && (
          <CustomBuilder
            key={builderKey}
            initial={builderInit.def}
            editing={builderInit.editing != null}
            onDone={handleBuilderDone}
            go={go}
          />
        )}
        {route.view === "studio" && (
          <Studio
            project={project}
            setProject={setProject}
            saveState={saveState}
            onDone={() => void handleDone()}
            onSave={() => void persistNow()}
            onMakeReal={() => void handleFinish()}
            onEditCustom={() => editCustomWork(projectRef.current)}
            go={go}
          />
        )}
        {route.view === "magic" && (
          <Magic project={project} brandName={brandName} go={go} onMakeReal={() => void handleFinish()} />
        )}
        {route.view === "finish" && (
          <Masterpiece
            project={project}
            onBack={() => go({ view: "studio" })}
            onCustomize={startCustomize}
            cartCount={cartCount}
            onCart={() => go({ view: "checkout" })}
            onMagic={() => go({ view: "magic" })}
          />
        )}
        {route.view === "customize" && (
          <Customize
            project={project}
            selection={shopSel}
            setSelection={setShopSel}
            onBack={() => go({ view: "finish" })}
            onAddToCart={addToCart}
            nameLocked={cartCount > 0}
            cartCount={cartCount}
            onCart={() => go({ view: "checkout" })}
          />
        )}
        {route.view === "checkout" && (
          <Checkout
            project={project}
            cart={cartLines}
            childName={cartName}
            changeCart={changeCart}
            checkoutId={cartCheckoutId}
            onBack={() => go({ view: "finish" })}
            onPlaced={(o) => {
              changeCart([]);
              setLastOrder(o);
              go({ view: "ordered" });
            }}
          />
        )}
        {route.view === "ordered" &&
          (lastOrder ? (
            <OrderConfirmation
              order={lastOrder}
              onCreations={() => go({ view: "creations" })}
              onHome={() => go({ view: "home" })}
            />
          ) : (
            <div className="mx-auto max-w-xl px-4 py-16 text-center">
              <p className="font-display text-xl font-semibold">Belum ada pesanan yang baru dibuat di sesi ini.</p>
              <p className="mt-2 font-semibold text-[var(--dim)]">
                Lacak pesanan yang sudah ada di halaman Orang Tua → Lacak Pesanan, dengan kode pesanan + nomor WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => go({ view: "parents" })}
                className="mt-5 rounded-full bg-olive px-6 py-3 font-display text-base font-semibold text-white"
              >
                Ke Lacak Pesanan
              </button>
            </div>
          ))}
        {route.view === "print" && <PrintStudio project={project} brandName={brandName} go={go} />}
        {route.view === "creations" && (
          <Creations
            openProject={openProject}
            startTemplate={startTemplate}
            onEditCustom={(p) => editCustomWork(toWork(p))}
            onCustomNew={startCustomNew}
          />
        )}
        {route.view === "parents" && <Parents />}
        {route.view === "aff-register" && <AffiliateRegistrationPage />}
        {route.view === "aff-invite" && (
          <AffiliateInvitePage
            token={route.token}
            goDashboard={() => goAffiliate({ view: "aff-dashboard" })}
            goLogin={() => goAffiliate({ view: "aff-login" })}
          />
        )}
        {route.view === "aff-login" && (
          <AffiliateLoginPage
            goDashboard={() => goAffiliate({ view: "aff-dashboard" })}
            goRegister={() => goAffiliate({ view: "aff-register" })}
          />
        )}
        {route.view === "aff-dashboard" && (
          <AffiliateDashboard goLogin={() => goAffiliate({ view: "aff-login" })} goHome={() => go({ view: "home" })} />
        )}
        {route.view === "aff-reset" && (
          <AffiliateResetPage token={route.token} goDashboard={() => goAffiliate({ view: "aff-dashboard" })} />
        )}
        {route.view === "aff-admin" && <AdminGate><AdminCenter brandName={brandName} /></AdminGate>}
        </Suspense>
      </main>
      <footer className="bg-[#F1EBDD] px-4 pb-24 pt-10 text-center text-sm font-semibold sm:pb-10">
        <img src={logoUrl} alt="" className="mx-auto h-12 w-12 rounded-2xl object-cover ring-1 ring-black/10" />
        <p className="mt-3">{brandName} · Warnai → Personalisasi → 3D → Cetak → Rakit</p>
        <p className="mt-1 text-[var(--dim)]">Orang dewasa, mohon dampingi saat menggunting &amp; melipat.</p>
        <p className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2">
          <button type="button" onClick={() => goAffiliate({ view: "aff-register" })} className="font-display font-bold text-olive-deep underline">
            Daftar KOL &amp; Affiliate
          </button>
          <button type="button" onClick={() => goAffiliate({ view: "aff-login" })} className="font-display font-bold text-sky-deep underline">
            Masuk Dasbor Mitra
          </button>
        </p>
      </footer>
      <MobileTabBar route={route} go={go} onCustom={startCustomNew} />
      {celebrating && <Celebration name={project.childName} />}
    </div>
  );
}
