// "Buat Karakter Sendiri": a mix-and-match character builder.
//
// The child composes a character from predefined, pre-validated parts —
// a base body, ears/horns, a tail, an eye style, and one accessory. Every
// part is its own colorable region with a STABLE region id (badan, perut,
// telinga, ekor, mata, aksesori), so a saved project's color map keeps
// working even when the part combination is edited later.
//
// The composed artwork is a normal TemplateDef, so it flows through the
// exact same pipeline as catalog characters: the coloring studio, the
// name personalization, Kreasiku, and the prints whose silhouette is
// traced from the artwork itself (Bantal Kertas + Standee). Custom
// characters deliberately have NO 3D mesh: buildModel returns no faces
// and the app labels them as front-view characters instead of faking one.

import type { DetailEl, NetDef, RegionDef, SvgEl, TemplateDef } from "./model";
import { INK, monochromeDetails } from "./model";

export interface PartOption {
  id: string;
  label: string;
}

export interface CustomDef {
  name: string;
  base: string;
  ears: string;
  tail: string;
  eyes: string;
  accessory: string;
}

export const CUSTOM_BASES: PartOption[] = [
  { id: "bulat", label: "Bulat" },
  { id: "lonjong", label: "Lonjong Tinggi" },
  { id: "persegi", label: "Kotak Lembut" },
  { id: "tetes", label: "Tetes Air" },
];

export const CUSTOM_EARS: PartOption[] = [
  { id: "none", label: "Tanpa Telinga" },
  { id: "kucing", label: "Telinga Kucing" },
  { id: "beruang", label: "Telinga Beruang" },
  { id: "kelinci", label: "Telinga Kelinci" },
  { id: "tanduk", label: "Tanduk Kecil" },
];

export const CUSTOM_TAILS: PartOption[] = [
  { id: "none", label: "Tanpa Ekor" },
  { id: "melengkung", label: "Ekor Melengkung" },
  { id: "bulat", label: "Ekor Bulat" },
  { id: "gelombang", label: "Ekor Bergelombang" },
];

export const CUSTOM_EYES: PartOption[] = [
  { id: "bulat", label: "Mata Bulat" },
  { id: "besar", label: "Mata Besar Berbinar" },
  { id: "sipit", label: "Mata Sipit Senang" },
];

export const CUSTOM_ACCESSORIES: PartOption[] = [
  { id: "none", label: "Tanpa Aksesori" },
  { id: "topi", label: "Topi Pesta" },
  { id: "pita", label: "Pita" },
  { id: "mahkota", label: "Mahkota" },
  { id: "bintang", label: "Bintang di Perut" },
];

export const DEFAULT_CUSTOM_DEF: CustomDef = {
  name: "",
  base: "bulat",
  ears: "beruang",
  tail: "melengkung",
  eyes: "besar",
  accessory: "pita",
};

/** Cheerful per-region colors used only for the builder's live preview. */
export const CUSTOM_SAMPLE_COLORS: Record<string, string> = {
  badan: "#8AC926",
  perut: "#FFE29A",
  telinga: "#F4842B",
  ekor: "#3FA34D",
  mata: "#3B3230",
  aksesori: "#EF6FA5",
};

function pick(list: PartOption[], v: unknown, fallback: string): string {
  return typeof v === "string" && list.some((o) => o.id === v) ? v : fallback;
}

/** Parse + validate the JSON stored in a project's customDef column. */
export function parseCustomDef(raw: string | undefined | null): CustomDef | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<CustomDef>;
    if (!o || typeof o !== "object") return null;
    return {
      name: typeof o.name === "string" ? o.name.slice(0, 24) : "",
      base: pick(CUSTOM_BASES, o.base, "bulat"),
      ears: pick(CUSTOM_EARS, o.ears, "none"),
      tail: pick(CUSTOM_TAILS, o.tail, "none"),
      eyes: pick(CUSTOM_EYES, o.eyes, "bulat"),
      accessory: pick(CUSTOM_ACCESSORIES, o.accessory, "none"),
    };
  } catch {
    return null;
  }
}

/* --------------------------- Part geometry --------------------------- */

interface BaseSpec {
  body: SvgEl[];
  feet: SvgEl[];
  belly: SvgEl;
  earL: [number, number];
  earR: [number, number];
  tail: [number, number];
  topY: number;
}

const BASES: Record<string, BaseSpec> = {
  bulat: {
    body: [{ t: "ellipse", cx: 240, cy: 185, rx: 100, ry: 92 }],
    feet: [
      { t: "ellipse", cx: 193, cy: 280, rx: 30, ry: 13 },
      { t: "ellipse", cx: 287, cy: 280, rx: 30, ry: 13 },
    ],
    belly: { t: "ellipse", cx: 240, cy: 218, rx: 52, ry: 46 },
    earL: [183, 108], earR: [297, 108], tail: [336, 218], topY: 96,
  },
  lonjong: {
    body: [{ t: "ellipse", cx: 240, cy: 182, rx: 82, ry: 106 }],
    feet: [
      { t: "ellipse", cx: 202, cy: 282, rx: 27, ry: 12 },
      { t: "ellipse", cx: 278, cy: 282, rx: 27, ry: 12 },
    ],
    belly: { t: "ellipse", cx: 240, cy: 218, rx: 45, ry: 54 },
    earL: [182, 94], earR: [298, 94], tail: [318, 222], topY: 80,
  },
  persegi: {
    body: [{ t: "rect", x: 152, y: 102, w: 176, h: 172, rx: 52 }],
    feet: [
      { t: "ellipse", cx: 194, cy: 280, rx: 29, ry: 13 },
      { t: "ellipse", cx: 286, cy: 280, rx: 29, ry: 13 },
    ],
    belly: { t: "ellipse", cx: 240, cy: 216, rx: 50, ry: 44 },
    earL: [184, 110], earR: [296, 110], tail: [324, 226], topY: 104,
  },
  tetes: {
    body: [{
      t: "path",
      d: "M240 64 C266 108 320 148 320 204 C320 256 285 286 240 286 C195 286 160 256 160 204 C160 148 214 108 240 64 Z",
    }],
    feet: [
      { t: "ellipse", cx: 200, cy: 288, rx: 27, ry: 11 },
      { t: "ellipse", cx: 280, cy: 288, rx: 27, ry: 11 },
    ],
    belly: { t: "ellipse", cx: 240, cy: 224, rx: 46, ry: 40 },
    earL: [196, 124], earR: [284, 124], tail: [316, 232], topY: 66,
  },
};

function earEls(kind: string, L: [number, number], R: [number, number]): SvgEl[] {
  const [lx, ly] = L;
  const [rx, ry] = R;
  switch (kind) {
    case "kucing":
      return [
        { t: "path", d: `M${lx - 24} ${ly + 16} L${lx - 6} ${ly - 36} L${lx + 18} ${ly + 4} Z` },
        { t: "path", d: `M${rx + 24} ${ry + 16} L${rx + 6} ${ry - 36} L${rx - 18} ${ry + 4} Z` },
      ];
    case "beruang":
      return [
        { t: "circle", cx: lx, cy: ly - 4, r: 23 },
        { t: "circle", cx: rx, cy: ry - 4, r: 23 },
      ];
    case "kelinci":
      return [
        { t: "ellipse", cx: lx, cy: ly - 42, rx: 14, ry: 42 },
        { t: "ellipse", cx: rx, cy: ry - 42, rx: 14, ry: 42 },
      ];
    case "tanduk":
      return [
        { t: "path", d: `M${lx - 22} ${ly + 12} C${lx - 30} ${ly - 18} ${lx - 16} ${ly - 34} ${lx + 4} ${ly - 40} C${lx + 2} ${ly - 20} ${lx + 8} ${ly - 2} ${lx + 18} ${ly + 8} Z` },
        { t: "path", d: `M${rx + 22} ${ry + 12} C${rx + 30} ${ry - 18} ${rx + 16} ${ry - 34} ${rx - 4} ${ry - 40} C${rx - 2} ${ry - 20} ${rx - 8} ${ry - 2} ${rx - 18} ${ry + 8} Z` },
      ];
    default:
      return [];
  }
}

function tailEls(kind: string, A: [number, number]): SvgEl[] {
  const [tx, ty] = A;
  switch (kind) {
    case "melengkung":
      return [{
        t: "path",
        d: `M${tx - 8} ${ty + 20} C${tx + 40} ${ty + 18} ${tx + 54} ${ty - 30} ${tx + 34} ${ty - 64} C${tx + 52} ${ty - 28} ${tx + 38} ${ty - 2} ${tx - 4} ${ty} Z`,
      }];
    case "bulat":
      return [{ t: "circle", cx: tx + 16, cy: ty, r: 21 }];
    case "gelombang":
      return [{
        t: "path",
        d: `M${tx - 6} ${ty - 8} C${tx + 38} ${ty - 24} ${tx + 52} ${ty + 10} ${tx + 20} ${ty + 30} C${tx + 38} ${ty + 12} ${tx + 30} ${ty + 2} ${tx - 2} ${ty + 10} Z`,
      }];
    default:
      return [];
  }
}

function eyeEls(kind: string): SvgEl[] {
  switch (kind) {
    case "besar":
      return [
        { t: "circle", cx: 208, cy: 170, r: 14 },
        { t: "circle", cx: 272, cy: 170, r: 14 },
      ];
    case "sipit":
      return [
        { t: "path", d: "M195 172 Q208 156 221 172 Q208 165 195 172 Z" },
        { t: "path", d: "M259 172 Q272 156 285 172 Q272 165 259 172 Z" },
      ];
    default:
      return [
        { t: "circle", cx: 208, cy: 168, r: 8.5 },
        { t: "circle", cx: 272, cy: 168, r: 8.5 },
      ];
  }
}

function starPath(cx: number, cy: number, rO: number, rI: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function accessoryEls(kind: string, topY: number): SvgEl[] {
  switch (kind) {
    case "topi":
      return [
        { t: "path", d: `M216 ${topY + 8} L240 ${topY - 46} L264 ${topY + 8} Z` },
        { t: "circle", cx: 240, cy: topY - 50, r: 9 },
      ];
    case "pita": {
      const t = topY + 4;
      return [
        { t: "path", d: `M276 ${t} L248 ${t - 16} L248 ${t + 18} Z` },
        { t: "path", d: `M276 ${t} L304 ${t - 16} L304 ${t + 18} Z` },
        { t: "circle", cx: 276, cy: t, r: 8.5 },
      ];
    }
    case "mahkota":
      return [{
        t: "path",
        d: `M208 ${topY + 10} L208 ${topY - 20} L226 ${topY - 4} L240 ${topY - 24} L254 ${topY - 4} L272 ${topY - 20} L272 ${topY + 10} Z`,
      }];
    case "bintang":
      return [{ t: "path", d: starPath(240, 218, 27, 11) }];
    default:
      return [];
  }
}

/* ------------------------- Template builder -------------------------- */

const cache = new Map<string, TemplateDef>();

export function buildCustomTemplate(def: CustomDef): TemplateDef {
  const key = JSON.stringify(def);
  const hit = cache.get(key);
  if (hit) return hit;

  const base = BASES[def.base] ?? BASES.bulat!;
  const regions: RegionDef[] = [];
  const tail = tailEls(def.tail, base.tail);
  if (tail.length) regions.push({ id: "ekor", label: "Ekor", els: tail });
  const ears = earEls(def.ears, base.earL, base.earR);
  if (ears.length) regions.push({ id: "telinga", label: "Telinga / Tanduk", els: ears });
  regions.push({ id: "badan", label: "Badan", els: [...base.body, ...base.feet] });
  regions.push({ id: "perut", label: "Perut", els: [base.belly] });
  regions.push({ id: "mata", label: "Mata", els: eyeEls(def.eyes) });
  const acc = accessoryEls(def.accessory, base.topY);
  if (acc.length) regions.push({ id: "aksesori", label: "Aksesori", els: acc });

  const details: DetailEl[] = [
    { el: { t: "ellipse", cx: 240, cy: 300, rx: 150, ry: 10 }, fill: "#3B323014" },
    { el: { t: "ellipse", cx: 240, cy: 188, rx: 8, ry: 6 }, fill: "#D6336C" },
    { el: { t: "path", d: "M227 197 Q240 207 253 197" }, stroke: INK, sw: 4 },
    { el: { t: "circle", cx: 180, cy: 194, r: 10 }, fill: "#F2A0B5" },
    { el: { t: "circle", cx: 300, cy: 194, r: 10 }, fill: "#F2A0B5" },
  ];
  if (def.eyes === "besar") {
    details.push(
      { el: { t: "circle", cx: 213, cy: 165, r: 4.5 }, fill: "#FFFFFF" },
      { el: { t: "circle", cx: 277, cy: 165, r: 4.5 }, fill: "#FFFFFF" },
    );
  }
  // Karakter buatan sendiri juga mulai hitam putih, sama seperti katalog.
  const monoDetails = monochromeDetails(details);

  const name = def.name.trim() || "Karakterku";
  const t: TemplateDef = {
    id: `custom-${def.base}-${def.ears}-${def.tail}-${def.eyes}-${def.accessory}`,
    name,
    collection: "custom",
    blurb: "Karakter buatan sendiri — campuran bagian pilihanmu.",
    age: "2–5 tahun",
    ageBand: "2-3th",
    difficulty: 2,
    custom: true,
    viewBox: [480, 360],
    regions,
    details: monoDetails,
    label: { x: 150, y: 312, w: 180, h: 38 },
    // No 3D mesh and no mesh net for custom characters — by design, and
    // the UI says so. Prints use the artwork-traced formats instead.
    buildModel: () => [],
    buildNet: (): NetDef => ({
      orientation: "portrait",
      widthMm: 210,
      heightMm: 297,
      pieces: [],
      steps: [],
    }),
  };
  cache.set(key, t);
  return t;
}
