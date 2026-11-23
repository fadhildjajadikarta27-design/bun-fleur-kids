// Shared data model for Bun & Fleur Kids.
//
// ONE region-color map per project drives everything:
//   - the SVG coloring page (regions fill with colors[regionId])
//   - the 3D preview (every mesh face carries a regionId)
//   - the papercraft PDF (every net piece / decal carries a regionId)
// That is what guarantees the dinosaur a child colors blue/yellow/orange
// is the same blue/yellow/orange in 3D and on paper.

export type Pt = [number, number];
export type V3 = [number, number, number];

export type SvgEl =
  | { t: "path"; d: string }
  | { t: "circle"; cx: number; cy: number; r: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; rx?: number };

export interface RegionDef {
  id: string;
  label: string;
  els: SvgEl[];
}

export interface DetailEl {
  el: SvgEl;
  fill?: string;
  stroke?: string;
  sw?: number;
}

/** A single 3D face; `region` links it back to the coloring page. */
export interface Face {
  pts: V3[];
  region: string;
  /** Papercraft component this face belongs to (body, head, tail…). */
  part?: string;
}

/** One papercraft piece on the printed page (coordinates in mm). */
export interface NetDecal {
  region?: string;
  fill?: string;
  polygon?: Pt[];
  circle?: { cx: number; cy: number; r: number };
  /** A full SVG path (template artwork) placed with uniform scale + offset, in mm. */
  pathD?: string;
  pathScale?: number;
  pathTx?: number;
  pathTy?: number;
}

/** One unfolded mesh face inside a net piece (engine-generated nets). */
export interface NetFace {
  polygon: Pt[];
  region: string;
  /** Id of the 3D mesh face this was unfolded from (coverage checks). */
  src?: string;
}

export type FoldLine = { a: Pt; b: Pt; kind: "mountain" | "valley" };

export interface NetPiece {
  id: string;
  label: string;
  region: string;
  polygon: Pt[];
  /** Glue tabs (light polygons folded under neighbours). */
  tabs?: Pt[][];
  /** Dashed fold lines inside / on the edge of this piece. */
  folds?: [Pt, Pt][];
  decals?: NetDecal[];
  /** Where the child's name is printed on this piece (polygon bounds). */
  nameplate?: Pt[];
  /* ---- Engine v2 fields: present when the piece was produced by the
     mesh unfolder in papercraft.ts. Renderers prefer these. ---- */
  /** Unfolded mesh faces with per-face regions (supersedes `polygon`). */
  faces?: NetFace[];
  /** Solid cut contour segments. */
  cutEdges?: [Pt, Pt][];
  /** Fold lines classified mountain / valley from the 3D dihedral. */
  foldLines?: FoldLine[];
  /** Numbered joining edges: both sides of a cut 3D edge share a number. */
  edgeNumbers?: { x: number; y: number; n: number }[];
  /** Anchor point for the printed piece label. */
  labelAt?: Pt;
  /** Papercraft component this piece belongs to. */
  partId?: string;
  /** Packer must not rotate this piece (it carries the child's name). */
  noRotate?: boolean;
}

export interface NetDef {
  orientation: "portrait" | "landscape";
  widthMm: number;
  heightMm: number;
  pieces: NetPiece[];
  steps: string[];
  /** Engine v2: pieces packed onto one or more physical sheets. */
  pages?: { pieces: NetPiece[] }[];
  /** Engine v2: true when this net came from the mesh unfolder. */
  engine?: boolean;
}

export interface NetOptions {
  /** Net scale adjustment from the Template Manager (default 100). */
  scalePct?: number;
  /** Glue tab depth in mm (default 7). */
  tabDepthMm?: number;
  /** Horizontal shift of the printed name on the nameplate, in mm. */
  nameOffsetMm?: number;
  /** Physical paper the net is packed onto (default A4 portrait). */
  paper?: "A4" | "A3";
}

export interface TemplateDef {
  id: string;
  name: string;
  collection: string;
  blurb: string;
  age: string;
  ageBand: string;
  difficulty: 1 | 2 | 3;
  featured?: boolean;
  /** True for mix-and-match characters from "Buat Karakter Sendiri":
   * front-view artwork only — Bantal Kertas & Standee prints, no 3D mesh. */
  custom?: boolean;
  viewBox: [number, number];
  regions: RegionDef[];
  details: DetailEl[];
  /** Name plaque position inside the SVG artwork (SVG units). */
  label: { x: number; y: number; w: number; h: number };
  /**
   * Regions that inherit another region's color until colored themselves
   * (e.g. the dino's snout follows the head, its feet follow the legs).
   * Keeps older saved projects rendering consistently.
   */
  regionFallbacks?: Record<string, string>;
  buildModel: () => Face[];
  buildNet: (opts?: NetOptions) => NetDef;
  /** Shape-preserving papercraft components (engine v2), when available. */
  buildParts?: () => import("./papercraft").CraftPart[];
}

/** Resolve a region's effective color, honoring region fallbacks. */
export function resolveColor(
  t: TemplateDef,
  colors: Record<string, string>,
  region: string,
): string {
  const direct = colors[region];
  if (direct) return direct;
  const fb = t.regionFallbacks?.[region];
  if (fb && colors[fb]) return colors[fb]!;
  return UNCOLORED;
}

/* ------------------------------------------------------------------ */
/* Geometry builders (unit space roughly -1..1, y up)                  */
/* ------------------------------------------------------------------ */

function xf(
  faces: Face[],
  o: {
    t?: V3;
    r?: V3;
    s?: V3;
  } = {},
): Face[] {
  const [sx, sy, sz] = o.s ?? [1, 1, 1];
  const [rx, ry, rz] = o.r ?? [0, 0, 0];
  const [tx, ty, tz] = o.t ?? [0, 0, 0];
  const cx = Math.cos(rx), sxn = Math.sin(rx);
  const cy = Math.cos(ry), syn = Math.sin(ry);
  const cz = Math.cos(rz), szn = Math.sin(rz);
  return faces.map((f) => ({
    region: f.region,
    pts: f.pts.map(([x0, y0, z0]) => {
      let x = x0 * sx, y = y0 * sy, z = z0 * sz;
      // rotate X
      let y1 = y * cx - z * sxn, z1 = y * sxn + z * cx;
      y = y1; z = z1;
      // rotate Y
      let x2 = x * cy + z * syn, z2 = -x * syn + z * cy;
      x = x2; z = z2;
      // rotate Z
      let x3 = x * cz - y * szn, y3 = x * szn + y * cz;
      x = x3; y = y3;
      return [x + tx, y + ty, z + tz] as V3;
    }),
  }));
}

export function box(
  w: number,
  h: number,
  d: number,
  region: string | Record<string, string>,
  o: { t?: V3; r?: V3; s?: V3 } = {},
): Face[] {
  const reg = (k: string) =>
    typeof region === "string" ? region : (region[k] ?? region.all ?? "body");
  const x = w / 2, y = h / 2, z = d / 2;
  const faces: Face[] = [
    { region: reg("front"), pts: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    { region: reg("back"), pts: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
    { region: reg("right"), pts: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] },
    { region: reg("left"), pts: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    { region: reg("top"), pts: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] },
    { region: reg("bottom"), pts: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] },
  ];
  return xf(faces, o);
}

export function ball(
  r: number,
  region: string,
  o: { t?: V3; r?: V3; s?: V3 } = {},
  wSeg = 12,
  hSeg = 9,
): Face[] {
  const faces: Face[] = [];
  const pt = (i: number, j: number): V3 => {
    const phi = (j / hSeg) * Math.PI; // 0 top
    const theta = (i / wSeg) * Math.PI * 2;
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    ];
  };
  for (let j = 0; j < hSeg; j++) {
    for (let i = 0; i < wSeg; i++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      if (j === 0) faces.push({ region, pts: [a, c, d] });
      else if (j === hSeg - 1) faces.push({ region, pts: [a, b, c] });
      else faces.push({ region, pts: [a, b, c, d] });
    }
  }
  return xf(faces, o);
}

export function cyl(
  rTop: number,
  rBottom: number,
  h: number,
  region: string,
  o: { t?: V3; r?: V3; s?: V3 } = {},
  seg = 14,
  capRegion?: string,
): Face[] {
  const faces: Face[] = [];
  const y = h / 2;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (r: number, yy: number, a: number): V3 => [
      r * Math.cos(a),
      yy,
      r * Math.sin(a),
    ];
    faces.push({
      region,
      pts: [p(rBottom, -y, a0), p(rBottom, -y, a1), p(rTop, y, a1), p(rTop, y, a0)],
    });
    if (capRegion) {
      faces.push({ region: capRegion, pts: [[0, y, 0], p(rTop, y, a1), p(rTop, y, a0)] });
      faces.push({ region: capRegion, pts: [[0, -y, 0], p(rBottom, -y, a0), p(rBottom, -y, a1)] });
    }
  }
  return xf(faces, o);
}

export function cone(
  r: number,
  h: number,
  region: string,
  o: { t?: V3; r?: V3; s?: V3 } = {},
  seg = 14,
): Face[] {
  return cyl(0.001, r, h, region, o, seg);
}

/** A flat extruded polygon (prism) — handy for fins, ears, roofs. */
export function prism(
  poly: Pt[],
  depth: number,
  region: string,
  o: { t?: V3; r?: V3; s?: V3 } = {},
): Face[] {
  const z = depth / 2;
  const front: V3[] = poly.map(([x, y]) => [x, y, z] as V3);
  const back: V3[] = poly.map(([x, y]) => [x, y, -z] as V3).reverse();
  const faces: Face[] = [
    { region, pts: front },
    { region, pts: back },
  ];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    faces.push({
      region,
      pts: [
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0], b[1], -z],
        [a[0], a[1], -z],
      ],
    });
  }
  return xf(faces, o);
}

/** Mirror a model along X (for profile characters drawn facing right). */
export function mirrorX(faces: Face[]): Face[] {
  return faces.map((f) => ({
    region: f.region,
    pts: f.pts.map(([x, y, z]) => [-x, y, z] as V3).reverse(),
  }));
}

/** The personalized nameplate: a little plaque standing at the front. */
export function nameplate(w = 1.15, h = 0.34): Face[] {
  const faces = box(w, h, 0.1, {
    front: "__nameplate",
    back: "plate",
    top: "plate",
    bottom: "plate",
    left: "plate",
    right: "plate",
  }, { t: [0, -1.12 + h / 2, 0.68], r: [-0.12, 0, 0] });
  return faces;
}

/* ------------------------------------------------------------------ */
/* SVG element → path data (for PDF + PNG export)                      */
/* ------------------------------------------------------------------ */

export function elToPath(el: SvgEl): string {
  switch (el.t) {
    case "path":
      return el.d;
    case "circle": {
      const { cx, cy, r } = el;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case "ellipse": {
      const { cx, cy, rx, ry } = el;
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    case "rect": {
      const { x, y, w, h } = el;
      const r = Math.min(el.rx ?? 0, w / 2, h / 2);
      if (!r) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
      return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Palettes & name fonts                                               */
/* ------------------------------------------------------------------ */

export interface PaletteColor {
  name: string;
  hex: string;
}

export const VIBRANT: PaletteColor[] = [
  { name: "Merah Ceri", hex: "#E63946" },
  { name: "Jingga", hex: "#F4842B" },
  { name: "Kuning Cerah", hex: "#FFC93C" },
  { name: "Hijau Limau", hex: "#8AC926" },
  { name: "Hijau Daun", hex: "#3FA34D" },
  { name: "Hijau Toska", hex: "#17A398" },
  { name: "Biru Langit", hex: "#3E92CC" },
  { name: "Biru Tua", hex: "#2B50C8" },
  { name: "Ungu Anggur", hex: "#7B4BA8" },
  { name: "Permen Karet", hex: "#EF6FA5" },
  { name: "Cokelat", hex: "#8A5A33" },
  { name: "Abu Gelap", hex: "#3B3230" },
];

export const PASTEL: PaletteColor[] = [
  { name: "Persik", hex: "#FFB997" },
  { name: "Krem Mentega", hex: "#FFE29A" },
  { name: "Mint Segar", hex: "#B8E3C5" },
  { name: "Sage", hex: "#C9DDBB" },
  { name: "Biru Bayi", hex: "#AEDCF5" },
  { name: "Biru Pucat", hex: "#B7C9F2" },
  { name: "Lilak", hex: "#DCC7F0" },
  { name: "Mawar Susu", hex: "#F7C6D9" },
  { name: "Aprikot", hex: "#FFD3B6" },
  { name: "Vanila", hex: "#F6E8C8" },
  { name: "Abu Awan", hex: "#D8D5CE" },
  { name: "Putih Salju", hex: "#FFFFFF" },
];

export const ALL_COLORS: PaletteColor[] = [...VIBRANT, ...PASTEL];

export interface NameFont {
  id: string;
  label: string;
  family: string;
}

export const NAME_FONTS: NameFont[] = [
  { id: "baloo", label: "Bulat Besar", family: "'Baloo 2', sans-serif" },
  { id: "fredoka", label: "Gelembung Lembut", family: "'Fredoka', sans-serif" },
  { id: "patrick", label: "Tulisan Tangan", family: "'Patrick Hand', cursive" },
  { id: "caveat", label: "Tulisan Krayon", family: "'Caveat', cursive" },
];

export const NAME_COLORS: PaletteColor[] = [
  { name: "Merah Beri", hex: "#E4572E" },
  { name: "Biru Laut", hex: "#2B50C8" },
  { name: "Hijau Hutan", hex: "#2E7D46" },
  { name: "Anggur", hex: "#7B4BA8" },
  { name: "Permen Karet", hex: "#D6336C" },
  { name: "Kakao", hex: "#6B4423" },
];

export const INK = "#111111";
export const UNCOLORED = "#FFFFFF";

/* ------------------- Hitam putih (coloring pages) ------------------- */
// Semua karya koleksi tampil sebagai halaman mewarnai hitam putih:
// bidang putih kosong dengan garis tepi hitam tebal. Detail kecil bawaan
// template (bintang, pipi, hidung) juga diubah ke hitam/putih/abu di sini
// supaya tidak ada warna contoh yang tampil sebelum anak mewarnai.
// Warna hanya muncul dari peta warna milik anak sendiri.

function hexParts(c: string): { r: number; g: number; b: number; a?: string } | null {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: m[2] };
}

function luminance(c: string): number | null {
  const p = hexParts(c);
  if (!p) return null;
  return (0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b) / 255;
}

function isSaturatedColor(c: string): boolean {
  const p = hexParts(c);
  if (!p || p.a) return false;
  return Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b) > 36;
}

/** Fill warna apa pun → hitam (gelap), putih (terang/berwarna), atau abu alfa (bayangan). */
export function toMonoFill(c: string | undefined): string | undefined {
  if (!c || c === "none") return c;
  const p = hexParts(c);
  if (!p) return "#111111";
  if (p.a) return `#111111${p.a}`;
  const lum = luminance(c) ?? 0;
  if (lum > 0.92) return "#FFFFFF";
  if (lum < 0.25) return "#111111";
  return "#FFFFFF";
}

/** Stroke warna apa pun → hitam; putih tetap putih. */
export function toMonoStroke(c: string | undefined): string | undefined {
  if (!c || c === "none") return c;
  const lum = luminance(c);
  if (lum != null && lum > 0.92) return "#FFFFFF";
  return "#111111";
}

/**
 * Ubah daftar detail template menjadi hitam putih. Detail yang tadinya
 * berwarna (pipi merah muda, bintang kuning) menjadi bidang putih
 * bergaris hitam, jadi tetap terlihat sebagai bagian halaman mewarnai
 * dan tidak tampil sebagai warna contoh.
 */
export function monochromeDetails(details: DetailEl[]): DetailEl[] {
  return details.map((d) => {
    const fill = toMonoFill(d.fill);
    let stroke = toMonoStroke(d.stroke);
    let sw = d.sw;
    if (d.fill && isSaturatedColor(d.fill) && fill === "#FFFFFF" && (!stroke || stroke === "none")) {
      stroke = "#111111";
      sw = d.sw ?? 3;
    }
    return { ...d, fill, stroke, sw };
  });
}

/** Blend a hex color toward white (for ink-saving print mode). */
export function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

export function shade(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}
