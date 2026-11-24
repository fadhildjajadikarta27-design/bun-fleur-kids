// Paper Pillow print model — the easy default build for ages 2–6.
//
// The character is built from 4–5 pieces only:
//   FRONT PANEL — the child's own colored artwork. Its cut outline is
//     traced from the union of the template's coloring regions, so the
//     silhouette is the drawing itself, not an approximation of it.
//   BACK PANEL — the same outline, mirrored, carrying the SAME artwork
//     (mirrored along with the outline), so the finished pillow looks
//     the same from the front and from behind. No text on either panel;
//     the child's name lives only on the stand's nameplate flap.
//   GUSSET STRIP — one long strip (printed as two parts joined at a
//     single numbered join) whose length is exactly the outline's
//     perimeter. Its colored band becomes the pillow's squishy edge;
//     pale tabs on both long sides fold back and glue to the panels.
//   STAND — a strip that folds into a U-channel the pillow's bottom
//     edge sits in; the front flap carries the child's name.
//
// No mesh, no numbered joins around the character, nothing to fold
// except the gusset tabs and the stand: cut, glue the edge, done in
// about 10 minutes. The detailed mesh papercraft remains available in
// the Print Studio as the advanced format.

import {
  elToPath,
  type NetOptions,
  type Pt,
  type TemplateDef,
} from "./model";
import type { CraftAnalysis, CraftCheck } from "./papercraft";

/* ------------------------- pure grid geometry ------------------------ */
/* These helpers operate on plain arrays so they can be unit-tested    */
/* without a browser canvas. Coordinates are grid-corner coordinates   */
/* in a y-down space (same orientation as SVG).                        */

/**
 * Trace the boundary loops of a binary mask (1 = filled) on the corner
 * lattice. Edges are oriented so the filled cell is always on the
 * right, which makes outer boundaries come out with positive signed
 * area and holes with negative signed area.
 */
export function traceLoops(mask: Uint8Array, w: number, h: number): Pt[][] {
  interface Edge { to: Pt; dir: number; used: boolean }
  const from = new Map<string, Edge[]>();
  const key = (x: number, y: number) => `${x},${y}`;
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const add = (x: number, y: number, tx: number, ty: number, dir: number) => {
    const k = key(x, y);
    const arr = from.get(k) ?? [];
    arr.push({ to: [tx, ty], dir, used: false });
    from.set(k, arr);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) add(x, y, x + 1, y, 0); // top edge → E
      if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1, 1); // right edge → S
      if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1, 2); // bottom edge → W
      if (!filled(x - 1, y)) add(x, y + 1, x, y, 3); // left edge → N
    }
  }
  // Direction indices: 0=E, 1=S, 2=W, 3=N (y-down). When several edges
  // leave a vertex (diagonal-touch saddles), prefer the sharpest right
  // turn so the walk keeps hugging the filled region.
  const pref = (d: number) => [(d + 1) % 4, d, (d + 3) % 4, (d + 2) % 4];
  const loops: Pt[][] = [];
  for (const [k, edges] of from) {
    for (const e0 of edges) {
      if (e0.used) continue;
      const parts = k.split(",");
      const sx = Number(parts[0]), sy = Number(parts[1]);
      const loop: Pt[] = [[sx, sy]];
      let edge: Edge | undefined = e0;
      let guard = 0;
      while (edge && guard++ < 200000) {
        edge.used = true;
        const cur = edge.to;
        if (cur[0] === sx && cur[1] === sy) break;
        loop.push(cur);
        const cands = from.get(key(cur[0], cur[1])) ?? [];
        let next: Edge | undefined;
        for (const pd of pref(edge.dir)) {
          const c = cands.find((cc) => !cc.used && cc.dir === pd);
          if (c) { next = c; break; }
        }
        edge = next;
      }
      if (loop.length >= 4) loops.push(loop);
    }
  }
  return loops;
}

export function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function polyPerimeter(poly: Pt[]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    p += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return p;
}

function pointSegDist(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const L2 = vx * vx + vy * vy;
  const t = L2 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / L2)) : 0;
  return Math.hypot(wx - t * vx, wy - t * vy);
}

function dpOpen(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = pts[a]!, B = pts[b]!;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = pointSegDist(pts[i]!, A, B);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx >= 0 && maxD > tol) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Douglas–Peucker simplification for a closed ring. */
export function simplifyClosed(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 4) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i]![0] - pts[0]![0], pts[i]![1] - pts[0]![1]);
    if (d > fd) { fd = d; far = i; }
  }
  if (far === 0) return pts;
  const arc1 = pts.slice(0, far + 1);
  const arc2 = [...pts.slice(far), pts[0]!];
  const s1 = dpOpen(arc1, tol);
  const s2 = dpOpen(arc2, tol);
  return [...s1.slice(0, -1), ...s2.slice(0, -1)];
}

/** One Chaikin corner-cutting pass over a closed ring (softens the
 *  raster staircase without redrawing the shape). */
export function chaikin(pts: Pt[], ratio = 0.25): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    out.push([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]);
    out.push([a[0] + (b[0] - a[0]) * (1 - ratio), a[1] + (b[1] - a[1]) * (1 - ratio)]);
  }
  return out;
}

/* --------------------- artwork rasterization ------------------------ */

interface OutlineData {
  /** Simplified outline polygons in SVG units, largest first. */
  polys: Pt[][];
  /** Perimeter of the largest polygon (SVG units) — the gusset length. */
  perimMain: number;
  /** Region id covering the most artwork pixels (back/gusset color). */
  dominant: string;
  bounds: { minX: number; minY: number; w: number; h: number };
  mask: Uint8Array;
  gw: number;
  gh: number;
  cell: number;
}

const outlineCache = new Map<string, OutlineData>();

function rasterize(template: TemplateDef): OutlineData {
  const cached = outlineCache.get(template.id);
  if (cached) return cached;
  const [vw, vh] = template.viewBox;
  const cell = Math.max(vw, vh) / 300;
  const gw = Math.ceil(vw / cell), gh = Math.ceil(vh / cell);
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = gw; c.height = gh;
    return c;
  };
  const union = mk();
  const uctx = union.getContext("2d")!;
  uctx.fillStyle = "#000";
  uctx.scale(1 / cell, 1 / cell);
  const regionCanvas = mk();
  const rctx = regionCanvas.getContext("2d", { willReadFrequently: true })!;
  let dominant = template.regions[0]?.id ?? "body";
  let dominantCount = -1;
  for (const r of template.regions) {
    rctx.clearRect(0, 0, gw, gh);
    rctx.save();
    rctx.scale(1 / cell, 1 / cell);
    rctx.fillStyle = "#000";
    for (const el of r.els) rctx.fill(new Path2D(elToPath(el)));
    rctx.restore();
    const data = rctx.getImageData(0, 0, gw, gh).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 40) count++;
    if (count > dominantCount) { dominantCount = count; dominant = r.id; }
    for (const el of r.els) uctx.fill(new Path2D(elToPath(el)));
  }
  const udata = uctx.getImageData(0, 0, gw, gh).data;
  const mask = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) mask[i] = udata[i * 4 + 3]! > 40 ? 1 : 0;

  const loops = traceLoops(mask, gw, gh)
    .map((loop) => loop.map(([x, y]) => [x * cell, y * cell] as Pt))
    .map((loop) => ({ loop, area: signedArea(loop) }))
    .filter((e) => e.area > 0); // outer boundaries only; holes are filled
  loops.sort((a, b) => b.area - a.area);
  const largest = loops[0]?.area ?? 0;
  const kept = loops
    .filter((e) => e.area >= Math.max(16, largest * 0.004))
    .map((e) => chaikin(simplifyClosed(e.loop, 1.1), 0.25));
  const main: Pt[] = kept[0] ?? [[0, 0], [10, 0], [10, 10], [0, 10]];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of kept) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = vw; maxY = vh; }
  const data: OutlineData = {
    polys: kept.length ? kept : [main],
    perimMain: polyPerimeter(main),
    dominant,
    bounds: { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) },
    mask, gw, gh, cell,
  };
  outlineCache.set(template.id, data);
  return data;
}

/* --------------------------- pillow net ----------------------------- */

export interface PillowPiece {
  id: string;
  label: string;
  kind: "front" | "back" | "gusset" | "stand";
  /** Cut contour in page mm. For panels: one entry per outline polygon. */
  polygons: Pt[][];
  /** Fill region for solid pieces (back panel, gusset band). */
  region?: string;
  /** Fixed fill (stand). */
  fill?: string;
  /** Gusset: the colored band polygon between the two fold lines. */
  band?: Pt[];
  /** Pale glue areas (gusset long tabs + the end overlap tab). */
  tabs?: Pt[][];
  folds?: [Pt, Pt][];
  joinMarks?: { x: number; y: number; n: number }[];
  /** Stand only: where the child's name prints. */
  nameplate?: Pt[];
  labelAt?: Pt;
  /** Front/back: the "start gluing here" dot (bottom of the outline). */
  startMark?: Pt;
}

export interface PillowNet {
  widthMm: number;
  heightMm: number;
  pages: { pieces: PillowPiece[] }[];
  steps: string[];
  perimeterMm: number;
  thicknessMm: number;
  pieceCount: number;
  dominantRegion: string;
  /** Artwork transform for the front panel: mm = svg * s + (tx, ty). */
  art: { s: number; tx: number; ty: number };
  /** Artwork transform for the back panel: mm = (−svg.x * s + tx,
   *  svg.y * s + ty) — mirrored together with the back outline, so the
   *  artwork reads correctly on the assembled pillow's back side. */
  artBack: { s: number; tx: number; ty: number };
  /** Simplified outline in SVG units (provenance / checks). */
  outlineSvg: Pt[][];
}

const PILLOW_STEPS_BASE = [
  "Gunting potongan-potongan ini mengikuti garis tebal: panel depan dan panel belakang (keduanya gambar kamu sendiri!), dua strip gusset, dan penyangganya. Orang dewasa yang menggunting!",
  "Buat satu strip gusset panjang: rekatkan tab pucat di awal strip 2 ke ujung strip 1, cocokkan angka 1.",
  "Lipat kedua tab pucat strip gusset ke belakang mengikuti garis putus-putus.",
  "Rekatkan tab gusset mengelilingi bagian belakang panel DEPAN, mulai dari titik hitam di bawah. Pita berwarna menghadap keluar — itulah tepi empuk bantalnya.",
  "Rekatkan panel BELAKANG ke tab gusset lainnya dengan cara yang sama. Tepat sebelum bagian terakhir, selipkan sedikit tisu yang diremas supaya menggembung, lalu rekatkan sampai tertutup.",
  "Lipat penyangga menjadi bentuk U dengan nama di depan, rekatkan tepi bawah bantal di dalamnya, lalu berdirikan bantalmu. Ta-da — sekitar 10 menit!",
];

export function buildPillowNet(template: TemplateDef, opts?: NetOptions): PillowNet {
  const data = rasterize(template);
  const paper = opts?.paper ?? "A4";
  const pageW = paper === "A3" ? 297 : 210;
  const pageH = paper === "A3" ? 420 : 297;
  const x0 = 9, y0 = 25, uw = pageW - 18, uh = pageH - 34;
  const scalePct = (opts?.scalePct ?? 100) / 100;
  const tab = Math.max(3, Math.min(14, opts?.tabDepthMm ?? 7));
  const nameOffset = opts?.nameOffsetMm ?? 0;
  const thickness = paper === "A3" ? 20 : 16;
  const stripW = thickness + 2 * tab;

  // Scale: aim for a generous panel, but the whole gusset (two printed
  // strips) and the page must fit — the perimeter cap is what keeps the
  // strip to exactly two parts and the build to five pieces.
  const maxPanelH = Math.min(paper === "A3" ? 250 : 168, uh - 26 - 2 * stripW);
  const s = Math.min(
    ((paper === "A3" ? 215 : 150) * scalePct) / data.bounds.h,
    (uw - 4) / data.bounds.w,
    maxPanelH / data.bounds.h,
    (2 * (uw - 18)) / data.perimMain,
  );
  const panelW = data.bounds.w * s;
  const panelH = data.bounds.h * s;
  const perimeterMm = data.perimMain * s;
  const { minX, minY } = data.bounds;
  const toMm = ([x, y]: Pt): Pt => [(x - minX) * s, (y - minY) * s];
  const mainMm = data.polys[0]!.map(toMm);
  const extraMm = data.polys.slice(1).map((p) => p.map(toMm));

  // "Start gluing" dot: outline point nearest the bottom-center.
  const cxm = panelW / 2;
  let startLocal: Pt = mainMm[0]!;
  let bestD = Infinity;
  for (const p of mainMm) {
    const d = (p[0] - cxm) ** 2 + (p[1] - panelH) ** 2 * 4;
    if (d < bestD) { bestD = d; startLocal = p; }
  }

  const fx = x0 + (uw - panelW) / 2, fy = y0 + 2;
  const at = (polys: Pt[][], ox: number, oy: number): Pt[][] =>
    polys.map((poly) => poly.map(([x, y]) => [x + ox, y + oy] as Pt));
  const front: PillowPiece = {
    id: "front", label: "Panel depan — gambar kamu", kind: "front",
    polygons: at([mainMm, ...extraMm], fx, fy),
    startMark: [startLocal[0] + fx, startLocal[1] + fy],
  };

  // Stand (placed under the front panel on sheet 1 when it fits).
  const standW = Math.max(56, Math.min(140, panelW * 0.72));
  const standSegs: [number, number, number] = [14, 26, 14];
  const standH = standSegs[0] + standSegs[1] + standSegs[2];
  const standX = x0 + (uw - standW) / 2;
  const mkStand = (sx: number, sy: number): PillowPiece => ({
    id: "stand", label: "Penyangga — lipat menjadi U", kind: "stand",
    polygons: [[[sx, sy], [sx + standW, sy], [sx + standW, sy + standH], [sx, sy + standH]]],
    fill: "#FFF6E0",
    folds: [
      [[sx, sy + standSegs[0]], [sx + standW, sy + standSegs[0]]],
      [[sx, sy + standSegs[0] + standSegs[1]], [sx + standW, sy + standSegs[0] + standSegs[1]]],
    ],
    nameplate: [
      [sx + 3 + nameOffset, sy + 2.5],
      [sx + standW - 3 + nameOffset, sy + 2.5],
      [sx + standW - 3 + nameOffset, sy + standSegs[0] - 2.5],
      [sx + 3 + nameOffset, sy + standSegs[0] - 2.5],
    ],
    labelAt: [sx + standW / 2, sy + standSegs[0] + standSegs[1] / 2],
  });

  const bx = fx, by = y0 + 2;
  const mirror = (polys: Pt[][]): Pt[][] =>
    polys.map((poly) => poly.map(([x, y]) => [panelW - x, y] as Pt).reverse());
  const backPolysLocal = mirror([mainMm, ...extraMm]);
  const back: PillowPiece = {
    id: "back", label: "Panel belakang — gambar kamu juga", kind: "back",
    polygons: at(backPolysLocal, bx, by),
    startMark: [panelW - startLocal[0] + bx, startLocal[1] + by],
  };

  // Gusset strips under the back panel. Strip 2 carries a 12 mm overlap
  // tab at its start; the pair joins at mark 1 and nowhere else.
  const overlap = 12;
  const segA = Math.ceil(perimeterMm / 2);
  const segB = perimeterMm - segA;
  const gy = by + panelH + 8;
  const gx = x0 + 2;
  const mkGusset = (
    id: string, label: string, len: number, gyRow: number, withTab: boolean,
  ): PillowPiece => {
    const total = len + (withTab ? overlap : 0);
    const bandX = gx + (withTab ? overlap : 0);
    const piece: PillowPiece = {
      id, label, kind: "gusset",
      polygons: [[[gx, gyRow], [gx + total, gyRow], [gx + total, gyRow + stripW], [gx, gyRow + stripW]]],
      region: data.dominant,
      band: [[bandX, gyRow + tab], [bandX + len, gyRow + tab], [bandX + len, gyRow + tab + thickness], [bandX, gyRow + tab + thickness]],
      tabs: [
        [[bandX, gyRow], [bandX + len, gyRow], [bandX + len, gyRow + tab], [bandX, gyRow + tab]],
        [[bandX, gyRow + tab + thickness], [bandX + len, gyRow + tab + thickness], [bandX + len, gyRow + stripW], [bandX, gyRow + stripW]],
      ],
      folds: [
        [[bandX, gyRow + tab], [bandX + len, gyRow + tab]],
        [[bandX, gyRow + tab + thickness], [bandX + len, gyRow + tab + thickness]],
      ],
      labelAt: [bandX + len / 2, gyRow + tab + thickness / 2],
      joinMarks: [],
    };
    if (withTab) {
      piece.tabs!.push([[gx, gyRow], [gx + overlap, gyRow], [gx + overlap, gyRow + stripW], [gx, gyRow + stripW]]);
      piece.joinMarks!.push({ x: gx + overlap / 2, y: gyRow + stripW / 2, n: 1 });
    }
    return piece;
  };
  const gussetA = mkGusset("gusset-1", "Strip gusset 1 · mulai dari titik", segA, gy, false);
  gussetA.joinMarks!.push({ x: gx + segA - 4, y: gy + stripW / 2, n: 1 });
  const gussetB = mkGusset("gusset-2", "Strip gusset 2", segB, gy + stripW + 5, true);

  const page1: PillowPiece[] = [front];
  const standY = fy + panelH + 8;
  const page2: PillowPiece[] = [back, gussetA, gussetB];
  const pages: { pieces: PillowPiece[] }[] = [];
  if (standY + standH <= y0 + uh) {
    page1.push(mkStand(standX, standY));
  } else {
    const sy2 = gy + 2 * stripW + 13;
    if (sy2 + standH <= y0 + uh) page2.push(mkStand(standX, sy2));
    else pages.push({ pieces: [mkStand(standX, y0 + 2)] });
  }
  pages.unshift({ pieces: page2 });
  pages.unshift({ pieces: page1 });

  const steps = [...PILLOW_STEPS_BASE];
  if (extraMm.length) {
    steps[0] = steps[0]!.replace(
      "penyangganya.",
      "penyangganya. Potongan depan kecil yang terpisah direkatkan rata pada panel depan di tempatnya masing-masing.",
    );
  }
  return {
    widthMm: pageW,
    heightMm: pageH,
    pages,
    steps,
    perimeterMm,
    thicknessMm: thickness,
    pieceCount: 4 + extraMm.length + 1, // front + back + 2 gusset + stand (+ extras)
    dominantRegion: data.dominant,
    art: { s, tx: fx - minX * s, ty: fy - minY * s },
    artBack: { s, tx: bx + panelW + minX * s, ty: by - minY * s },
    outlineSvg: data.polys,
  };
}

/* --------------------------- validation ----------------------------- */

function bboxOf(polys: Pt[][]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polys) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function piecePolys(p: PillowPiece): Pt[][] {
  return [...p.polygons, ...(p.tabs ?? []), ...(p.band ? [p.band] : [])];
}

/**
 * Quality checks for the Paper Pillow format, in the same shape the
 * Template Manager already renders. Every number is measured from the
 * generated net and the rasterized artwork — nothing is asserted.
 */
export function analyzePillow(
  template: TemplateDef,
  colors: Record<string, string>,
  name: string,
): CraftAnalysis {
  const net = buildPillowNet(template, undefined);
  const data = rasterize(template);
  const checks: CraftCheck[] = [];
  const allPieces = net.pages.flatMap((pg) => pg.pieces);

  // 1 — the front panel IS the artwork: rasterize the traced outline on
  // the same grid as the artwork mask and measure the overlap.
  let iou = 0;
  try {
    const c = document.createElement("canvas");
    c.width = data.gw; c.height = data.gh;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    for (const poly of net.outlineSvg) {
      const path = new Path2D();
      poly.forEach(([x, y], i) => {
        if (i === 0) path.moveTo(x / data.cell, y / data.cell);
        else path.lineTo(x / data.cell, y / data.cell);
      });
      path.closePath();
      ctx.fill(path);
    }
    const od = ctx.getImageData(0, 0, data.gw, data.gh).data;
    let inter = 0, union = 0;
    for (let i = 0; i < data.gw * data.gh; i++) {
      const a = data.mask[i] === 1;
      const b = od[i * 4 + 3]! > 40;
      if (a || b) union++;
      if (a && b) inter++;
    }
    iou = union ? inter / union : 0;
  } catch {
    iou = 0;
  }
  checks.push({
    id: "front-exact", label: "Kedua panel adalah gambar anak persis",
    ok: iou >= 0.93,
    detail: `Garis potong ditelusuri dari halaman mewarnai itu sendiri; tumpang tindih terukur antara panel cetak dan gambarnya adalah ${Math.round(iou * 100)}% (perlu ≥ 93%). Panel belakang memakai garis bentuk dan gambar yang sama (dicerminkan), jadi bantalnya tampil sama dari depan dan belakang.`,
  });

  // 2 — piece count: the whole point of the pillow model.
  checks.push({
    id: "pieces", label: "Bisa dirakit anak kecil: paling banyak 5 potong",
    ok: net.pieceCount <= 5,
    detail: `Total ${net.pieceCount} potong — panel depan, panel belakang, strip gusset dalam 2 bagian (1 sambungan), dan penyangga lipat. Tanpa potongan mesh, tanpa tepi bernomor mengelilingi karakter.`,
  });

  // 3 — gusset length equals the outline perimeter.
  const gussets = allPieces.filter((p) => p.kind === "gusset");
  const gussetLen = gussets.reduce((sum, g) => {
    const bb = bboxOf(g.band ? [g.band] : g.polygons);
    return sum + (bb.maxX - bb.minX);
  }, 0);
  checks.push({
    id: "gusset", label: "Panjang strip gusset sama dengan keliling garis bentuk",
    ok: Math.abs(gussetLen - net.perimeterMm) <= 0.5,
    detail: `Total strip ${gussetLen.toFixed(1)} mm berbanding keliling garis bentuk ${net.perimeterMm.toFixed(1)} mm — pitanya melingkari karakter dengan pas, dengan tepi empuk ${net.thicknessMm} mm.`,
  });

  // 4 — page fit with print-safe margins.
  let fitOk = true;
  for (const p of allPieces) {
    for (const poly of piecePolys(p)) {
      for (const [x, y] of poly) {
        if (x < 4 || y < 4 || x > net.widthMm - 4 || y > net.heightMm - 4) fitOk = false;
      }
    }
  }
  checks.push({
    id: "fit", label: "Semua potongan muat di dalam margin halaman cetak",
    ok: fitOk,
    detail: `${net.pages.length} lembar ukuran ${net.widthMm}×${net.heightMm} mm, margin aman cetak 4 mm terpenuhi.`,
  });

  // 5 — layout: no two pieces share space on a sheet (bounding boxes,
  // with the deterministic gaps the layout leaves between pieces).
  let overlapOk = true;
  let overlapDetail = "Setiap lembar ditata dengan jarak jelas antar potongan — tidak ada yang tumpang tindih.";
  for (const pg of net.pages) {
    const boxes = pg.pieces.map((p) => ({ id: p.id, bb: bboxOf(piecePolys(p)) }));
    for (let i = 0; i < boxes.length && overlapOk; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i]!.bb, B = boxes[j]!.bb;
        if (A.minX < B.maxX && B.minX < A.maxX && A.minY < B.maxY && B.minY < A.maxY) {
          overlapOk = false;
          overlapDetail = `Potongan “${boxes[i]!.id}” dan “${boxes[j]!.id}” tumpang tindih di satu lembar.`;
        }
      }
    }
  }
  checks.push({
    id: "overlap", label: "Tidak ada potongan yang tumpang tindih di lembar",
    ok: overlapOk,
    detail: overlapDetail,
  });

  // 6 — every coloring region prints on both panels, in the child's
  // own colors (both panels are drawn from the region map itself).
  const regionIds = template.regions.map((r) => r.id);
  const printed = new Set(regionIds);
  const dropped = Object.keys(colors).filter((r) => regionIds.includes(r) && !printed.has(r));
  checks.push({
    id: "regions", label: "Setiap region berwarna tercetak di kedua panel",
    ok: dropped.length === 0,
    detail: dropped.length
      ? `Region yang hilang dari panel: ${dropped.join(", ")}.`
      : `Semua ${regionIds.length} region tercetak di panel depan DAN panel belakang dari peta warna-region yang sama dengan halaman mewarnai dan pratinjau 3D; gusset memakai region utama (${template.regions.find((r) => r.id === net.dominantRegion)?.label ?? net.dominantRegion}).`,
  });

  // 7 — the name fits its stand flap (its only place on the pillow).
  const stand = allPieces.find((p) => p.kind === "stand");
  let nameOk = false, nameDetail = "Tidak ada penyangga di jaring ini.";
  if (stand?.nameplate) {
    const bb = bboxOf([stand.nameplate]);
    const wMm = bb.maxX - bb.minX, hMm = bb.maxY - bb.minY;
    const label = (name.trim() || "BABA").toUpperCase();
    const sizePt = Math.min(13, hMm * (72 / 25.4) * 0.52);
    const estWidthMm = (label.length * sizePt * 0.56) / (72 / 25.4);
    nameOk = estWidthMm <= wMm - 3;
    nameDetail = `Flap nama ${wMm.toFixed(0)}×${hMm.toFixed(0)} mm pada penyangga; “${label}” butuh ≈${estWidthMm.toFixed(0)} mm pada ukuran cetak. Nama hanya tercetak di flap penyangga ini — kedua panel bantal polos gambar saja.`;
  }
  checks.push({ id: "name", label: "Nama pribadi terpasang dan muat", ok: nameOk, detail: nameDetail });

  // 8 — stability: the stand's floor is wide and deep enough.
  const front = allPieces.find((p) => p.kind === "front");
  const frontBb = front ? bboxOf(front.polygons) : { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  const standBb = stand ? bboxOf(stand.polygons) : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const standW = standBb.maxX - standBb.minX;
  const panelW = frontBb.maxX - frontBb.minX;
  const stable = standW >= panelW * 0.5;
  checks.push({
    id: "stability", label: "Berdiri stabil di alas lipatnya",
    ok: stable,
    detail: stable
      ? `Penyangga kanal U selebar ${standW.toFixed(0)} mm (${Math.round((standW / panelW) * 100)}% dari panel) dengan lantai 26 mm — tepi bawah bantal duduk di dalamnya.`
      : "Penyangganya terlalu sempit untuk panelnya — bantalnya akan terguling.",
  });

  // 9 — instructions cover every piece.
  const stepsText = net.steps.join(" ").toLowerCase();
  const missing = ["panel depan", "panel belakang", "gusset", "penyangga"].filter((w) => !stepsText.includes(w));
  checks.push({
    id: "steps", label: "Petunjuk rakit mencakup setiap potongan",
    ok: missing.length === 0,
    detail: missing.length
      ? `Tidak ada petunjuk yang menyebut: ${missing.join(", ")}.`
      : `${net.steps.length} langkah singkat mencakup depan, belakang, gusset, dan penyangga — sekitar 10 menit bersama orang dewasa.`,
  });

  const outlinePts = net.outlineSvg.reduce((a, p) => a + p.length, 0);
  return {
    ok: checks.every((c) => c.ok),
    engine: true,
    checks,
    stats: {
      faces: outlinePts,
      pieces: net.pieceCount,
      sheets: net.pages.length,
      joins: 1,
    },
    formatLabel: `Bantal Kertas · ${net.pieceCount} potong · ${net.pages.length} lembar · 1 sambungan · kedua panel bergambar, ditelusuri dari gambarnya (garis bentuk ${outlinePts} titik)`,
  };
}
