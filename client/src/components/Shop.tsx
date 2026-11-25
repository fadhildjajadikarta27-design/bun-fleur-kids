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
import { api, type ApiResponse } from "../api";
import { ACTIVE_PRODUCT_IDS, PRODUCT_DEFAULT_PRICES, formatIDR, PRODUCT_META, type ProductId } from "../lib/shop";
import { FIELDS } from "../fields";
import { NAME_FONTS, type TemplateDef } from "../lib/model";
import { getTemplate } from "../lib/registry";
import { buildCustomTemplate, parseCustomDef } from "../lib/custom";
import { buildPillowPdf, downloadBlob } from "../lib/pdf";
import { papercraftSampleUrl } from "../papercraft-sample";
import { logoUrl } from "../assets-inline";
import { ArtworkSvg, type Stroke } from "./ColoringEditor";
import { ModelViewer } from "./ModelViewer";
import { PillowViewer } from "./PillowViewer";
import { officialQrisUrl } from "../official-qris";
import { bestBundle } from "../../../server/src/bundles";
import { BACKGROUNDS, backgroundUrl } from "../../../server/src/backgrounds";

export type OrderOut = ApiResponse<typeof api, "listOrders">["orders"][number];
function linesOf(order: OrderOut): OrderOut["items"] {
  return order.items?.length ? order.items : [{productType:order.productType, variant:order.variant, quantity:order.quantity, unitPrice:Math.round(order.productPrice/Math.max(1,order.quantity)), gross:order.productPrice, discount:order.discountAmount}];
}
function orderTitle(order: OrderOut) {
  return linesOf(order).length > 1 ? "Pesanan beberapa produk" : PRODUCT_META[order.productType].title;
}
function includesProduct(order: OrderOut, id: ProductId) { return linesOf(order).some(line=>line.productType===id); }
function OrderedItems({ order }: { order: OrderOut }) {
  return <ul className="my-3 space-y-2 text-sm font-semibold" aria-label="Daftar barang pesanan">
    {linesOf(order).map((item,i) => <li key={i} className="flex justify-between gap-2 rounded-xl bg-[var(--surface-alt)] p-2">
      <div><p>{PRODUCT_META[item.productType].title} × {item.quantity}</p><p className="text-xs text-[var(--dim)]">{item.variant}</p>{item.discount > 0 && <p className="text-xs text-olive-deep">Diskon {formatIDR(item.discount)}</p>}</div>
      <span>{formatIDR(item.gross-item.discount)}</span>
    </li>)}
  </ul>;
}

export interface ShopProject {
  backgroundId?: string;
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

export interface CartLine { product: ProductId; tshirtColor: string; tshirtSize: string; quantity: number }

export interface ShopSelection {
  backgroundId?: string;
  product: ProductId;
  tshirtColor: string;
  tshirtSize: string;
  childName: string;
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



const FALLBACK_CONFIG: ApiResponse<typeof api, "getShopConfig"> = {
  products: ACTIVE_PRODUCT_IDS.map((id) => ({ id, basePrice: PRODUCT_DEFAULT_PRICES[id], priceLabel: "fixed" as const })),
  tshirtColors: ["Cream", "Mustard", "Terracotta", "Sage Green", "Brown"],
  tshirtSizes: ["2–3 tahun", "4–5 tahun", "6–7 tahun", "8–9 tahun", "10–12 tahun"],
  bundles: [],
  shippingPolicy: { freeFrom: 100000, flatRate: 10000 },
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

export function useShopConfig() {
  const q = useQuery({ queryKey: ["shopConfig"], queryFn: () => api.getShopConfig({}), staleTime: 60000 });
  return q.data ?? FALLBACK_CONFIG;
}

function priceLine(cfg: ApiResponse<typeof api, "getShopConfig">, id: ProductId): string {
  const p = cfg.products.find((x) => x.id === id);
  return p?.priceLabel === "from" ? `Mulai ${formatIDR(p.basePrice)}` : formatIDR(p?.basePrice ?? PRODUCT_DEFAULT_PRICES[id]);
}

function basePrice(cfg: ApiResponse<typeof api, "getShopConfig">, id: ProductId): number {
  return cfg.products.find((x) => x.id === id)?.basePrice ?? PRODUCT_DEFAULT_PRICES[id];
}

/* ------------------------------ Previews ------------------------------ */

export function PosterPreview({ project, name, large = false }: { project: ShopProject; name: string; large?: boolean }) {
  return <div className={`mx-auto w-full ${large ? "max-w-sm" : "max-w-[250px]"}`}>
    <div role="img" aria-label="Pratinjau poster dengan karya dan nama anak" className="rounded-xl bg-[#E7DCCB] p-3">
      <div className="relative flex aspect-[2/3] flex-col overflow-hidden bg-[#FCF3DE] shadow-md">
        <ProductDecor />
        <img src={logoUrl} alt="Bun & Fleur Kids" className="absolute left-[7%] top-[5%] w-[28%] object-contain" />
        <div className="absolute inset-x-[7%] top-[27%] bottom-[9%] flex items-center justify-center">
          <div className="w-full"><PersonalArtwork project={project} name={name} /></div>
        </div>
      </div>
    </div>
    <MockupCaption>Poster dengan karakter, warna, coretan, dan nama pilihan anak</MockupCaption>
  </div>;
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

const FABRIC_LABELS: Record<string, string> = {
  Cream: "Krem", Mustard: "Kuning mustard", Terracotta: "Terakota", "Sage Green": "Hijau sage", Brown: "Cokelat",
};
export function TshirtPreview({ project, name, fabric, large = false }: { project: ShopProject; name: string; fabric: string; large?: boolean }) {
  const hex = TSHIRT_FABRIC_HEX[fabric] ?? "#F1E6CE";
  const label = FABRIC_LABELS[fabric] ?? fabric;
  const outline = "M95 26 C108 42 132 42 145 26 L188 44 L218 92 L180 110 L180 214 Q180 221 173 221 L67 221 Q60 221 60 214 L60 110 L22 92 L52 44 Z";
  return <div className={`mx-auto w-full ${large ? "max-w-lg" : "max-w-sm"}`}>
    <div role="img" aria-label={`Kaos ${label}, tampak depan dan belakang dengan karya pribadi`} className="grid grid-cols-2 gap-2 rounded-3xl bg-[#F5EBDD] p-2">
      {[false, true].map(back => <div key={String(back)} className="min-w-0">
        <div className="relative aspect-square">
          <svg viewBox="0 0 240 240" className="h-auto w-full drop-shadow-md" aria-hidden="true">
            <path d={outline} fill={hex} stroke="#756451" strokeWidth="2" strokeLinejoin="round" />
            <path d={back ? "M95 26 Q120 44 145 26 Q120 35 95 26Z" : "M95 26 C108 42 132 42 145 26 C136 34 104 34 95 26Z"} fill="#3B2A2220" />
            <path d="M65 208H175" stroke="#756451" strokeOpacity=".4" fill="none" />
          </svg>
          {back ? <img src={logoUrl} alt="Logo Bun & Fleur Kids" className="absolute left-1/2 top-[21%] w-[17%] -translate-x-1/2 object-contain" /> :
            <div className="absolute left-1/2 top-[32%] w-[44%] -translate-x-1/2">
              <div className="relative"><PersonalArtwork project={project} name={name} showLabel={false} /></div>
              {name.trim() && <p className="break-words text-center font-bold leading-tight" style={{fontFamily: fontFamilyOf(project.nameFont), color: project.nameColor, fontSize: large ? 12 : 9}}>{name.toUpperCase()}</p>}
              {project.message.trim() && <p className="break-words text-center text-[8px] font-bold" style={{color: project.nameColor}}>{project.message}</p>}
            </div>}
        </div>
        <p className="text-center text-xs font-bold text-olive-deep">{back ? "Belakang" : "Depan"}</p>
      </div>)}
    </div>
    <MockupCaption>{`Kaos ${label} dengan karya anak di depan dan logo kecil di belakang`}</MockupCaption>
  </div>;
}

export function PapercraftPreview({ project, name, large = false }: { project: ShopProject; name: string; large?: boolean }) {
  return <div className={`mx-auto w-full ${large ? "max-w-lg" : "max-w-sm"}`}>
    <div role="img" aria-label="Simulasi kit papercraft dengan panel depan, panel belakang, strip sambungan, dan hasil rakitan karya anak" className="rounded-3xl bg-[#E7D5BA] p-3">
      <div className="grid grid-cols-2 gap-3">
        {["Panel depan", "Panel belakang"].map((label, i) => <div key={label} className={`bg-white p-2 shadow-md ${i ? "rotate-2" : "-rotate-2"}`}>
          <div className="border border-dashed border-[#B5A48C] p-1">
            <PersonalArtwork project={project} name={name} />
          </div>
          <p className="mt-1 text-center text-[9px] font-bold text-[#665944]">{label} · gunting &amp; lipat</p>
        </div>)}
      </div>
      <div className="mx-auto mt-3 w-[80%] border border-dashed border-[#9AA56D] bg-[#FDFBF5] p-1 text-center text-[9px] font-bold text-olive-deep">Strip sambungan · lipat &amp; rekatkan</div>
      <div className="relative mx-auto mt-4 flex w-[64%] flex-col items-center">
        <div className="relative w-[85%] rounded-md bg-[#FDFBF5] p-1 shadow-[6px_5px_0_#ADB78D,8px_8px_10px_#82765F44]">
          <PersonalArtwork project={project} name="" showLabel={false} />
        </div>
        {(name.trim() || project.message.trim()) && <div className="w-full rounded-b-md border border-[#89965A] bg-[#B7C583] px-2 py-2 text-center">
          <p className="break-words font-extrabold" style={{fontFamily:fontFamilyOf(project.nameFont), color:project.nameColor, fontSize:large ? 17 : 11}}>{name.trim().toUpperCase()}</p>
          {project.message.trim() && <p className="break-words text-[9px] font-bold">{project.message}</p>}
        </div>}
        <p className="mt-1 text-xs font-bold text-[#665944]">Ilustrasi rakitan berdiri</p>
      </div>
    </div>
    <MockupCaption>Kit papercraft dari karya anak; pola produksi mengikuti geometri aslinya</MockupCaption>
  </div>;
}

/** Only public catalog uses example photos, never a customer's product preview.
 * If a new photo has not been installed yet, the example SVG mockup remains visible. */
const CATALOG_PHOTOS: Partial<Record<ProductId, string>> = {
  lunchbox: '/products/lunchbox.png', tumbler: '/products/tumbler.png',
  nightlamp: '/products/nightlamp.png', wallclock: '/products/wallclock.png', namestickers: '/products/namestickers.png', rewardchart: '/products/rewardchart.png', kidswatch: '/products/kidswatch.png',
  tshirt: "/products/kaos.webp", poster: "/products/poster.webp", papercraft: "/products/papercraft.webp",
  celengan: "/products/celengan.webp", puzzle: "/products/puzzle.webp", placemat: "/products/placemat.webp", growthchart: "/products/growthchart.webp",
};
export function CatalogProductPreview({ product, project }: { product: ProductId; project: ShopProject }) {
  const [failures, setFailures] = useState(0);
  const src = failures === 0 ? CATALOG_PHOTOS[product] : failures === 1 && product === "papercraft" ? papercraftSampleUrl : undefined;
  return src ? <figure>
    <img src={src} alt={`Contoh produk ${PRODUCT_META[product].title}`} loading="lazy" decoding="async" onError={() => setFailures(n=>n+1)} className="mx-auto aspect-square w-full rounded-2xl object-contain" />
    <figcaption className="mt-2 text-center text-xs font-semibold text-[var(--dim)]">Foto contoh produk; desain pesanan mengikuti hasil mewarnai anak.</figcaption>
  </figure> : <ProductPreview product={product} project={project} name={project.childName} fabric="Cream" />;
}

/** Digital product mockups inspired by the sample photos.
 * The artwork is rendered directly from the actual project, never regenerated.
 * Product decorations stay separate from the saved printable source artwork. */
function PersonalArtwork({ project, name, showLabel = true }: { project: ShopProject; name: string; showLabel?: boolean }) {
  return <ArtworkSvg template={templateForSnapshot(project)} colors={project.colors}
    strokes={project.strokes} name={name} message={project.message}
    nameFont={project.nameFont} nameColor={project.nameColor}
    nameAlign={project.nameAlign} showLabel={showLabel} backgroundId={project.backgroundId} />;
}

function ProductDecor() {
  return <svg aria-hidden="true" viewBox="0 0 320 240" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
    <path d="M0 240V193Q25 181 44 202Q67 170 89 205Q112 204 126 240Z" fill="#A6BC52" />
    <path d="M225 240Q225 207 250 212Q268 188 290 212Q308 201 320 218V240Z" fill="#80C3E5" />
    <path d="M274 240Q278 220 296 220Q304 202 320 208V240Z" fill="#FDB83B" />
    <path d="M17 42Q10 31 26 27Q31 13 47 20Q55 10 67 24Q87 21 89 37Q89 46 70 46H34Q22 47 17 42Z" fill="#80C3E5" />
    <g stroke="#F8BE35" strokeWidth="3" strokeLinecap="round">
      <circle cx="285" cy="36" r="12" fill="#F8BE35" />
      {Array.from({length: 8}, (_, i) => <line key={i} x1={285 + 17 * Math.cos(i * Math.PI / 4)} y1={36 + 17 * Math.sin(i * Math.PI / 4)} x2={285 + 23 * Math.cos(i * Math.PI / 4)} y2={36 + 23 * Math.sin(i * Math.PI / 4)} />)}
    </g>
  </svg>;
}

function MockupCaption({ children }: { children: string }) {
  return <p className="mt-2 text-center text-xs font-semibold leading-relaxed text-[var(--dim)]">{children} · simulasi digital, bukan foto hasil cetak.</p>;
}

export function CelenganPreview({ project, name, large = false }: { project: ShopProject; name: string; large?: boolean }) {
  return <div className={`mx-auto w-full ${large ? "max-w-md" : "max-w-sm"}`}>
    <div role="img" aria-label="Mockup celengan depan dan belakang dengan karya pribadi"
      className="flex items-end justify-center gap-3 rounded-3xl bg-[#EAF4F8] px-4 py-7">
      {[false, true].map((back) => <div key={String(back)} className={`relative w-[45%] max-w-[154px] ${back ? "mb-5" : ""}`}>
        <div className="absolute -top-2 z-20 flex h-5 w-full items-center justify-center rounded-[50%] border border-[#9A9B96] bg-gradient-to-b from-white via-[#C8CBC8] to-[#92958E] shadow-sm">
          <div className="h-1 w-[40%] rounded-full bg-[#302D29]" />
        </div>
        <div className="relative flex aspect-[0.66] items-center justify-center overflow-hidden rounded-b-[14%] border-x border-[#D5CAB7] bg-[#FCF3DE] shadow-lg">
          <ProductDecor />
          {back ? <img src={logoUrl} alt="Bun & Fleur Kids" className="relative z-10 w-[68%] rounded-sm object-contain" /> :
            <div className="relative z-10 w-[87%]"><PersonalArtwork project={project} name={name} /></div>}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10" />
        </div>
        <div className="relative -mt-2 h-3 rounded-[50%] border-b border-[#A2A39C] bg-gradient-to-b from-[#E8E8E3] to-[#9CA29D]" />
        <p className="mt-2 text-center text-[11px] font-bold text-olive-deep">{back ? "Belakang" : "Depan"}</p>
      </div>)}
    </div>
    <MockupCaption>Celengan dengan gambar, warna, dan nama dari karya anak</MockupCaption>
  </div>;
}

function FlatProductPreview({ product, project, name, large }: { product: "puzzle" | "placemat"; project: ShopProject; name: string; large: boolean }) {
  const puzzle = product === "puzzle";
  return <div className={`mx-auto w-full ${large ? "max-w-md" : "max-w-sm"}`}>
    <div className="rounded-3xl bg-[#EBDCC5] p-4 sm:p-5">
      <div role="img" aria-label={puzzle ? "Mockup puzzle dari karya anak" : "Mockup alas makan dari karya anak"}
        className={`relative mx-auto flex items-center justify-center overflow-hidden bg-[#FCF3DE] shadow-md ${puzzle ? "aspect-square rounded-[12%] border-b-[5px] border-[#BBA382]" : "aspect-[3/2] rounded-[10%] border-2 border-[#E4D3BA]"}`}>
        <ProductDecor />
        {!puzzle && <div aria-hidden="true" className="pointer-events-none absolute inset-[3%] rounded-[8%] border border-dashed border-[#DCCCB4]" />}
        <img src={logoUrl} alt="Bun & Fleur Kids" className="absolute left-1/2 top-[5%] z-10 w-[20%] -translate-x-1/2 rounded-sm object-contain" />
        <div className={`relative z-10 mt-[10%] ${puzzle ? "w-[76%]" : "w-[56%]"}`}><PersonalArtwork project={project} name={name} /></div>
        {puzzle && <svg aria-hidden="true" viewBox="0 0 300 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-20 h-full w-full" fill="none" stroke="#574B38" strokeOpacity=".48" strokeWidth="1.6">
          <path d="M100 0V28c-26-13-26 29 0 16V100h28c-13-26 29-26 16 0h56V42c26 13 26-29 0-16V0 M100 100v30c26-13 26 29 0 16v54h28c-13 26 29 26 16 0h56v-29c-26 13-26-29 0-16v-55 M100 200v34c-26-13-26 29 0 16v50 M200 200v34c26-13 26 29 0 16v50 M0 100h29c-13-26 29-26 16 0h55 M200 100h28c-13 26 29 26 16 0h56 M0 200h29c13 26 29 26 16 0h55 M200 200h30c-13-26 29-26 16 0h54" />
        </svg>}
      </div>
    </div>
    <MockupCaption>{puzzle ? "Puzzle personalisasi dari karya anak" : "Alas makan personalisasi dari karya anak"}</MockupCaption>
  </div>;
}

function GrowthChartPreview({ project, name, large }: { project: ShopProject; name: string; large: boolean }) {
  const chartName = name.trim();
  return <div className={`mx-auto w-full ${large ? "max-w-md" : "max-w-sm"}`}>
    <div className="flex justify-center rounded-3xl bg-[#F2EAE0] p-4">
      <div role="img" aria-label="Mockup growth chart tempel dengan karya anak dan skala ilustrasi 50 sampai 160 sentimeter"
        className={`relative aspect-[1/3] w-full overflow-hidden rounded-xl bg-[#FCF3DE] shadow-md ${large ? "max-w-[175px]" : "max-w-[116px]"}`}>
        <ProductDecor />
        <img src={logoUrl} alt="Bun & Fleur Kids" className="absolute left-[9%] top-[4%] w-[63%] rounded-sm object-contain" />
        <div className="absolute left-[4%] top-[22%] w-[65%]">
          <PersonalArtwork project={project} name="" showLabel={false} />
        </div>
        <div className="absolute left-[5%] top-[48%] w-[65%] text-center">
          {chartName && <p className="break-words rounded-md bg-white/80 px-1 py-1 font-extrabold leading-tight" style={{ fontFamily: fontFamilyOf(project.nameFont), color: project.nameColor, fontSize: large ? 18 : 12 }}>{chartName.toUpperCase()}</p>}
          {project.message && <p className="mt-1 break-words text-[9px] font-bold text-olive-deep">{project.message}</p>}
        </div>
        <div className="absolute bottom-[9%] left-[4%] w-[65%] -scale-x-100">
          <PersonalArtwork project={project} name="" showLabel={false} />
        </div>
        <div aria-hidden="true" className="absolute bottom-[7%] right-0 top-[15%] w-[30%] text-[#486126]">
          {Array.from({length: 23}, (_, i) => {
            const cm = 160 - i * 5;
            return <div key={cm} className="absolute right-0 flex w-full -translate-y-1/2 items-center justify-end gap-1" style={{ top: `${i / 22 * 100}%` }}>
              {cm % 10 === 0 && <span className="text-[9px] font-extrabold">{cm}</span>}
              <span className={`h-px bg-current ${cm % 10 === 0 ? "w-[43%]" : "w-[22%]"}`} />
            </div>;
          })}
        </div>
      </div>
    </div>
    <MockupCaption>Growth chart tempel; skala pada mockup hanya ilustrasi ukuran</MockupCaption>
  </div>;
}

function NewPersonalizedPreview({product,project,name,large}:{product:"rewardchart"|"namestickers"|"wallclock"|"nightlamp"|"kidswatch"|"lunchbox"|"tumbler";project:ShopProject;name:string;large:boolean}){
 const label=name.trim();
 const art=(flip=false)=><div className={flip?"-scale-x-100":""}><PersonalArtwork project={project} name="" showLabel={false}/></div>;
 const title=label?<p className="relative z-10 mx-auto max-w-full break-words rounded-full border border-[#89965A] bg-[#FFF8E8] px-2 py-1 text-center font-extrabold leading-tight" style={{color:project.nameColor,fontFamily:fontFamilyOf(project.nameFont),fontSize:large?16:10}}>{label}</p>:null;
 const logo=<img src={logoUrl} alt="Bun & Fleur Kids" className="relative z-10 mx-auto w-[25%] object-contain"/>;
 const habits=["Bangun tepat waktu","Sikat gigi","Berpakaian sendiri","Makan dengan baik","Belajar / bermain","Menolong orang lain"];
 return <div className={`mx-auto w-full ${large?"max-w-lg":"max-w-sm"}`}>
 <div className="rounded-3xl bg-[#F1E5D4] p-3">
 {product==="lunchbox"&&<div role="img" aria-label="Lunchbox personalisasi" className="relative mx-auto aspect-[4/3] w-[94%] rounded-[18%] border-[9px] border-[#859951] bg-[#B9C88B] p-3 shadow-lg"><div className="absolute -left-3 top-[39%] h-[22%] w-4 rounded-md bg-[#859951]"/><div className="absolute -right-3 top-[39%] h-[22%] w-4 rounded-md bg-[#859951]"/><div className="flex h-full flex-col items-center justify-center overflow-hidden rounded-[14%] border-2 border-[#E0E6BC] bg-[#FFF7E6] px-3 py-2">{logo}<div className="min-h-0 w-[76%] flex-1 overflow-hidden">{art()}</div>{title}</div></div>}
 {product==="tumbler"&&<div role="img" aria-label="Tumbler personalisasi" className="mx-auto w-[54%]"><div className="mx-auto h-8 w-[72%] rounded-t-full border-4 border-[#859951] bg-[#B9C88B]"/><div className="h-9 rounded-t-2xl border-b-4 border-[#70853D] bg-[#9AAC65]"/><div className="relative flex aspect-[0.53] flex-col items-center justify-center overflow-hidden rounded-b-[20%] border-x-2 border-[#D8CBAF] bg-gradient-to-r from-[#E7DCC5] via-[#FFF8E9] to-[#E7DCC5] p-3 shadow-lg">{logo}<div className="my-3 w-full">{art()}</div>{title}</div></div>}
 {product==="nightlamp"&&<div className="mx-auto w-[80%]"><div className="relative overflow-hidden rounded-t-3xl border-2 border-[#FBD77C] bg-[#FFF7DDB0] p-3 shadow-[0_0_16px_#F9C963]"><ProductDecor/>{logo}<div className="relative z-10 mx-auto w-[85%]">{art()}{title}</div></div><div className="h-12 rounded-md border border-[#B58B60] bg-gradient-to-b from-[#EBC08D] to-[#BE8F59] shadow-md"/></div>}
 {product==="wallclock"&&<div className="relative mx-auto aspect-square w-full rounded-full border-[10px] border-[#FFF9EC] bg-[#FCF3DE] shadow-lg">
 <div className="absolute inset-[5%] overflow-hidden rounded-full"><ProductDecor/></div>
 {Array.from({length:12},(_,i)=><span key={i} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 font-extrabold text-[#486126]" style={{left:`${50+41*Math.sin(i*Math.PI/6)}%`,top:`${50-41*Math.cos(i*Math.PI/6)}%`,fontSize:large?22:15}}>{i||12}</span>)}
 <div className="absolute inset-x-[34%] top-[17%]"><img src={logoUrl} alt="Bun & Fleur Kids"/></div><div className="absolute bottom-[15%] left-[25%] w-[50%]">{art()}{title}</div>
 <div className="absolute left-1/2 top-1/2 z-20 h-[23%] w-[3%] origin-top rotate-[120deg] rounded-full bg-[#282622]"/><div className="absolute left-1/2 top-1/2 z-20 h-[31%] w-[2%] origin-top rotate-[240deg] rounded-full bg-[#282622]"/><div className="absolute left-1/2 top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F2762E]"/></div>}
 {product==="kidswatch"&&<div className="mx-auto w-[82%]"><div className="mx-auto h-12 w-[48%] rounded-t-xl border-4 border-white/90 bg-white/40"/><div className="relative rounded-[25%] border-[10px] border-white/90 bg-[#FCF3DE] p-3 shadow-lg">{logo}<div className="mt-2 grid grid-cols-[1fr_2.4fr_1fr] items-center gap-1">{art()}<div className="rounded-md border-[3px] border-[#4A4940] bg-[#AAB1A1] px-1 py-2 text-center font-mono font-bold text-[#252B24]"><div className="text-[8px]">MO TU WE TH FR</div><div className="text-xl">08:36</div></div>{art(true)}</div><div className="mt-2">{title}</div></div><div className="mx-auto h-12 w-[48%] rounded-b-xl border-4 border-white/90 bg-white/40"/></div>}
 {product==="namestickers"&&<div className="rounded-xl bg-[#FFF8E8] p-2">{logo}<p className="my-2 text-center text-xs font-extrabold text-olive-deep">Stiker Nama · 15 pcs</p><div className="grid grid-cols-3 gap-1">{Array.from({length:15},(_,i)=><div key={i} className="flex min-w-0 items-center rounded-full border-2 border-white p-1" style={{background:["#F9EAC8","#A5DAEF","#C3DB82","#FFE080","#FFC18B"][i%5]}}><div className={label?"w-[42%] shrink-0":"mx-auto w-[65%]"}>{art()}</div>{label&&<span className="min-w-0 flex-1 break-all text-center text-[8px] font-bold" style={{color:project.nameColor}}>{label}</span>}</div>)}</div></div>}
 {product==="rewardchart"&&<div className="rounded-xl bg-[#FFF8E8] p-2">{logo}<p className="text-center text-sm font-extrabold text-olive-deep">Papan Penghargaan Aku</p><div className="mx-auto w-[34%]">{art()}</div>{title}<div className="mt-2 grid grid-cols-[2fr_repeat(7,1fr)] items-center gap-1 text-center text-[8px] font-bold text-olive-deep"><span>Kebiasaanku</span>{["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map(d=><span key={d}>{d}</span>)}{habits.flatMap((h,i)=>[<span key={h} className="text-left">{h}</span>,...Array.from({length:7},(_,j)=><span key={i+"-"+j} className="aspect-square rounded-full border border-[#89965A]"/> )])}</div><p className="mt-2 text-[9px] font-bold">Hadiahku: __________________</p><div className="mt-2 rounded-lg bg-white p-2"><p className="text-center text-[9px] font-bold">Stiker penghargaan</p><div className="grid grid-cols-7 gap-1">{Array.from({length:42},(_,i)=><svg key={i} viewBox="0 0 24 24" className="w-full"><circle cx="12" cy="12" r="6" fill="#FFC62C"/>{Array.from({length:8},(_,j)=><path key={j} d="M12 1V4" stroke="#FFC62C" strokeWidth="2" strokeLinecap="round" transform={`rotate(${j*45} 12 12)`}/>)}</svg>)}</div></div></div>}
 </div><MockupCaption>Personalisasi dari warna dan karakter karya anak</MockupCaption></div>;
}

export function ProductPreview({ product, project, name, fabric, large = false }: {
  product: ProductId; project: ShopProject; name: string; fabric: string; large?: boolean;
}) {
  if (product === "rewardchart" || product === "namestickers" || product === "wallclock" || product === "nightlamp" || product === "kidswatch" || product === "lunchbox" || product === "tumbler") return <NewPersonalizedPreview product={product} project={project} name={name} large={large} />;
  if (product === "poster") return <PosterPreview project={project} name={name} large={large} />;
  if (product === "papercraft") return <PapercraftPreview project={project} name={name} large={large} />;
  if (product === "celengan") return <CelenganPreview project={project} name={name} large={large} />;
  if (product === "puzzle" || product === "placemat") return <FlatProductPreview product={product} project={project} name={name} large={large} />;
  if (product === "growthchart") return <GrowthChartPreview project={project} name={name} large={large} />;
  if (product === "accessory59") return <div className="mx-auto max-w-sm rounded-3xl bg-[#EEF4E4] p-5"><PersonalArtwork project={project} name={name} /><MockupCaption>Aksesori dari pesanan lama</MockupCaption></div>;
  if (product === "figurine") return <FigurinePreview project={project} height={large ? 320 : 210} />;
  return <TshirtPreview project={project} name={name} fabric={fabric} large={large} />;
}

/* ---------------------------- Masterpiece ---------------------------- */

export function Masterpiece({
  project,
  onBack,
  onCustomize,
  cartCount,
  onCart,
}: {
  project: ShopProject;
  onBack: () => void;
  onCustomize: (p: ProductId) => void;
  cartCount: number;
  onCart: () => void;
  onMagic: () => void;
}) {
  const cfg = useShopConfig();
  const template = templateForSnapshot(project);
  const [featured, setFeatured] = useState<ProductId | "artwork">("poster");
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
            Karya Si Kecil <span className="band-accent">Sudah Siap!</span>
          </h1>
          <p className="band-dim mx-auto mt-2 max-w-lg font-semibold">
            Wujudkan imajinasi si kecil menjadi barang istimewa.
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
        </div>
      </section>

      {/* CTA konversi */}
      <section className="band-olive mt-6 rounded-[2rem] px-6 py-8 text-center" aria-label="Jadikan nyata">
        <h2 className="mx-auto max-w-xl font-display text-2xl font-semibold leading-snug sm:text-3xl">
          Jangan Biarkan Imajinasi Si Kecil Hanya di Layar.
        </h2>
        <p className="band-dim mx-auto mt-2 max-w-md font-semibold">
          Wujudkan karya kecilnya menjadi kenangan yang bisa disimpan.
        </p>
      </section>

      <div className="sticky top-2 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] p-3 shadow-md ring-1 ring-[var(--border)]">
        <div aria-live="polite" className="font-display font-bold text-olive-deep">Keranjang · {cartCount} barang</div>
        <button type="button" disabled={!cartCount} onClick={onCart} className="rounded-full bg-olive px-5 py-2.5 font-bold text-white disabled:opacity-40">Lihat Keranjang</button>
      </div>
      {/* Seluruh pilihan produk aktif */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Pilih bentuk kreasimu">
        {ACTIVE_PRODUCT_IDS.map((id) => {
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
              {id === "accessory59" && (
                <p className="mt-1 text-xs font-bold text-olive-deep">
                  Aksesori dengan gambar dan nama pilihanmu.
                </p>
              )}
              {id === "celengan" && (
                <p className="mt-1 text-xs font-bold text-olive-deep">
                  Personalisasi sesuai gambar yang diwarnai · ongkir terpisah.
                </p>
              )}
              {id === "papercraft" && (
                <p className="mt-1 text-xs font-bold text-olive-deep">
                  Kit lembar cetak untuk dirakit · gunting dan lem tidak termasuk.
                </p>
              )}
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
                  className="rounded-full bg-tang px-5 py-3 font-display text-base font-semibold text-ink shadow-sm transition hover:bg-tang-deep"
                >
                  Pilih &amp; Tambah ke Keranjang
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
  onAddToCart,
  nameLocked,
  cartCount,
  onCart,
}: {
  project: ShopProject;
  selection: ShopSelection;
  setSelection: (s: ShopSelection) => void;
  onBack: () => void;
  onAddToCart: () => void;
  nameLocked: boolean;
  cartCount: number;
  onCart: () => void;
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
            project={{...project,backgroundId:selection.backgroundId}}
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
              Nama anak untuk personalisasi (opsional)
            </label>
            <input
              id="order-child-name"
              {...FIELDS.createOrder.childName}
              value={selection.childName}
              disabled={nameLocked}
              onChange={(e) => setSelection({ ...selection, childName: e.target.value })}
              placeholder="Kosongkan jika tidak ingin nama"
              className="mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-display text-lg font-bold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky"
            />
            {nameLocked && <p className="mt-1 text-xs font-bold text-olive-deep">Nama dan karya yang sama digunakan untuk semua barang di keranjang ini. Kosongkan keranjang untuk memilih nama lain.</p>}
            <p className="mt-1 text-xs font-semibold text-[var(--dim)]">
              {selection.product === "poster"
                ? "Nama tampil di bawah karya pada poster, dengan gaya huruf & warna dari Studio Mewarnai."
                : selection.product === "figurine"
                  ? "Nama tercetak pada alas figurine, dengan gaya huruf & warna dari Studio Mewarnai."
                  : selection.product === "papercraft"
                    ? "Nama anak tercetak pada penyangga papercraft, sementara karakter dan warnanya mengikuti karya yang sudah diwarnai."
                    : selection.product === "celengan"
                      ? "Nama anak dan karakter kreasinya dicetak pada sisi depan celengan. Logo Bun & Fleur Kids pada sisi belakang."
                      : selection.product === "accessory59"
                        ? "Nama dan gambar kreasimu ikut dalam desain aksesori custom; spesifikasi cetak akhir disesuaikan produk."
                  : selection.product === "tshirt" ? "Bila diisi, nama anak dicetak di bawah desain pada kaos." : "Nama dan gambar kreasimu tercetak pada produk pilihanmu."}
            </p>
          </div>

          <fieldset className="mt-5" disabled={nameLocked}><legend className="font-display text-sm font-bold">Pilih background (opsional)</legend>
            <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pilihan background">
              {[{id:"",label:"Tanpa background"},...BACKGROUNDS].map(b=><button key={b.id} type="button" role="radio" aria-checked={(selection.backgroundId??"")===b.id} onClick={()=>setSelection({...selection,backgroundId:b.id})} className={`overflow-hidden rounded-xl border p-1 text-xs font-bold ${(selection.backgroundId??"")===b.id?"border-olive ring-2 ring-olive":"border-[var(--border)]"}`}>
                {b.id?<img src={backgroundUrl(b.id)} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover"/>:<div className="aspect-[4/3] rounded-lg bg-white ring-1 ring-black/5"/>}<span className="block py-1">{b.label}</span>
              </button>)}
            </div><p className="mt-2 text-xs text-[var(--dim)]">{nameLocked?"Background sama untuk seluruh isi keranjang. Kosongkan keranjang untuk menggantinya.":"Gratis. Pilihan background tidak mengubah warna karya."}</p>
          </fieldset>
          {selection.product==="kidswatch"&&<section className="mt-4 rounded-2xl bg-[#EEF4E4] p-3 text-sm"><p className="font-bold text-olive-deep">Garansi 1 tahun ganti baru</p><p>Untuk kerusakan mesin, layar, tombol atau cacat produksi dalam 12 bulan sejak produk diterima. Hubungi admin dengan nomor pesanan dan bukti foto/video. Tidak termasuk kehilangan, benturan, salah penggunaan, atau baterai habis normal.</p></section>}
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
                      {FABRIC_LABELS[c] ?? c}
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

          {selection.product === "accessory59" && (
            <div className="mt-4 rounded-2xl bg-[#EDF2E6] px-4 py-3 text-sm font-semibold leading-relaxed text-olive-deep ring-1 ring-[var(--border)]">
              <p className="font-display font-extrabold">Aksesori Custom Premium · Rp59.000</p>
              <p className="mt-1">Karya mewarnai anak dipakai untuk personalisasi aksesori.
                Harga tetap, ongkir terpisah. Foto dan detail bentuk fisik akan dikonfirmasi sebelum produksi.</p>
            </div>
          )}
          {selection.product === "celengan" && (
            <div className="mt-4 rounded-2xl bg-[#EDF2E6] px-4 py-3 text-sm font-semibold leading-relaxed text-olive-deep ring-1 ring-[var(--border)]">
              <p className="font-display font-extrabold">Celengan Personalisasi · {formatIDR(price)}</p>
              <p className="mt-1">
                Celengan tabung dengan lubang uang pada tutupnya. Desain depan berisi gambar, warna
                dan nama dari hasil mewarnai anak; logo Bun & Fleur Kids di belakang.
                Foto adalah contoh, pesanan dibuat khusus sesuai desainmu. Ongkir terpisah.
              </p>
            </div>
          )}
          {selection.product === "papercraft" && (
            <div className="mt-4 rounded-2xl bg-[#EDF2E6] px-4 py-3 text-sm font-semibold leading-relaxed text-olive-deep ring-1 ring-[var(--border)]">
              <p className="font-display font-extrabold">Kit Papercraft 3D · {formatIDR(price)}</p>
              <p className="mt-1">
                Tim mencetak lembar depan-belakang karakter dan strip pembentuk volume dari warna,
                coretan, serta nama hasil kreasimu. Kit dikirim untuk digunting, dilipat dan direkatkan sendiri.
                Gunting dan lem tidak disertakan. Contoh foto dinosaurus hanya referensi bentuk produk.
                Harga tetap, ongkos kirim terpisah.
              </p>
            </div>
          )}

          {selection.product === "poster" && (
            <p className="mt-4 rounded-2xl bg-sky-soft px-4 py-3 text-sm font-semibold leading-relaxed ring-1 ring-[var(--border)]">
              Poster dicetak dari karya anakmu, dengan ornamen dan identitas Bun &amp; Fleur Kids, untuk dipajang di kamarnya.
              Harga poster tetap — tidak berubah oleh pilihan apa pun di halaman ini.
            </p>
          )}

          <dl className="mt-5 space-y-1.5 border-t-2 border-dashed border-[var(--border)] pt-4 text-sm font-semibold">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Harga produk</dt>
              <dd className="font-display">{formatIDR(price)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Ongkos kirim</dt>
              <dd className="text-right">Gratis mulai {formatIDR(cfg.shippingPolicy.freeFrom)} setelah diskon; di bawahnya {formatIDR(cfg.shippingPolicy.flatRate)} per pesanan.</dd>
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
              onAddToCart();
            }}
            className="mt-4 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-semibold text-ink shadow transition hover:bg-tang-deep"
          >
            Tambah ke Keranjang
          </button>
          {cartCount > 0 && <button type="button" onClick={onCart} className="mt-2 w-full rounded-full border border-olive px-5 py-3 font-bold text-olive-deep">Lihat Keranjang ({cartCount})</button>}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ Checkout ------------------------------ */

export function Checkout({
  project,
  cart,
  childName,
  changeCart,
  checkoutId,
  onBack,
  onPlaced,
}: {
  project: ShopProject;
  cart: CartLine[];
  childName: string;
  changeCart: (lines: CartLine[]) => void;
  checkoutId: { current: string | null };
  onBack: () => void;
  onPlaced: (o: OrderOut) => void;
}) {
  const cfg = useShopConfig();
  const queryClient = useQueryClient();
  const price = cart.reduce((n, line) => n + basePrice(cfg,line.product)*line.quantity, 0);
  const quantity = cart.reduce((n,line) => n+line.quantity,0);
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isGift,setIsGift]=useState(false);
  const [giftSender,setGiftSender]=useState("");
  const [giftRecipient,setGiftRecipient]=useState("");
  const [giftMessage,setGiftMessage]=useState("");
  const [extraColor,setExtraColor]=useState("Cream");
  const [extraSize,setExtraSize]=useState("");
  const [error, setError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; rates: Partial<Record<ProductId, number>> } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const validate = useMutation({
    mutationFn: async (code: string) => {
      const ids = [...new Set(cart.map(line => line.product))];
      const results = await Promise.all(ids.map(productType => api.validateCoupon({ code, productType })));
      return { valid: results.length > 0 && results.every(r => r.valid), code: results[0]?.code ?? code,
        rates: Object.fromEntries(ids.map((id,i) => [id,results[i]?.discountPct ?? 0])) as Partial<Record<ProductId,number>> };
    },
    onError: (e) => {
      setAppliedCoupon(null);
      setCouponMsg(e.message);
    },
    onSuccess: (res) => {
      if (res.valid) {
        setAppliedCoupon({ code: res.code, rates: res.rates });
        setCouponMsg("Kupon aktif. Diskon dihitung sesuai masing-masing produk.");
      } else {
        setAppliedCoupon(null);
        setCouponMsg("Kode kupon tidak ditemukan atau tidak aktif.");
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
  const bundle=appliedCoupon?null:bestBundle(cfg.bundles,cart.map(l=>({productType:l.product,quantity:l.quantity,unitPrice:basePrice(cfg,l.product)})));
  const discount = appliedCoupon ? cart.reduce((n,line) => n + Math.floor(basePrice(cfg,line.product)*line.quantity*(appliedCoupon.rates[line.product] ?? 0)/100),0) : bundle?.savings??0;
  const addSuggested=(ids:readonly ProductId[])=>{
    const missing=ids.filter(id=>!cart.some(l=>l.product===id));
    if(!missing.length)return;
    if(missing.includes("tshirt")&&(!extraSize||!cfg.tshirtSizes.includes(extraSize))){setError("Pilih ukuran kaos untuk paket atau produk tambahan.");return;}
    if(cart.length+missing.length>20||quantity+missing.length>140){setError("Keranjang mencapai batas jumlah barang.");return;}
    setError("");setAppliedCoupon(null);setCouponMsg(couponInput?"Periksa ulang kupon untuk barang tambahan.":"");
    changeCart([...cart,...missing.map(product=>({product,quantity:1,tshirtColor:product==="tshirt"?extraColor:"",tshirtSize:product==="tshirt"?extraSize:""}))]);
  };
  const missingProducts=ACTIVE_PRODUCT_IDS.filter(id=>!cart.some(l=>l.product===id));
  const suggestions=[...missingProducts].sort((a,b)=>{
    const gap=Math.max(0,cfg.shippingPolicy.freeFrom-(price-discount));
    const pa=basePrice(cfg,a),pb=basePrice(cfg,b);
    const score=(p:number)=>gap>0&&p>=gap?p-gap:gap>0?1000000+gap-p:p;
    return score(pa)-score(pb);
  }).slice(0,3);
  const netSubtotal = price - discount;
  const shipping = netSubtotal >= cfg.shippingPolicy.freeFrom ? 0 : cfg.shippingPolicy.flatRate;
  const remaining = Math.max(0, cfg.shippingPolicy.freeFrom - netSubtotal);
  const create = useMutation({
    mutationFn: async () =>
      await api.createOrder({
        projectId: project.id ?? 0,
        checkoutId: checkoutId.current ??= crypto.randomUUID(),
        productType: cart[0]!.product,
        items: cart.map(line => ({ productType: line.product, quantity: line.quantity,
          tshirtColor: line.tshirtColor, tshirtSize: line.tshirtSize,
          expectedUnitPrice: basePrice(cfg,line.product), expectedCouponDiscountPct: appliedCoupon ? appliedCoupon.rates[line.product] : undefined })),
        expectedShippingCost: shipping,
        expectedBundleDiscount:bundle?.savings??0,
        gift:isGift?{sender:giftSender.trim(),recipient:giftRecipient.trim(),message:giftMessage.trim()}:null,
        childName: childName.trim(),
        backgroundId: project.backgroundId ?? "",
        couponCode: appliedCoupon?.code ?? "",
        customerName: customerName.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        address: address.trim(),
        notes: notes.trim(),
      }),
    onError: (e) => {
      setError(e.message);
      if (appliedCoupon) validate.mutate(appliedCoupon.code);
      void queryClient.invalidateQueries({ queryKey: ["shopConfig"] });
    },
    onSuccess: (res) => onPlaced(res.order),
  });
  const submit = () => {
    if (validate.isPending || create.isPending || !cart.length) return;
    setError("");
    if (project.id == null) {
      setError("Karya ini belum tersimpan. Kembali ke Studio Mewarnai sebentar supaya tersimpan, lalu coba lagi.");
      return;
    }
    if (couponInput.trim() && !appliedCoupon) return setError("Pakai atau kosongkan kode kupon terlebih dahulu.");
    if(isGift&&(giftSender.trim().length<2||giftRecipient.trim().length<2))return setError("Isi nama pengirim dan penerima hadiah.");
    if (customerName.trim().length < 2) return setError("Isi nama pemesan dulu ya.");
    if (whatsapp.replace(/\D/g, "").length < 9) return setError("Nomor WhatsApp perlu 9–15 digit angka.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Format email belum benar.");
    if (address.trim().length < 10) return setError("Isi alamat pengiriman lengkap (jalan, kota, kode pos) ya.");
    create.mutate();
  };
  if (!cart.length) return <div className="mx-auto max-w-xl p-6 text-center"><h1 className="font-display text-2xl font-bold">Keranjang kosong</h1><button type="button" onClick={onBack} className="mt-4 rounded-full bg-olive px-5 py-3 text-white">Pilih Produk</button></div>;
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="band-sky mt-4 flex flex-wrap items-center gap-2 rounded-[1.75rem] px-5 py-4">
        <button type="button" disabled={create.isPending} onClick={onBack} className="rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5">
          ← Tambah produk lain
        </button>
        <h1 className="font-display text-2xl font-semibold">Keranjang &amp; Pemesanan ({quantity})</h1>
      </div>
      <section className="mt-4 space-y-3 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]" aria-label="Isi keranjang">
        <h2 className="font-display text-lg font-bold">Isi keranjang</h2>
        <p className="text-xs font-semibold text-[var(--dim)]">Seluruh barang menggunakan karya dan nama yang sama. {childName && "Nama: " + childName}</p>
        {cart.map((line,i) => <article key={line.product + "|" + line.tshirtColor + "|" + line.tshirtSize} className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <div className="w-24 shrink-0"><ProductPreview product={line.product} project={project} name={childName} fabric={line.tshirtColor || "Cream"} /></div>
          <div className="min-w-32 flex-1"><p className="font-bold">{PRODUCT_META[line.product].title}</p>
            {line.product === "tshirt" && <p className="text-xs">{FABRIC_LABELS[line.tshirtColor] ?? line.tshirtColor} · {line.tshirtSize}</p>}
            <p className="text-sm font-bold">{formatIDR(basePrice(cfg,line.product))} / unit</p>
            {appliedCoupon && <p className="text-xs text-olive-deep">Diskon {appliedCoupon.rates[line.product] ?? 0}%</p>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label={"Kurangi jumlah " + PRODUCT_META[line.product].title} disabled={create.isPending || line.quantity <= 1} onClick={() => changeCart(cart.map((x,j)=>j===i?{...x,quantity:x.quantity-1}:x))} className="h-9 w-9 rounded-full border font-bold disabled:opacity-40">−</button>
            <span className="min-w-5 text-center font-bold">{line.quantity}</span>
            <button type="button" aria-label={"Tambah jumlah " + PRODUCT_META[line.product].title} disabled={create.isPending || line.quantity >= 20 || quantity >= 140} onClick={() => changeCart(cart.map((x,j)=>j===i?{...x,quantity:x.quantity+1}:x))} className="h-9 w-9 rounded-full border font-bold disabled:opacity-40">+</button>
          </div>
          <div className="text-right"><p className="font-bold">{formatIDR(basePrice(cfg,line.product)*line.quantity)}</p><button type="button" disabled={create.isPending || validate.isPending} onClick={() => changeCart(cart.filter((_,j)=>j!==i))} className="text-xs font-bold text-berry">Hapus</button></div>
        </article>)}
        <div className="flex justify-between border-t border-[var(--border)] pt-3 font-bold"><span>Subtotal</span><span>{formatIDR(price)}</span></div>
        <div className="rounded-2xl bg-[#EEF4E4] p-3 text-sm font-bold text-olive-deep" role="status">{remaining === 0 ? "Selamat! Pesananmu mendapatkan gratis ongkir." : "Tambah belanja " + formatIDR(remaining) + " setelah diskon untuk mendapatkan gratis ongkir."}<div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-olive transition-all" style={{width: Math.min(100, netSubtotal / cfg.shippingPolicy.freeFrom * 100) + "%"}} /></div><p className="mt-1 text-xs">Ongkir {formatIDR(cfg.shippingPolicy.flatRate)} per pesanan di bawah {formatIDR(cfg.shippingPolicy.freeFrom)}.</p></div>
      </section>

      <section className="mt-4 space-y-3 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
        <h2 className="font-display text-lg font-bold">Paket hemat &amp; lengkapi karyamu</h2>
        <p className="text-xs text-[var(--dim)]">Satu diskon paket terbaik per transaksi, tidak digabung dengan kupon affiliate. Ongkir dihitung setelah diskon.</p>
        {bundle&&<p className="rounded-xl bg-[#EEF4E4] p-3 font-bold text-olive-deep">Paket {bundle.name} aktif · hemat {formatIDR(bundle.savings)}</p>}
        {cfg.bundles.filter(b=>b.productIds.reduce((n,id)=>n+basePrice(cfg,id),0)>b.price).map(b=>{
          const normal=b.productIds.reduce((n,id)=>n+basePrice(cfg,id),0);
          const missing=b.productIds.filter(id=>!cart.some(l=>l.product===id));
          return <article key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3"><div className="min-w-0 flex-1"><p className="font-bold">{b.name}</p><p className="text-xs">{b.productIds.map(id=>PRODUCT_META[id].title).join(" + ")}</p><p className="text-sm"><del>{formatIDR(normal)}</del> <strong>{formatIDR(b.price)}</strong></p></div><button type="button" disabled={create.isPending||validate.isPending||!missing.length} onClick={()=>addSuggested(b.productIds)} className="rounded-full bg-olive px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{missing.length?"Lengkapi paket":"Sudah di keranjang"}</button></article>;
        })}
        {missingProducts.includes("tshirt")&&<div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold">Warna kaos tambahan<select className="block w-full rounded-xl border p-2" value={extraColor} onChange={e=>setExtraColor(e.target.value)}>{cfg.tshirtColors.map(c=><option key={c} value={c}>{FABRIC_LABELS[c]??c}</option>)}</select></label><label className="text-xs font-bold">Ukuran kaos tambahan<select className="block w-full rounded-xl border p-2" value={extraSize} onChange={e=>setExtraSize(e.target.value)}><option value="">Pilih ukuran</option>{cfg.tshirtSizes.map(v=><option key={v}>{v}</option>)}</select></label></div>}
        {suggestions.length>0&&<><h3 className="font-bold">{remaining>0?"Produk tambahan untuk mengejar gratis ongkir":"Produk lain dari karya si kecil"}</h3>{suggestions.map(id=><div key={id} className="flex items-center gap-3 border-t pt-2"><div className="w-20 shrink-0"><ProductPreview product={id} project={project} name={childName} fabric={extraColor}/></div><div className="flex-1"><p className="font-bold">{PRODUCT_META[id].title}</p><p className="text-sm">{formatIDR(basePrice(cfg,id))}</p></div><button type="button" disabled={create.isPending||validate.isPending} onClick={()=>addSuggested([id])} className="rounded-full border border-olive px-3 py-2 text-xs font-bold text-olive-deep">+ Tambah</button></div>)}</>}
      </section>
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
              <p className="mt-1 text-xs font-semibold text-[var(--dim)]">Tim kami menghubungimu di nomor ini untuk pembayaran dan info pengiriman.</p>
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
              <fieldset className="mb-4 space-y-2 rounded-2xl border border-[var(--border)] p-3">
                <legend className="font-display font-bold">Pesanan hadiah</legend>
                <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={isGift} onChange={e=>setIsGift(e.target.checked)}/> Jadikan hadiah</label>
                {isGift&&<><p className="text-xs text-[var(--dim)]">Isi alamat pengiriman di atas dengan alamat penerima. Harga tidak dicantumkan di dalam paket.</p>
                <label className="block text-sm font-bold">Nama pengirim<input required maxLength={80} className="block w-full rounded-xl border p-2" value={giftSender} onChange={e=>setGiftSender(e.target.value)}/></label>
                <label className="block text-sm font-bold">Nama penerima<input required maxLength={80} className="block w-full rounded-xl border p-2" value={giftRecipient} onChange={e=>setGiftRecipient(e.target.value)}/></label>
                <label className="block text-sm font-bold">Kartu ucapan<textarea maxLength={250} className="block w-full rounded-xl border p-2" value={giftMessage} onChange={e=>setGiftMessage(e.target.value)}/></label>
                <div className="rounded-xl bg-[#FCF3DE] p-4 text-center text-[#53682F]"><p className="font-bold">Hadiah kecil, kenangan besar.</p><p className="mt-2">Untuk {giftRecipient||"Si Kecil"}</p><p className="my-2 whitespace-pre-wrap break-words italic">{giftMessage||"Sebuah hadiah istimewa untukmu."}</p><p>Dari {giftSender||"Pengirim"}</p><p className="mt-3 text-xs font-bold">Bun &amp; Fleur Kids</p></div></>}
              </fieldset>
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
                  disabled={validate.isPending || create.isPending}
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
                  disabled={create.isPending || validate.isPending || couponInput.trim().length < 3}
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
            disabled={create.isPending || validate.isPending}
            className="mt-4 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-semibold text-ink shadow transition hover:bg-tang-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending ? "Membuat pesanan…" : "Buat Pesanan"}
          </button>
        </form>

        <aside className="space-y-4">
          <section className="rounded-[1.75rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Ringkasan pesanan">
            <h2 className="font-display text-lg font-semibold">Ringkasan pesanan</h2>
            <dl className="mt-3 space-y-1.5 text-sm font-semibold">
              {cart.map((line,i) => <div key={i} className="flex justify-between gap-3"><dt>{PRODUCT_META[line.product].title} × {line.quantity}</dt><dd>{formatIDR(basePrice(cfg,line.product)*line.quantity)}</dd></div>)}
              <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2">
                <dt className="text-[var(--dim)]">Harga produk</dt>
                <dd className="font-display">{formatIDR(price)}</dd>
              </div>
              {bundle&&<div className="flex justify-between gap-3"><dt>Diskon paket {bundle.name}</dt><dd className="font-bold text-olive-deep">−{formatIDR(bundle.savings)}</dd></div>}
              {appliedCoupon && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--dim)]">Diskon kupon {appliedCoupon.code}</dt>
                  <dd className="font-display text-olive-deep">−{formatIDR(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--dim)]">Ongkos kirim</dt>
                <dd className="text-right">{shipping === 0 ? "GRATIS" : formatIDR(shipping)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2 text-base">
                <dt>Total pesanan</dt>
                <dd className="font-display text-olive-deep">{formatIDR(netSubtotal + shipping)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs font-semibold text-[var(--dim)]">
              Harga produk dan ongkos kirim selalu ditampilkan terpisah. Di halaman pembayaran, total yang
              ditransfer = total produk setelah diskon + ongkir + kode unik pembayaran (Rp1–999) yang dibuat
              server untuk pesananmu.
            </p>
          </section>

          <section className="overflow-hidden rounded-[1.75rem] bg-[var(--surface)] ring-1 ring-[var(--border)]" aria-label="Preview metode pembayaran">
            <div className="band-sage px-5 py-4">
              <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-olive-deep">Pembayaran resmi</p>
              <h2 className="mt-1 font-display text-lg font-extrabold text-ink">QRIS GoPay Merchant</h2>
              <p className="mt-1 text-xs font-semibold text-[var(--dim)]">{QRIS_MERCHANT}</p>
            </div>
            <div className="px-5 py-5 text-center">
              <div className="mx-auto max-w-[190px] rounded-2xl bg-white p-3 ring-1 ring-[#E6DFD0]">
                <img src={officialQrisUrl} alt="Pratinjau QRIS resmi Bun and Fleur" className="w-full" />
              </div>
              <p className="mt-3 font-display text-sm font-bold text-olive-deep">Bayar setelah pesanan dibuat</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--dim)]">
                Nominal pembayaran dan kode unik baru akan muncul setelah kamu menekan tombol
                Buat Pesanan. Bayar hanya sesuai nominal akhir yang ditampilkan.
              </p>
              <div className="mt-4 rounded-2xl bg-butter-soft p-3 text-xs font-semibold leading-relaxed text-ink">
                Setelah membayar, klik “Saya Sudah Transfer”. Tim memverifikasi transaksi secara manual sebelum produksi dimulai.
              </div>
            </div>
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

export const QRIS_MERCHANT = "BUN AND FLEUR, PAKAIAN";
export const QRIS_NMID = "ID1026626210169";

/* --------------------- QRIS payment panel (Part 4) --------------------- */
// Static merchant QRIS + the order's exact payable amount (product net
// + shipping + the server-generated unique code). "Saya Sudah
// Transfer" only records the customer's confirmation — the order moves
// to Waiting for Verification and stays unpaid until an admin verifies
// the real incoming transfer.
function encodeBase64(bytes: Uint8Array): string {
  let raw = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    raw += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(raw);
}

export function PaymentPanel({ order }: { order: OrderOut }) {
  const [payState, setPayState] = useState<OrderOut["payState"]>(order.payState);
  const [copied, setCopied] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [showShopee, setShowShopee] = useState(false);
  const [shopeeUsername, setShopeeUsername] = useState(order.shopeeUsername);
  const [reportedShopee, setReportedShopee] = useState(order.shopeeUsername);
  useEffect(() => { setPayState(order.payState); setReportedShopee(order.shopeeUsername); setShopeeUsername(order.shopeeUsername); setShowShopee(false); }, [order.id, order.payState, order.shopeeUsername]);
  const shopeeConfirm = useMutation({
    mutationFn: () => api.confirmTransfer({ code: order.code, whatsapp: order.whatsapp, shopeeUsername: shopeeUsername.trim() }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      if (!res.ok) { setError("Konfirmasi Shopee belum berhasil dicatat. Hubungi tim kami."); return; }
      setReportedShopee(shopeeUsername.trim()); setShowShopee(false); setError("");
      if (res.payState !== "not_found") setPayState(res.payState);
    },
  });
  const confirm = useMutation({
    mutationFn: async () => {
      let proof;
      if (proofFile) {
        if (proofFile.size > 750000 || (proofFile.type !== "image/jpeg" && proofFile.type !== "image/png")) {
          throw new Error("Pilih gambar JPG atau PNG dengan ukuran maksimal 750 KB.");
        }
        const data = encodeBase64(new Uint8Array(await proofFile.arrayBuffer()));
        proof = { mime: proofFile.type, data } as const;
      }
      return api.confirmTransfer({ code: order.code, whatsapp: order.whatsapp, proof });
    },
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      if (res.ok) {
        setError("");
        setProofFile(null);
        setPayState(res.payState === "not_found" ? payState : res.payState);
      }
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
  const statusTone = payState === "verified"
    ? "bg-olive text-white"
    : payState === "rejected" || payState === "unmatched"
      ? "bg-[#FCEBE5] text-berry"
      : "bg-white text-olive-deep";

  if (reportedShopee) return (
    <section className="rounded-[2rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Konfirmasi checkout Shopee">
      <p className="font-display text-xs font-bold uppercase tracking-wider text-[#E85828]">Shopee</p>
      <h2 className="mt-2 font-display text-2xl font-extrabold text-olive-deep">{payState === "verified" ? "Checkout Shopee Terverifikasi" : "Checkout Shopee Dilaporkan"}</h2>
      <p className="mt-2 text-sm font-semibold">Nama akun Shopee: <strong>{reportedShopee}</strong></p>
      <p className="mt-2 text-sm font-bold">{PAY_STATE_LABELS[payState]}</p>
      <p className="mt-2 text-sm text-[var(--dim)]">Tim kami akan mencocokkan pesanan di Shopee. Jangan melakukan pembayaran ulang melalui QRIS.</p>
    </section>
  );
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[var(--surface)] ring-1 ring-[var(--border)]"
      aria-label="Pembayaran QRIS resmi Bun & Fleur">
      <div className="band-sage flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-olive-deep">Metode pembayaran</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">Scan &amp; Bayar QRIS</h2>
          <p className="mt-1 text-sm font-semibold text-[var(--dim)]">Praktis melalui aplikasi bank atau e-wallet.</p>
        </div>
        <span className={`rounded-full px-4 py-2 font-display text-xs font-bold ring-1 ring-black/5 ${statusTone}`}>
          {PAY_STATE_LABELS[payState]}
        </span>
      </div>
      {payState === "awaiting" && order.orderStatus !== "cancelled" && <div className="mx-4 mt-4 rounded-2xl border border-[#F4D1C1] bg-[#FFF6EE] p-4 sm:mx-6">
        <button type="button" aria-expanded={showShopee} aria-controls={`shopee-form-${order.id}`} disabled={confirm.isPending || shopeeConfirm.isPending} onClick={() => {setShowShopee(v => !v);setError("");}} className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#EE4D2D] px-4 py-3 font-display font-bold text-white disabled:opacity-50">
          Sudah Checkout di Shopee <span aria-hidden>{showShopee ? "▴" : "▾"}</span>
        </button>
        {showShopee && <form id={`shopee-form-${order.id}`} className="mt-4 space-y-3" onSubmit={e => {e.preventDefault();if(shopeeUsername.trim() && !shopeeConfirm.isPending && !confirm.isPending)shopeeConfirm.mutate();}}>
          <p className="text-sm text-[var(--dim)]">Jika sudah checkout di Shopee, masukkan nama akun yang digunakan agar tim kami dapat mencocokkan pesanan.</p>
          <label htmlFor={`shopee-username-${order.id}`} className="block text-sm font-bold">Nama akun Shopee <span className="text-[#B93820]">*</span></label>
          <input id={`shopee-username-${order.id}`} type="text" value={shopeeUsername} onChange={e => setShopeeUsername(e.target.value)} required maxLength={80} autoComplete="off" placeholder="Masukkan nama akun Shopee" className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3" />
          <button type="submit" disabled={!shopeeUsername.trim() || shopeeConfirm.isPending || confirm.isPending} className="w-full rounded-full bg-olive px-4 py-3 font-display font-bold text-white disabled:opacity-40">{shopeeConfirm.isPending ? "Mengirim…" : "Submit Konfirmasi"}</button>
          <p className="text-xs text-[var(--dim)]">Konfirmasi tidak otomatis menandai pesanan lunas.</p>
          {error && <p role="alert" className="text-sm font-bold text-berry">{error}</p>}
        </form>}
      </div>}
      <div hidden={showShopee} className={`${showShopee ? "hidden" : "grid"} items-start gap-5 px-4 py-5 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)] sm:gap-6 sm:px-6 sm:py-6`}>
        <div className="mx-auto w-full max-w-[340px]">
          <div className="rounded-[1.75rem] border border-[#E6DFD0] bg-white p-4 shadow-[0_8px_30px_rgba(59,55,43,0.05)] sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-[#F0E9DE] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F8FC] text-base font-black text-[#079FC4]">G</span>
                <div>
                  <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink">QRIS</p>
                  <p className="text-[10px] font-bold text-[var(--dim)]">GoPay Merchant</p>
                </div>
              </div>
              <span className="rounded-full bg-[#EEF4E4] px-2.5 py-1 font-display text-[10px] font-bold text-olive-deep">QRIS RESMI</span>
            </div>
            <img src={officialQrisUrl}
              alt="Kode QRIS asli GoPay Merchant BUN AND FLEUR, PAKAIAN untuk pembayaran"
              className="mx-auto mt-3 aspect-square w-full max-w-[330px] object-contain" />
            <p className="mt-2 text-center font-display text-xs font-extrabold uppercase tracking-wide text-ink">{QRIS_MERCHANT}</p>
            <p className="mt-1 text-center text-[11px] font-semibold text-[var(--dim)]">NMID: {QRIS_NMID}</p>
          </div>
          <a href={officialQrisUrl} download="QRIS-Resmi-Bun-and-Fleur.png"
            className="mt-3 flex min-h-11 items-center justify-center rounded-full bg-[var(--surface-alt)] px-4 py-2.5 text-center font-display text-sm font-bold text-ink ring-1 ring-[var(--border)] transition hover:bg-butter-soft">
            Simpan Gambar QRIS
          </a>
          <p className="mt-2 text-center text-xs font-semibold leading-relaxed text-[var(--dim)]">
            Bisa dipindai melalui GoPay, BCA, Mandiri, BNI, BRI dan aplikasi QRIS lainnya.
          </p>
        </div>
        <div className="min-w-0">
          <div className="rounded-3xl bg-[#F4F0E7] p-4 sm:p-5">
            <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[var(--dim)]">Total Pembayaran</p>
            <p className="mt-1 break-words font-display text-3xl font-extrabold tracking-tight text-olive-deep">
              {formatIDR(payable)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--dim)]">Termasuk kode unik pembayaran · Pesanan {order.code}</p>
            <button type="button" onClick={() => void copyAmount()}
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-olive px-5 py-2 font-display text-sm font-bold text-white transition hover:bg-olive-deep">
              {copied ? "Nominal Berhasil Disalin" : "Salin Nominal Pembayaran"}
            </button>
          </div>

          <dl className="mt-4 space-y-2 px-1 text-sm font-semibold">
            <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Produk</dt><dd className="text-right font-display">{order.quantity} barang · {orderTitle(order)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Subtotal Produk</dt><dd className="font-display">{formatIDR(order.productPrice)}</dd></div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--dim)]">Diskon {order.bundleName||order.couponCode}</dt>
                <dd className="font-display text-olive-deep">−{formatIDR(order.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Ongkos Kirim</dt>
              <dd className="text-right">{order.shippingCost == null ? "Menunggu konfirmasi" : order.shippingCost === 0 ? "GRATIS" : formatIDR(order.shippingCost)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2">
              <dt className="text-[var(--dim)]">Kode Unik</dt>
              <dd className="font-display">{formatIDR(order.uniqueCode)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-2xl bg-[#EEF4E4] p-4 text-sm font-semibold text-olive-deep">
            <p className="font-display text-sm font-extrabold">Cara pembayaran</p>
            <ol className="mt-2 space-y-2">
              <li><strong>01.</strong> Scan QRIS menggunakan aplikasi bank atau e-wallet.</li>
              <li><strong>02.</strong> Masukkan nominal <strong>{formatIDR(payable)}</strong> secara manual, tepat sesuai total.</li>
              <li><strong>03.</strong> Setelah berhasil transfer, tekan tombol konfirmasi di bawah.</li>
            </ol>
          </div>
          {order.shippingCost == null && (
            <p className="mt-3 rounded-2xl bg-butter-soft px-4 py-3 text-xs font-semibold leading-relaxed text-ink">
              Ongkos kirim masih menunggu konfirmasi tim via WhatsApp. Jangan membayar sebelum total akhir beserta ongkir disepakati; cek pembaruan nominal di Lacak Pesanan.
            </p>
          )}
          <p className="mt-3 text-xs font-semibold leading-relaxed text-[var(--dim)]">
            Ini QRIS statis: masukkan nominal sendiri. Jangan transfer dua kali. Konfirmasi di bawah
            hanya mencatat laporan pembayaran; tim tetap memeriksa mutasi QRIS sebelum pesanan dinyatakan lunas.
          </p>

          {["awaiting", "waiting_verification", "unmatched"].includes(payState) && (
            <div className="mt-4">
              <label htmlFor={`proof-${order.id}`} className="block text-sm font-bold">Bukti pembayaran (opsional)</label>
              <input key={payState} id={`proof-${order.id}`} type="file" accept="image/jpeg,image/png"
                onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} disabled={confirm.isPending}
                className="mt-2 block w-full text-sm" aria-describedby={`proof-help-${order.id}`} />
              <p id={`proof-help-${order.id}`} className="mt-1 text-xs text-[var(--dim)]">JPG atau PNG, maksimal 750 KB.</p>
              {payState === "waiting_verification" && proofFile && (
                <button type="button" disabled={confirm.isPending} onClick={() => confirm.mutate()}
                  className="mt-2 rounded-full bg-olive px-4 py-2 text-sm font-bold text-white">Kirim bukti</button>
              )}
            </div>
          )}
          {payState === "verified" ? (
            <p className="mt-4 rounded-2xl bg-sage-soft px-4 py-3 font-display text-sm font-bold text-olive-deep ring-1 ring-[var(--border)]">
              Pembayaran sudah terverifikasi. Pesanan akan dilanjutkan ke tahap berikutnya.
            </p>
          ) : payState === "rejected" ? (
            <p className="mt-4 rounded-2xl bg-[#FDECEA] px-4 py-3 font-display text-sm font-bold text-berry ring-1 ring-[var(--border)]">
              Pembayaran belum bisa diverifikasi. Hubungi tim via WhatsApp untuk mencocokkan transaksi. Jangan transfer ulang dulu.
            </p>
          ) : payState === "refunded" ? (
            <p className="mt-4 rounded-2xl bg-[var(--surface-alt)] px-4 py-3 font-display text-sm font-bold ring-1 ring-[var(--border)]">Pesanan ini sudah direfund.</p>
          ) : (
            <>
              <button type="button"
                disabled={confirm.isPending || payState === "waiting_verification" || order.shippingCost == null}
                onClick={() => confirm.mutate()}
                className="mt-4 min-h-12 w-full rounded-full bg-tang px-5 py-3 font-display text-base font-extrabold text-ink shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
                {payState === "waiting_verification"
                  ? "Menunggu Verifikasi Tim"
                  : confirm.isPending ? "Mencatat Pembayaran…" : "Saya Sudah Transfer"}
              </button>
              {payState === "waiting_verification" && (
                <p className="mt-3 text-sm font-semibold text-[var(--dim)]" role="status">
                  Konfirmasi berhasil dicatat. Tim sedang mencocokkan transaksi sesuai nominal unik. Status tidak otomatis berubah menjadi lunas.
                </p>
              )}
              {payState === "unmatched" && (
                <p className="mt-3 text-sm font-semibold text-[var(--dim)]" role="status">
                  Transfer belum ditemukan pada mutasi QRIS. Hubungi tim melalui WhatsApp untuk pemeriksaan, jangan langsung transfer ulang.
                </p>
              )}
            </>
          )}
          {error && <p className="mt-3 text-sm font-bold text-berry" role="alert">{error}</p>}
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
  const snap: ShopProject = useMemo(
    () => ({
      id: order.projectId,
      templateId: order.templateId,
      childName: order.childName,
      backgroundId: order.backgroundId,
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
          Terima kasih — semua barang dari karya si kecil sudah tercatat dalam satu pesanan.
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {linesOf(order).map((item,i) => <div key={i} className="min-w-0">
            <ProductPreview product={item.productType} project={snap} name={order.childName}
              fabric={item.variant.startsWith("Kaos ") ? item.variant.slice(5).split(" · ")[0]! : "Cream"} />
            <p className="text-center text-xs font-bold">{PRODUCT_META[item.productType].title} × {item.quantity}</p>
          </div>)}
        </div>
        <OrderedItems order={order} />
        <dl className="mx-auto mt-4 max-w-md space-y-1.5 text-sm font-semibold">
          {order.childName.trim() && <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Nama anak</dt><dd className="text-right">{order.childName.trim()}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Pemesan</dt><dd className="text-right">{order.customerName}</dd></div>
          {order.gift&&<div className="rounded-xl bg-[#EEF4E4] p-3 text-olive-deep">Pesanan hadiah · Untuk {order.gift.recipient} · Dari {order.gift.sender}</div>}
          <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2"><dt className="text-[var(--dim)]">Harga produk</dt><dd className="font-display">{formatIDR(order.productPrice)}</dd></div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Diskon {order.bundleName||order.couponCode}</dt><dd className="font-display text-olive-deep">−{formatIDR(order.discountAmount)}</dd></div>
          )}
          <div className="flex justify-between gap-3"><dt className="text-[var(--dim)]">Ongkos kirim</dt><dd className="text-right">{order.shippingCost == null ? "Dikonfirmasi via WhatsApp" : order.shippingCost === 0 ? "GRATIS" : formatIDR(order.shippingCost)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Total pesanan (sebelum kode unik)</dt><dd className="font-display text-olive-deep">{formatIDR(order.total)}</dd></div>
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

async function artworkXml(svg: SVGSVGElement | null): Promise<string | null> {
  if (!svg) return null;
  const copy=svg.cloneNode(true) as SVGSVGElement;
  try {
    for(const image of Array.from(copy.querySelectorAll("image[data-background]"))){
      const path=image.getAttribute("href");
      if(!path)continue;
      const response=await fetch(path);
      if(!response.ok)throw new Error("Background gagal dimuat");
      const blob=await response.blob();
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});
      image.setAttribute("href",data);
    }
  }catch{window.alert("Background belum berhasil dimuat. Coba unduh kembali.");return null;}
  return new XMLSerializer().serializeToString(copy);
}

async function downloadArtworkSvg(svg: SVGSVGElement | null, filename: string) {
  const xml=await artworkXml(svg);
  if(xml) downloadBlob(new Blob([xml], {type:"image/svg+xml;charset=utf-8"}),filename);
}

async function downloadArtworkPng(svg: SVGSVGElement | null, filename: string) {
  const xml=await artworkXml(svg);
  if(!xml)return;
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
      backgroundId: order.backgroundId,
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
                backgroundId={snap.backgroundId}
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
                {order.code} · {orderTitle(order)}
              </p>
              <p className="text-sm font-semibold text-[var(--dim)]">
                {order.variant} · Total {formatIDR(order.total)} · Pembayaran: {PAY_STATE_LABELS[order.payState]}
              </p>
              <OrderedItems order={order} />
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
                            ? "bg-tang text-ink"
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
          {includesProduct(order, "poster") && order.paymentStatus === "paid" && (
            <div className="mt-4 border-t border-dashed border-[var(--border)] pt-3">
              <div className="sr-only" aria-hidden>
                <ArtworkSvg
                  svgRef={exportRef}
                  template={templateForSnapshot(snap)}
                backgroundId={snap.backgroundId}
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
                Pembayaranmu sudah terverifikasi, jadi file final postermu terbuka. Poster fisik tetap diproduksi &amp; dikirim oleh tim kami.
              </p>
            </div>
          )}
          {includesProduct(order, "poster") && order.paymentStatus !== "paid" && order.orderStatus !== "cancelled" && (
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

/** Download a print-ready papercraft kit from the immutable order snapshot.
 * This is an admin-only workflow, reached through the admin order dashboard.
 * No production file is generated before payment is verified. */
function downloadPapercraftKit(order: OrderOut) {
  if (!includesProduct(order, "papercraft") || order.paymentStatus !== "paid") return;
  const template = templateForSnapshot({ templateId: order.templateId, customDef: order.customDef });
  const blob = buildPillowPdf({
    template,
    colors: order.colors,
    strokes: order.strokes,
    name: order.childName,
    message: order.message,
    nameColor: order.nameColor,
    brandName: "Bun & Fleur Kids",
    inkSave: false,
  }, { paper: "A4", production: true, qcStatus: "periksa-potongan-dan-warna" });
  downloadBlob(blob, `papercraft-3d-${order.code}.pdf`);
}

function AdminOrderCard({ order }: { order: OrderOut }) {
  const queryClient = useQueryClient();
  const [paymentReference, setPaymentReference] = useState("");
  const artworkRef = useRef<SVGSVGElement | null>(null);
  const proof = useMutation({ mutationFn: () => api.adminGetPaymentProof({ id: order.id }) });
  const [orderStatus, setOrderStatus] = useState<OrderOut["orderStatus"]>(order.orderStatus);
  const [resi, setResi] = useState(order.trackingNumber);
  const [ongkir, setOngkir] = useState(order.shippingCost == null ? "" : String(order.shippingCost));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: async () =>
      await api.updateOrder({
        id: order.id,
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
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["adminSalesReport"] });
      void queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] });
    },
  });
  const verify = useMutation({
    mutationFn: async (decision: "verify" | "reject" | "unmatched" | "refund") =>
      await api.verifyOrderPayment({ id: order.id, decision, paymentReference: order.shopeeUsername ? "" : paymentReference }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      setError("");
      setPaymentReference("");
      setOrderStatus(res.order.orderStatus);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["adminSalesReport"] });
      void queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] });
    },
  });
  const archive = useMutation({
    mutationFn: () => api.adminArchiveOrder({id:order.id}),
    onError: (e) => setError(e.message),
    onSuccess: () => {void queryClient.invalidateQueries({queryKey:["orders"]});void queryClient.invalidateQueries({queryKey:["adminSalesReport"]});void queryClient.invalidateQueries({queryKey:["adminAffiliates"]});},
  });
  const snap: ShopProject = {
    id: order.projectId,
    templateId: order.templateId,
    childName: order.childName,
      backgroundId: order.backgroundId,
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
            svgRef={artworkRef}
            message={snap.message}
            template={templateForSnapshot(snap)}
                backgroundId={snap.backgroundId}
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
            {order.code} · {orderTitle(order)}
          </p>
          <p className="text-sm font-semibold text-[var(--dim)]">
            {order.variant || "—"} · {new Date(order.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <OrderedItems order={order} />
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm font-semibold sm:grid-cols-2">
            <div><dt className="inline text-[var(--dim)]">Pemesan: </dt><dd className="inline">{order.customerName}</dd></div>
            {order.shopeeUsername && <div className="sm:col-span-2 rounded-xl bg-[#FFF0E5] p-3"><dt className="font-bold text-[#B93820]">Checkout Shopee</dt><dd className="break-all">Nama akun: {order.shopeeUsername}</dd></div>}
            <div><dt className="inline text-[var(--dim)]">WhatsApp: </dt><dd className="inline">{order.whatsapp}</dd></div>
            <div><dt className="inline text-[var(--dim)]">Email: </dt><dd className="inline">{order.email}</dd></div>
            <div><dt className="inline text-[var(--dim)]">Nama anak: </dt><dd className="inline">{order.childName.trim() || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-[var(--dim)]">Alamat: </dt><dd className="inline">{order.address}</dd></div>
            {order.notes && <div className="sm:col-span-2"><dt className="inline text-[var(--dim)]">Catatan: </dt><dd className="inline">{order.notes}</dd></div>}
            {order.gift&&<div className="sm:col-span-2 rounded-xl bg-[#FCF3DE] p-3 text-[#53682F]"><p className="font-extrabold">Pesanan hadiah — jangan sertakan harga dalam paket.</p><p>Untuk {order.gift.recipient} · Dari {order.gift.sender}</p><p className="whitespace-pre-wrap break-words">{order.gift.message}</p><button type="button" className="mt-2 rounded-full border px-3 py-2 text-xs font-bold" onClick={()=>{const g=order.gift;if(!g)return;const w=window.open("","_blank","width=650,height=500");if(!w)return;w.opener=null;const doc=w.document;doc.title="Kartu hadiah "+order.code;const body=doc.body;body.style.cssText="font-family:system-ui;text-align:center;color:#53682f;background:#fcf3de;padding:32px";for(const [tag,value] of [["h1","Hadiah kecil, kenangan besar."],["h2","Untuk "+g.recipient],["p",g.message],["p","Dari "+g.sender],["h3","Bun & Fleur Kids"]]){const el=doc.createElement(tag!);el.textContent=value!;el.style.whiteSpace="pre-wrap";body.appendChild(el);}w.print();}}>Cetak kartu ucapan</button></div>}
            <div><dt className="inline text-[var(--dim)]">Harga produk: </dt><dd className="inline">{formatIDR(order.productPrice)}</dd></div>
            {order.discountAmount > 0 && (
              <div><dt className="inline text-[var(--dim)]">Diskon {order.bundleName||order.couponCode}: </dt><dd className="inline">−{formatIDR(order.discountAmount)}</dd></div>
            )}
            <div><dt className="inline text-[var(--dim)]">Ongkir: </dt><dd className="inline">{order.shippingCost == null ? "belum dikonfirmasi" : formatIDR(order.shippingCost)}</dd></div>
            <div><dt className="inline text-[var(--dim)]">Total: </dt><dd className="inline font-display text-olive-deep">{formatIDR(order.total)}</dd></div>
            <div className="sm:col-span-2">
              <dt className="inline text-[var(--dim)]">{order.shopeeUsername ? "Shopee: " : "QRIS: "}</dt>
              <dd className="inline">
                {!order.shopeeUsername && <>kode unik {formatIDR(order.uniqueCode)} · total bayar <span className="font-display text-olive-deep">{formatIDR(order.payableTotal)}</span> ·{" "}</>}
                <span className="font-display">{PAY_STATE_LABELS[order.payState]}</span>
                {order.paymentConfirmedAt && ` · konfirmasi pelanggan ${new Date(order.paymentConfirmedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`}
              </dd>
            </div>
          </dl>
          <button type="button" disabled={order.paymentStatus !== "paid"} onClick={() => { void downloadArtworkSvg(artworkRef.current, `artwork-${order.code}.svg`); }} className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-bold ring-1 ring-[var(--border)] disabled:opacity-50">Unduh artwork SVG pesanan</button>
          {includesProduct(order, "papercraft") && (
            <div className="mt-3 rounded-2xl bg-[#EDF2E6] p-3 ring-1 ring-[var(--border)]">
              <p className="font-display text-sm font-bold text-olive-deep">Berkas Produksi Papercraft 3D</p>
              <p className="mt-1 text-xs font-semibold text-[var(--dim)]">
                Pola A4 depan-belakang, strip perekat, penyangga nama, dan petunjuk rakit dihasilkan
                dari warna dan desain pesanan yang tersimpan. Periksa cetak dan potongan sebelum dikirim.
              </p>
              <button type="button" disabled={order.paymentStatus !== "paid"}
                onClick={() => downloadPapercraftKit(order)}
                className="mt-2 rounded-full bg-olive px-4 py-2.5 font-display text-xs font-bold text-white disabled:opacity-50">
                {order.paymentStatus === "paid" ? "Unduh PDF Produksi Papercraft" : "PDF Produksi Terkunci sampai Lunas"}
              </button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Verifikasi pembayaran">
            <span className="font-display text-xs font-bold text-[var(--dim)]">{order.shopeeUsername ? "Verifikasi Shopee:" : "Verifikasi QRIS:"}</span>
            {["awaiting", "waiting_verification", "unmatched", "rejected"].includes(order.payState) && order.orderStatus !== "cancelled" && (
              <>
                {order.shopeeUsername ? <p className="text-xs font-semibold">Cocokkan nama akun, produk, jumlah, dan pembayaran di Shopee sebelum verifikasi.</p> : <label className="text-xs font-semibold">
                  Referensi mutasi QRIS
                  <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)}
                    maxLength={80} autoComplete="off" className="ml-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2" />
                </label>}
                <button type="button" disabled={verify.isPending || (order.shopeeUsername ? !["waiting_verification","unmatched"].includes(order.payState) : paymentReference.trim().length < 4)} onClick={() => {if (!order.shopeeUsername || window.confirm("Sudah cocok dan pembayaran di Shopee terverifikasi?")) verify.mutate("verify");}} className="rounded-full bg-olive px-4 py-2 font-display text-xs font-semibold text-white disabled:opacity-50">
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
            <button type="button" disabled={proof.isPending} onClick={() => proof.mutate()}
              className="rounded-full bg-white px-4 py-2 text-xs font-bold ring-1 ring-[var(--border)]">Lihat bukti pelanggan</button>
            {proof.isError && <p role="alert" className="text-xs">{proof.error.message}</p>}
            {proof.isSuccess && (proof.data.proof
              ? <img className="max-h-80 max-w-full object-contain" alt="Bukti transfer dari pelanggan"
                  src={`data:${proof.data.proof.mime};base64,${proof.data.proof.data}`} />
              : <p className="text-xs">Belum ada bukti yang diunggah.</p>)}
            {order.payState === "verified" && (
              <button type="button" disabled={verify.isPending} onClick={() => verify.mutate("refund")} className="rounded-full bg-[var(--surface)] px-4 py-2 font-display text-xs font-bold ring-1 ring-[var(--border)] disabled:opacity-50">
                Catat Refund Terkirim
              </button>
            )}
            <span className="text-xs font-semibold text-[var(--dim)]">
              Cocokkan nominal {formatIDR(order.payableTotal)} dengan mutasi QRIS {QRIS_MERCHANT} (NMID {QRIS_NMID}) sebelum memverifikasi — konfirmasi pelanggan bukan bukti pembayaran.
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-dashed border-[var(--border)] pt-3">
        <p className="text-sm font-semibold">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
        {order.paymentStatus !== "paid" && <button type="button" disabled={archive.isPending} onClick={()=>{if(window.confirm("Hapus pesanan dari daftar aktif? Riwayat transaksi tetap disimpan."))archive.mutate();}} className="rounded-full border border-berry px-4 py-2 text-xs font-bold text-berry disabled:opacity-50">Hapus pesanan</button>}
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
          <label htmlFor={`ongkir-${order.id}`} className="block font-display text-xs font-bold text-[var(--dim)]">Ongkir pesanan (otomatis untuk pesanan baru)</label>
          <input
            id={`ongkir-${order.id}`}
            disabled={order.shippingCost !== null}
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

export function AdminOrders({ scope = "all" }: { scope?: "all" | "payment" | "fulfillment" }) {
  const [page, setPage] = useState(0);
  const orders = useQuery({
    queryKey: ["orders", scope, page],
    queryFn: () => api.listOrders({ limit: 20, offset: page * 20, scope }),
    refetchOnWindowFocus: true,
  });
  if (orders.isPending) return <p className="font-display font-bold">Memuat pesanan…</p>;
  if (orders.error) return <div role="alert"><p className="font-display font-bold">Pesanan tidak bisa dimuat: {orders.error.message}</p><button type="button" onClick={() => void orders.refetch()} className="mt-2 rounded-full border px-4 py-2 text-sm font-bold">Coba lagi</button></div>;
  const { orders: list, orderCount, paidCount, paymentReviewCount, netProductRevenue } = orders.data;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Total pesanan", orderCount],
          ["Pesanan lunas", paidCount],
          ["Menunggu verifikasi", paymentReviewCount],
          ["Pendapatan produk neto", formatIDR(netProductRevenue)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-sage-soft p-3">
            <dt className="text-xs font-bold text-olive-deep">{label}</dt>
            <dd className="mt-1 break-words font-display text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end"><button type="button" disabled={orders.isFetching} onClick={() => void orders.refetch()} className="rounded-full border px-4 py-2 text-sm font-bold">Muat ulang pesanan</button></div>
      {list.length === 0 && <p className="text-sm text-[var(--dim)]">Belum ada pesanan pada halaman ini.</p>}
      {list.map((order) => <AdminOrderCard key={order.id} order={order} />)}
      {orderCount > 20 && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}
            className="rounded-full border px-4 text-sm font-bold disabled:opacity-40">Sebelumnya</button>
          <span className="text-sm">Halaman {page + 1}</span>
          <button type="button" disabled={(page + 1) * 20 >= orderCount} onClick={() => setPage(page + 1)}
            className="rounded-full border px-4 text-sm font-bold disabled:opacity-40">Berikutnya</button>
        </div>
      )}
    </div>
  );
}

export function AdminProductPrices() {
  const queryClient = useQueryClient();
  const config = useShopConfig();
  const [productId, setProductId] = useState<ProductId>("poster");
  const [amount, setAmount] = useState("");
  const changePrice = useMutation({
    mutationFn: (price: number) => api.adminSetProductPrice({ productId, price }),
    onSuccess: () => {
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["shopConfig"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
  return (
    <section className="mt-5 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]" aria-label="Harga katalog">
      <h2 className="font-display text-lg font-bold">Harga katalog</h2>
      <p className="text-sm text-[var(--dim)]">Harga baru berlaku untuk checkout berikutnya.</p>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault();
        changePrice.mutate(Number(amount));
      }}>
        <label className="grid gap-1 text-sm font-bold">Produk
          <select value={productId} onChange={(event) => { setProductId(event.target.value as ProductId); setAmount(""); changePrice.reset(); }}
            className="rounded-xl bg-[var(--bg)] px-3 py-2 ring-1 ring-[var(--border)]">
            {config.products.map((product) => (
              <option key={product.id} value={product.id}>{PRODUCT_META[product.id].title} · {formatIDR(product.basePrice)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold">Harga baru (Rp)
          <input type="number" required min={1000} max={10000000} step={1} value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-40 rounded-xl bg-[var(--bg)] px-3 py-2 ring-1 ring-[var(--border)]" />
        </label>
        <button type="submit" disabled={changePrice.isPending} className="rounded-full bg-olive px-4 py-2 text-sm font-bold text-white">
          Simpan harga
        </button>
      </form>
      {changePrice.isError && <p role="alert" className="mt-2 text-sm text-berry">{changePrice.error.message}</p>}
      {changePrice.isSuccess && <p role="status" className="mt-2 text-sm text-olive-deep">Harga tersimpan.</p>}
    </section>
  );
}
