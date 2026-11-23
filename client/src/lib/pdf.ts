// A small vector PDF writer + the ColorPop print builders.
//
// Produces real, valid A4 PDFs entirely in the browser: filled net pieces
// in the child's exact region colors, solid cut lines, dashed fold lines,
// glue tabs, assembly numbers, the personalized name, and instructions.
// No server round-trip and no external library needed.

import {
INK,
elToPath,
resolveColor,
tint,
type NetDef,
type NetPiece,
type Pt,
type TemplateDef,
} from "./model";
import type { Stroke } from "../components/ColoringEditor";
import { buildPillowNet, type PillowNet, type PillowPiece } from "./pillow";

const K = 72 / 25.4; // mm → pt
export const A4 = { portrait: [210, 297] as const, landscape: [297, 210] as const };

type RGB = [number, number, number];

export function parseColor(c: string): RGB {
  const hex = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i.exec(c.trim());
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  return [1, 1, 1];
}

const f = (n: number) => Math.round(n * 100) / 100;

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/* ---------------- SVG path → PDF ops (with mm transform) ---------------- */

interface Xf {
  s: number;
  /** Optional separate x scale (negative mirrors horizontally — used
   *  for the pillow's back panel, whose artwork is mirrored with its
   *  outline). Defaults to `s`. */
  sx?: number;
  tx: number;
  ty: number;
  pageH: number; // page height in pt
}

function ptOf(xf: Xf, x: number, y: number): [number, number] {
  const mmX = xf.tx + x * (xf.sx ?? xf.s);
  const mmY = xf.ty + y * xf.s;
  return [mmX * K, xf.pageH - mmY * K];
}

/** Convert an SVG path (M/L/H/V/C/S/Q/A/Z, abs+rel) to PDF path operators. */
export function svgPathToOps(d: string, xf: Xf): string {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = "";
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let pcx = 0, pcy = 0; // previous control point (for S/T)
  const ops: string[] = [];
  const num = () => parseFloat(tokens[i++] ?? "0");
  const P = (x: number, y: number) => ptOf(xf, x, y);

  const arcTo = (rx: number, ry: number, rot: number, large: number, sweep: number, x: number, y: number) => {
    // Endpoint → center parameterization, then cubic approximation.
    const phi = (rot * Math.PI) / 180;
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    const dx = (cx - x) / 2, dy = (cy - y) / 2;
    const x1p = cosP * dx + sinP * dy;
    const y1p = -sinP * dx + cosP * dy;
    let rx2 = Math.abs(rx), ry2 = Math.abs(ry);
    const lambda = (x1p * x1p) / (rx2 * rx2) + (y1p * y1p) / (ry2 * ry2);
    if (lambda > 1) {
      rx2 *= Math.sqrt(lambda);
      ry2 *= Math.sqrt(lambda);
    }
    const num2 = rx2 * rx2 * ry2 * ry2 - rx2 * rx2 * y1p * y1p - ry2 * ry2 * x1p * x1p;
    const den = rx2 * rx2 * y1p * y1p + ry2 * ry2 * x1p * x1p;
    let co = den === 0 ? 0 : Math.sqrt(Math.max(0, num2 / den));
    if (large === sweep) co = -co;
    const cxp = (co * rx2 * y1p) / ry2;
    const cyp = (-co * ry2 * x1p) / rx2;
    const ccx = cosP * cxp - sinP * cyp + (cx + x) / 2;
    const ccy = sinP * cxp + cosP * cyp + (cy + y) / 2;
    const theta1 = Math.atan2((y1p - cyp) / ry2, (x1p - cxp) / rx2);
    let dTheta = Math.atan2((-y1p - cyp) / ry2, (-x1p - cxp) / rx2) - theta1;
    while (dTheta < 0) dTheta += Math.PI * 2;
    if (!sweep) dTheta -= Math.PI * 2;
    // Split into ≤90° cubic segments (in SVG's y-down space; sweep handled by dTheta sign).
    const segs = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
    const step = dTheta / segs;
    const kappa = (4 / 3) * Math.tan(step / 4);
    let th = theta1;
    let px = cx, py = cy;
    for (let sIdx = 0; sIdx < segs; sIdx++) {
      const th2 = th + step;
      const ex = ccx + rx2 * Math.cos(th2) * cosP - ry2 * Math.sin(th2) * sinP;
      const ey = ccy + rx2 * Math.cos(th2) * sinP + ry2 * Math.sin(th2) * cosP;
      const c1x = px + kappa * (-rx2 * Math.sin(th) * cosP - ry2 * Math.cos(th) * sinP);
      const c1y = py + kappa * (-rx2 * Math.sin(th) * sinP + ry2 * Math.cos(th) * cosP);
      const c2x = ex - kappa * (-rx2 * Math.sin(th2) * cosP - ry2 * Math.cos(th2) * sinP);
      const c2y = ey - kappa * (-rx2 * Math.sin(th2) * sinP + ry2 * Math.cos(th2) * cosP);
      const [a1, b1] = P(c1x, c1y), [a2, b2] = P(c2x, c2y), [a3, b3] = P(ex, ey);
      ops.push(`${f(a1)} ${f(b1)} ${f(a2)} ${f(b2)} ${f(a3)} ${f(b3)} c`);
      px = ex; py = ey; th = th2;
    }
    cx = x; cy = y;
  };

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        ops.push("h");
        cx = sx; cy = sy;
        continue;
      }
    }
    const rel = cmd === cmd.toLowerCase() && cmd !== "";
    const up = cmd.toUpperCase();
    switch (up) {
      case "M": {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        const [a, b] = P(x, y);
        ops.push(`${f(a)} ${f(b)} m`);
        cx = sx = x; cy = sy = y;
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        const [a, b] = P(x, y);
        ops.push(`${f(a)} ${f(b)} l`);
        cx = x; cy = y;
        break;
      }
      case "H": {
        let x = num();
        if (rel) x += cx;
        const [a, b] = P(x, cy);
        ops.push(`${f(a)} ${f(b)} l`);
        cx = x;
        break;
      }
      case "V": {
        let y = num();
        if (rel) y += cy;
        const [a, b] = P(cx, y);
        ops.push(`${f(a)} ${f(b)} l`);
        cy = y;
        break;
      }
      case "C": {
        let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
        const [a1, b1] = P(x1, y1), [a2, b2] = P(x2, y2), [a3, b3] = P(x, y);
        ops.push(`${f(a1)} ${f(b1)} ${f(a2)} ${f(b2)} ${f(a3)} ${f(b3)} c`);
        pcx = x2; pcy = y2; cx = x; cy = y;
        break;
      }
      case "S": {
        let x2 = num(), y2 = num(), x = num(), y = num();
        if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
        const x1 = 2 * cx - pcx, y1 = 2 * cy - pcy;
        const [a1, b1] = P(x1, y1), [a2, b2] = P(x2, y2), [a3, b3] = P(x, y);
        ops.push(`${f(a1)} ${f(b1)} ${f(a2)} ${f(b2)} ${f(a3)} ${f(b3)} c`);
        pcx = x2; pcy = y2; cx = x; cy = y;
        break;
      }
      case "Q": {
        let x1 = num(), y1 = num(), x = num(), y = num();
        if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
        // Quadratic → cubic.
        const c1x = cx + (2 / 3) * (x1 - cx), c1y = cy + (2 / 3) * (y1 - cy);
        const c2x = x + (2 / 3) * (x1 - x), c2y = y + (2 / 3) * (y1 - y);
        const [a1, b1] = P(c1x, c1y), [a2, b2] = P(c2x, c2y), [a3, b3] = P(x, y);
        ops.push(`${f(a1)} ${f(b1)} ${f(a2)} ${f(b2)} ${f(a3)} ${f(b3)} c`);
        pcx = x1; pcy = y1; cx = x; cy = y;
        break;
      }
      case "A": {
        const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        arcTo(rx, ry, rot, large, sweep, x, y);
        break;
      }
      default:
        i++;
    }
  }
  return ops.join("\n");
}

/* ------------------------------ Page ------------------------------ */

class Page {
  ops: string[] = [];
  constructor(
    readonly wMm: number,
    readonly hMm: number,
  ) {}
  get wPt() { return this.wMm * K; }
  get hPt() { return this.hMm * K; }
  private xy(xMm: number, yMm: number): [number, number] {
    return [xMm * K, this.hPt - yMm * K];
  }
  fill(c: string) {
    const [r, g, b] = parseColor(c);
    this.ops.push(`${f(r)} ${f(g)} ${f(b)} rg`);
  }
  strokeColor(c: string) {
    const [r, g, b] = parseColor(c);
    this.ops.push(`${f(r)} ${f(g)} ${f(b)} RG`);
  }
  lineWidthPt(w: number) { this.ops.push(`${f(w)} w`); }
  dash(on = 4, off = 3) { this.ops.push(`[${on} ${off}] 0 d`); }
  dashPattern(arr: number[]) { this.ops.push(`[${arr.join(" ")}] 0 d`); }
  solid() { this.ops.push("[] 0 d"); }
  /** Fold line: mountain = dashed, valley = dash-dot. */
  foldLine(a: Pt, b: Pt, kind: "mountain" | "valley") {
    this.strokeColor(INK);
    this.lineWidthPt(0.9);
    if (kind === "mountain") this.dashPattern([4, 3]);
    else this.dashPattern([5.5, 2, 1, 2]);
    this.polygon([a, b], false);
    this.ops.push("S");
    this.solid();
  }
  polygon(pts: Pt[], close = true) {
    pts.forEach(([x, y], i) => {
      const [a, b] = this.xy(x, y);
      this.ops.push(`${f(a)} ${f(b)} ${i === 0 ? "m" : "l"}`);
    });
    if (close) this.ops.push("h");
  }
  /** Graphics-state save/restore + clipping (paper-pillow front panel:
   *  the artwork is drawn in full, then clipped to the traced outline,
   *  so what prints is exactly the child's drawing, cut on its edge). */
  save() { this.ops.push("q"); }
  restore() { this.ops.push("Q"); }
  clipPolygon(pts: Pt[]) {
    this.polygon(pts);
    this.ops.push("W n");
  }
  clipPolygons(polys: Pt[][]) {
    for (const p of polys) this.polygon(p);
    this.ops.push("W n");
  }
  fillPolygon(pts: Pt[], c: string) {
    this.fill(c);
    this.polygon(pts);
    this.ops.push("f");
  }
  strokePolygon(pts: Pt[], c: string, wPt = 1, dashed = false) {
    this.strokeColor(c);
    this.lineWidthPt(wPt);
    if (dashed) this.dash(); else this.solid();
    this.polygon(pts);
    this.ops.push("S");
    this.solid();
  }
  line(a: Pt, b: Pt, c: string, wPt = 1, dashed = false) {
    this.strokePolygon([a, b], c, wPt, dashed);
  }
  circle(cx: number, cy: number, r: number, fillC?: string, strokeC?: string, wPt = 1) {
    const [x, y] = this.xy(cx, cy);
    const rr = r * K;
    const c = 0.5523 * rr;
    this.ops.push(
      `${f(x + rr)} ${f(y)} m`,
      `${f(x + rr)} ${f(y + c)} ${f(x + c)} ${f(y + rr)} ${f(x)} ${f(y + rr)} c`,
      `${f(x - c)} ${f(y + rr)} ${f(x - rr)} ${f(y + c)} ${f(x - rr)} ${f(y)} c`,
      `${f(x - rr)} ${f(y - c)} ${f(x - c)} ${f(y - rr)} ${f(x)} ${f(y - rr)} c`,
      `${f(x + c)} ${f(y - rr)} ${f(x + rr)} ${f(y - c)} ${f(x + rr)} ${f(y)} c`,
      "h",
    );
    if (fillC) this.fill(fillC);
    if (strokeC) { this.strokeColor(strokeC); this.lineWidthPt(wPt); }
    this.ops.push(fillC && strokeC ? "B" : fillC ? "f" : "S");
  }
  pathD(d: string, xf: { s: number; tx: number; ty: number }, opts: { fill?: string; stroke?: string; wPt?: number }) {
    this.ops.push(svgPathToOps(d, { ...xf, pageH: this.hPt }));
    if (opts.fill) this.fill(opts.fill);
    if (opts.stroke) { this.strokeColor(opts.stroke); this.lineWidthPt(opts.wPt ?? 1.4); }
    this.ops.push(opts.fill && opts.stroke ? "B" : opts.fill ? "f" : "S");
  }
  text(s: string, xMm: number, yMm: number, sizePt: number, c: string, opts: { bold?: boolean; align?: "left" | "center"; maxWidthMm?: number } = {}) {
    let size = sizePt;
    if (opts.maxWidthMm) {
      const est = s.length * size * 0.56;
      const maxPt = opts.maxWidthMm * K;
      if (est > maxPt) size = Math.max(6, (size * maxPt) / est);
    }
    const [x, y] = this.xy(xMm, yMm);
    let tx = x;
    if (opts.align === "center") tx = x - (s.length * size * 0.56) / 2;
    this.fill(c);
    this.ops.push(
      `BT /${opts.bold ? "F2" : "F1"} ${f(size)} Tf ${f(tx)} ${f(y)} Td (${escapeText(s)}) Tj ET`,
    );
  }
}

/* ------------------------------ Document ------------------------------ */

function buildPdf(pages: Page[], title: string): Blob {
  // Object layout: 1 catalog, 2 pages, 3 font F1, 4 font F2, then per page: page obj + content obj.
  const fontF1 = 3;
  const fontF2 = 4;
  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];
  let next = fontF2 + 1;
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(next++);
    contentObjNums.push(next++);
  }
  const objs: string[] = new Array(next).fill("");
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objs[fontF1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objs[fontF2] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;
  pages.forEach((p, i) => {
    const content = p.ops.join("\n");
    objs[pageObjNums[i]!] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(p.wPt)} ${f(p.hPt)}] /Resources << /Font << /F1 ${fontF1} 0 R /F2 ${fontF2} 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>`;
    objs[contentObjNums[i]!] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let n = 1; n < objs.length; n++) {
    if (!objs[n]) continue;
    offsets[n] = out.length;
    out += `${n} 0 obj\n${objs[n]}\nendobj\n`;
  }
  const xrefPos = out.length;
  const size = objs.length;
  out += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let n = 1; n < size; n++) {
    out += `${String(offsets[n] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${size} /Root 1 0 R /Info << /Title (${escapeText(title)}) >> >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new Blob([out], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* --------------------------- Print builders --------------------------- */

export interface PrintData {
  template: TemplateDef;
  colors: Record<string, string>;
  strokes: Stroke[];
  name: string;
  message: string;
  nameColor: string;
  brandName: string;
  inkSave: boolean;
  /** Template Manager adjustments (engine nets only). */
  scalePct?: number;
  tabDepthMm?: number;
  nameOffsetMm?: number;
}

function colorOf(data: PrintData, region: string): string {
  const raw =
    region === "__ink" ? INK
    : region === "__butter" ? "#FFC93C"
    : region === "plate" ? "#FFF3D6"
    : region === "__nameplate" ? "#FFC93C"
    : resolveColor(data.template, data.colors, region);
  return data.inkSave && raw !== INK ? tint(raw, 0.72) : raw;
}

function centroid(pts: Pt[]): Pt {
  const x = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return [x, y];
}

function drawArtwork(
  page: Page,
  data: PrintData,
  txMm: number,
  tyMm: number,
  widthMm: number,
  opts: { strokeW?: number; withStrokes?: boolean; flipX?: boolean } = {},
) {
  const t = data.template;
  const s = widthMm / t.viewBox[0];
  const xf = { s, sx: opts.flipX ? -s : s, tx: txMm, ty: tyMm };
  for (const r of t.regions) {
    for (const el of r.els) {
      page.pathD(elToPath(el), xf, {
        fill: colorOf(data, r.id),
        stroke: INK,
        wPt: opts.strokeW ?? 1.6,
      });
    }
  }
  if (opts.withStrokes) {
    for (const st of data.strokes) {
      if (st.points.length < 2) continue;
      const d = st.points.map((p, j) => `${j === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
      const saveInk = data.inkSave ? tint(st.color, 0.5) : st.color;
      page.pathD(d, xf, { stroke: saveInk, wPt: Math.max(1, st.size * s * K * 0.5) });
    }
  }
  for (const d of t.details) {
    if (d.fill) page.pathD(elToPath(d.el), xf, { fill: d.fill });
    if (d.stroke) page.pathD(elToPath(d.el), xf, { stroke: d.stroke, wPt: 1.2 });
  }
}

function header(page: Page, data: PrintData, subtitle: string) {
  const t = data.template;
  const who = data.name.trim() ? `KARYA ${data.name.trim().toUpperCase()} · ` : "";
  page.text(`${data.brandName} — ${who}${t.name.toUpperCase()}`, 12, 12, 15, INK, { bold: true });
  page.text(subtitle, 12, 18.5, 9.5, "#6F6157");
  page.text("Cetak pada skala 100%", page.wMm - 12, 12, 9, "#6F6157", { align: "center" });
}

function legend(page: Page, y: number) {
  page.line([12, y], [30, y], INK, 1.4);
  page.text("gunting", 32, y + 1.2, 8.5, "#6F6157");
  page.line([48, y], [66, y], INK, 1.1, true);
  page.text("lipat", 68, y + 1.2, 8.5, "#6F6157");
  page.fillPolygon([[86, y - 2.6], [102, y - 2.6], [102, y + 2.6], [86, y + 2.6]], "#EFECE6");
  page.strokePolygon([[86, y - 2.6], [102, y - 2.6], [102, y + 2.6], [86, y + 2.6]], INK, 0.8);
  page.text("tab lem", 104, y + 1.2, 8.5, "#6F6157");
}

function legendV2(page: Page, y: number) {
  page.line([12, y], [28, y], INK, 1.4);
  page.text("gunting", 30, y + 1.2, 8.5, "#6F6157");
  page.strokeColor(INK);
  page.lineWidthPt(1);
  page.dashPattern([4, 3]);
  page.polygon([[44, y], [60, y]], false);
  page.ops.push("S");
  page.solid();
  page.text("lipatan gunung", 62, y + 1.2, 8.5, "#6F6157");
  page.strokeColor(INK);
  page.lineWidthPt(1);
  page.dashPattern([5.5, 2, 1, 2]);
  page.polygon([[104, y], [120, y]], false);
  page.ops.push("S");
  page.solid();
  page.text("lipatan lembah", 122, y + 1.2, 8.5, "#6F6157");
  page.fillPolygon([[158, y - 2.6], [172, y - 2.6], [172, y + 2.6], [158, y + 2.6]], "#EFECE6");
  page.strokePolygon([[158, y - 2.6], [172, y - 2.6], [172, y + 2.6], [158, y + 2.6]], INK, 0.8);
  page.text("tab lem · angka yang sama direkatkan bersama", 174, y + 1.2, 8.5, "#6F6157");
}

/** Render one engine-v2 piece: unfolded mesh faces, cut contour, typed
 *  fold lines, numbered joins, decals, and the nameplate. */
function renderEnginePiece(page: Page, data: PrintData, piece: NetPiece) {
  for (const t of piece.tabs ?? []) {
    page.fillPolygon(t, "#EFECE6");
    page.strokePolygon(t, INK, 0.7);
  }
  for (const fc of piece.faces ?? []) {
    page.fillPolygon(fc.polygon, colorOf(data, fc.region));
  }
  for (const d of piece.decals ?? []) {
    const c = d.region ? colorOf(data, d.region) : (d.fill ?? "#FFFFFF");
    if (d.polygon) {
      page.fillPolygon(d.polygon, c);
      page.strokePolygon(d.polygon, INK, 0.7);
    } else if (d.circle) {
      page.circle(d.circle.cx, d.circle.cy, d.circle.r, c, INK, 0.7);
    } else if (d.pathD) {
      page.pathD(d.pathD, { s: d.pathScale ?? 1, tx: d.pathTx ?? 0, ty: d.pathTy ?? 0 }, { fill: c, stroke: INK, wPt: 0.9 });
    }
  }
  for (const [a, b] of piece.cutEdges ?? []) page.line(a, b, INK, 1.25);
  for (const fl of piece.foldLines ?? []) page.foldLine(fl.a, fl.b, fl.kind);
  for (const e of piece.edgeNumbers ?? []) {
    page.text(String(e.n), e.x, e.y + 1, 5.5, "#6F6157", { align: "center" });
  }
  if (piece.labelAt) {
    page.text(piece.label, piece.labelAt[0], piece.labelAt[1] + 1, 5.5, "#6F6157", {
      align: "center", maxWidthMm: 34,
    });
  }
  if (piece.nameplate && data.name.trim()) {
    const xs = piece.nameplate.map((p) => p[0]);
    const ys = piece.nameplate.map((p) => p[1]);
    const nx = Math.min(...xs), nw = Math.max(...xs) - nx;
    const ny = Math.min(...ys), nh = Math.max(...ys) - ny;
    page.fillPolygon(piece.nameplate, "#FFC93C");
    page.strokePolygon(piece.nameplate, INK, 0.8);
    page.text(data.name.trim().toUpperCase(), nx + nw / 2, ny + nh / 2 + nh * 0.18, Math.min(13, nh * K * 0.52), data.nameColor, {
      bold: true, align: "center", maxWidthMm: nw - 3,
    });
  }
}

export function buildToyPdf(
  data: PrintData,
  opts?: { paper?: "A4" | "A3"; production?: boolean; qcStatus?: string },
): Blob {
  const net: NetDef = data.template.buildNet({
    paper: opts?.paper ?? "A4",
    scalePct: data.scalePct,
    tabDepthMm: data.tabDepthMm,
    nameOffsetMm: data.nameOffsetMm,
  });

  /* ---- Engine v2: multi-sheet nets unfolded from the 3D mesh ---- */
  if (net.engine && net.pages) {
    const sheets: Page[] = [];
    const total = net.pages.length;
    net.pages.forEach((pg, si) => {
      const page = new Page(net.widthMm, net.heightMm);
      header(page, data, `Mainan Kertas 3D — lembar ${si + 1} dari ${total} · ${opts?.paper ?? "A4"}`);
      if (opts?.production) {
        page.text(
          `BERKAS PRODUKSI · status template: ${(opts.qcStatus ?? "perlu ditinjau").replace(/_/g, " ")} · dibuat dari geometri papercraft yang disetujui`,
          12, 21.5, 8, "#6F6157",
        );
      }
      legendV2(page, 27);
      for (const piece of pg.pieces) renderEnginePiece(page, data, piece);
      page.text(
        "Orang dewasa: mohon yang menggunting. Tekuk garis lipat perlahan dengan penggaris sebelum melipat.",
        12, net.heightMm - 8, 9, "#6F6157",
      );
      sheets.push(page);
    });
    const p2 = new Page(210, 297);
    header(p2, data, "Cara merakitnya");
    net.steps.forEach((step, i) => {
      p2.circle(16, 34 + i * 11, 3.6, "#FFC93C", INK, 0.8);
      p2.text(String(i + 1), 16, 35.6 + i * 11, 9, INK, { bold: true, align: "center" });
      p2.text(step, 23, 35.6 + i * 11, 10.5, INK, { maxWidthMm: 168 });
    });
    const artY = 40 + net.steps.length * 11;
    p2.text("Gambar jadimu", 12, artY, 12, INK, { bold: true });
    drawArtwork(p2, data, 30, artY + 4, 150, { withStrokes: true });
    const nameLine = data.name.trim()
      ? `Dibuat oleh ${data.name.trim()}${data.message.trim() ? ` — ${data.message.trim()}` : ""}`
      : "Mainan kertasku";
    p2.text(nameLine, 105, artY + 4 + (150 * data.template.viewBox[1]) / data.template.viewBox[0] + 10, 11, data.nameColor, {
      bold: true, align: "center", maxWidthMm: 170,
    });
    p2.text(
      "Tips: kertas lebih tebal (160–200 gsm) membuat mainan lebih kokoh. Cetak pada skala 100% supaya tepi bernomornya cocok.",
      12, 282, 9, "#6F6157", { maxWidthMm: 186 },
    );
    p2.text("Dianjurkan didampingi orang dewasa saat menggunting dan melipat.", 12, 288, 9, "#6F6157");
    return buildPdf([...sheets, p2], `${data.template.name} Mainan Kertas 3D`);
  }

  const [wMm, hMm] = net.orientation === "portrait" ? A4.portrait : A4.landscape;
  const p1 = new Page(wMm, hMm);
  header(p1, data, "Mainan Kertas 3D — gunting, lipat & rekat");
  legend(p1, 24);
  net.pieces.forEach((piece, idx) => {
    // Glue tabs first (under the piece).
    for (const t of piece.tabs ?? []) {
      p1.fillPolygon(t, "#EFECE6");
      p1.strokePolygon(t, INK, 0.7);
    }
    p1.fillPolygon(piece.polygon, colorOf(data, piece.region));
    // Decals.
    for (const d of piece.decals ?? []) {
      const c = d.region ? colorOf(data, d.region) : (d.fill ?? "#FFFFFF");
      if (d.polygon) {
        p1.fillPolygon(d.polygon, c);
        p1.strokePolygon(d.polygon, INK, 0.7);
      } else if (d.circle) {
        p1.circle(d.circle.cx, d.circle.cy, d.circle.r, c, INK, 0.7);
      } else if (d.pathD) {
        p1.pathD(d.pathD, { s: d.pathScale ?? 1, tx: d.pathTx ?? 0, ty: d.pathTy ?? 0 }, { fill: c, stroke: INK, wPt: 0.9 });
      }
    }
    // Cut outline on top.
    p1.strokePolygon(piece.polygon, INK, 1.3);
    // Fold lines.
    for (const [a, b] of piece.folds ?? []) p1.line(a, b, INK, 0.9, true);
    // Assembly number badge.
    const [cx, cy] = centroid(piece.polygon);
    p1.circle(cx, cy, 4.4, "#FFFFFF", INK, 1);
    p1.text(String(idx + 1), cx, cy + 1.6, 10, INK, { bold: true, align: "center" });
    // Nameplate.
    if (piece.nameplate && data.name.trim()) {
      const xs = piece.nameplate.map((p) => p[0]);
      const ys = piece.nameplate.map((p) => p[1]);
      const nx = Math.min(...xs), nw = Math.max(...xs) - nx;
      const ny = Math.min(...ys), nh = Math.max(...ys) - ny;
      p1.fillPolygon(piece.nameplate, "#FFC93C");
      p1.strokePolygon(piece.nameplate, INK, 0.8);
      p1.text(data.name.trim().toUpperCase(), nx + nw / 2, ny + nh / 2 + nh * 0.18, Math.min(13, nh * K * 0.52), data.nameColor, {
        bold: true, align: "center", maxWidthMm: nw - 3,
      });
    }
  });
  p1.text(
    "Orang dewasa: mohon yang menggunting. Lipat garis putus-putus dulu, lalu rekatkan tab pucat satu per satu.",
    12, hMm - 8, 9, "#6F6157",
  );

  // Page 2: instructions + the child's finished artwork.
  const p2 = new Page(210, 297);
  header(p2, data, "Cara merakitnya");
  net.steps.forEach((step, i) => {
    p2.circle(16, 34 + i * 11, 3.6, "#FFC93C", INK, 0.8);
    p2.text(String(i + 1), 16, 35.6 + i * 11, 9, INK, { bold: true, align: "center" });
    p2.text(step, 23, 35.6 + i * 11, 10.5, INK, { maxWidthMm: 168 });
  });
  const artY = 40 + net.steps.length * 11;
  p2.text("Gambar jadimu", 12, artY, 12, INK, { bold: true });
  drawArtwork(p2, data, 30, artY + 4, 150, { withStrokes: true });
  const nameLine = data.name.trim()
    ? `Dibuat oleh ${data.name.trim()}${data.message.trim() ? ` — ${data.message.trim()}` : ""}`
    : "Mainan kertasku";
  p2.text(nameLine, 105, artY + 4 + (150 * data.template.viewBox[1]) / data.template.viewBox[0] + 10, 11, data.nameColor, {
    bold: true, align: "center", maxWidthMm: 170,
  });
  p2.text(
    "Tips: kertas lebih tebal (160–200 gsm) membuat mainan lebih kokoh. Tekuk garis lipat perlahan dengan penggaris sebelum melipat.",
    12, 282, 9, "#6F6157", { maxWidthMm: 186 },
  );
  p2.text("Dianjurkan didampingi orang dewasa saat menggunting dan melipat.", 12, 288, 9, "#6F6157");
  return buildPdf([p1, p2], `${data.template.name} Mainan Kertas 3D`);
}

/* ------------------------- Paper Pillow PDF ------------------------- */

function renderPillowPiece(page: Page, data: PrintData, piece: PillowPiece, net: PillowNet) {
  if (piece.kind === "front" || piece.kind === "back") {
    // Both panels carry the artwork, drawn exactly as the child made it
    // (regions, details, freehand strokes), clipped to the traced
    // outline of the drawing. The back panel's transform mirrors the
    // artwork together with its outline, so the assembled pillow reads
    // the same from behind. No text on either panel.
    const isBack = piece.kind === "back";
    const art = isBack ? net.artBack : net.art;
    const outline = piece.polygons[0]!;
    page.save();
    page.clipPolygons(piece.polygons);
    drawArtwork(page, data, art.tx, art.ty, data.template.viewBox[0] * art.s, {
      strokeW: 2,
      withStrokes: true,
      flipX: isBack,
    });
    page.restore();
    for (const poly of piece.polygons) page.strokePolygon(poly, INK, 1.3);
    if (piece.startMark) page.circle(piece.startMark[0], piece.startMark[1], 1.7, INK);
    const fxs = outline.map((p) => p[0]), fys = outline.map((p) => p[1]);
    page.text(
      isBack
        ? "BELAKANG — gambar kamu juga · mulai merekatkan dari titik"
        : "DEPAN — gambar kamu · mulai merekatkan dari titik",
      (Math.min(...fxs) + Math.max(...fxs)) / 2,
      Math.max(...fys) + 4.5,
      6.5, "#6F6157", { align: "center" },
    );
    return;
  }
  if (piece.kind === "gusset") {
    for (const t of piece.tabs ?? []) {
      page.fillPolygon(t, "#EFECE6");
      page.strokePolygon(t, INK, 0.7);
    }
    if (piece.band) {
      page.fillPolygon(piece.band, colorOf(data, piece.region ?? "body"));
    }
    for (const poly of piece.polygons) page.strokePolygon(poly, INK, 1.1);
    for (const [a, b] of piece.folds ?? []) page.line(a, b, INK, 0.9, true);
    for (const m of piece.joinMarks ?? []) {
      page.circle(m.x, m.y, 3.2, "#FFFFFF", INK, 0.9);
      page.text(String(m.n), m.x, m.y + 1.4, 8, INK, { bold: true, align: "center" });
    }
    if (piece.labelAt) {
      page.text(piece.label, piece.labelAt[0], piece.labelAt[1] + 1.2, 6.5, "#FFFFFF", {
        align: "center", bold: true, maxWidthMm: 120,
      });
    }
    return;
  }
  // Stand: cream U-channel strip with the name on its front flap.
  for (const poly of piece.polygons) {
    page.fillPolygon(poly, "#FFF6E0");
    page.strokePolygon(poly, INK, 1.1);
  }
  for (const [a, b] of piece.folds ?? []) page.line(a, b, INK, 0.9, true);
  if (piece.labelAt) {
    page.text("PENYANGGA — lipat menjadi U · rekatkan tepi bawah bantal di dalamnya", piece.labelAt[0], piece.labelAt[1] + 1.2, 6.5, "#6F6157", {
      align: "center", maxWidthMm: 130,
    });
  }
  if (piece.nameplate && data.name.trim()) {
    const xs = piece.nameplate.map((p) => p[0]);
    const ys = piece.nameplate.map((p) => p[1]);
    const nx = Math.min(...xs), nw = Math.max(...xs) - nx;
    const ny = Math.min(...ys), nh = Math.max(...ys) - ny;
    page.fillPolygon(piece.nameplate, "#FFC93C");
    page.strokePolygon(piece.nameplate, INK, 0.8);
    page.text(data.name.trim().toUpperCase(), nx + nw / 2, ny + nh / 2 + nh * 0.18, Math.min(12, nh * K * 0.52), data.nameColor, {
      bold: true, align: "center", maxWidthMm: nw - 3,
    });
  }
}

export function buildPillowPdf(
  data: PrintData,
  opts?: { paper?: "A4" | "A3"; production?: boolean; qcStatus?: string },
): Blob {
  const net = buildPillowNet(data.template, {
    paper: opts?.paper ?? "A4",
    scalePct: data.scalePct,
    tabDepthMm: data.tabDepthMm,
    nameOffsetMm: data.nameOffsetMm,
  });
  const sheets: Page[] = [];
  const total = net.pages.length;
  net.pages.forEach((pg, si) => {
    const page = new Page(net.widthMm, net.heightMm);
    header(page, data, `Bantal Kertas — lembar ${si + 1} dari ${total} · ${opts?.paper ?? "A4"} · sekitar 10 menit untuk merakit`);
    if (opts?.production) {
      page.text(
        `BERKAS PRODUKSI · status template: ${(opts.qcStatus ?? "perlu ditinjau").replace(/_/g, " ")} · format bantal kertas (kedua panel = gambar pelanggan)`,
        12, 21.5, 8, "#6F6157",
      );
    }
    legend(page, 27);
    for (const piece of pg.pieces) renderPillowPiece(page, data, piece, net);
    page.text(
      "Orang dewasa: mohon yang menggunting. Kedua panel adalah gambar anak sendiri — gunting tepat pada garis bentuknya.",
      12, net.heightMm - 8, 9, "#6F6157",
    );
    sheets.push(page);
  });
  const p2 = new Page(210, 297);
  header(p2, data, "Cara membuat Bantal Kertasmu");
  net.steps.forEach((step, i) => {
    p2.circle(16, 34 + i * 11, 3.6, "#FFC93C", INK, 0.8);
    p2.text(String(i + 1), 16, 35.6 + i * 11, 9, INK, { bold: true, align: "center" });
    p2.text(step, 23, 35.6 + i * 11, 10.5, INK, { maxWidthMm: 168 });
  });
  const artY = 40 + net.steps.length * 11;
  p2.text("Gambar jadimu", 12, artY, 12, INK, { bold: true });
  drawArtwork(p2, data, 30, artY + 4, 150, { withStrokes: true });
  const nameLine = data.name.trim()
    ? `${data.name.trim()}${data.message.trim() ? ` — ${data.message.trim()}` : ""}`
    : "Bantal kertasku";
  p2.text(nameLine, 105, artY + 4 + (150 * data.template.viewBox[1]) / data.template.viewBox[0] + 10, 11, data.nameColor, {
    bold: true, align: "center", maxWidthMm: 170,
  });
  p2.text(
    "Tips: kertas lebih tebal (160–200 gsm) membuat bantal lebih kokoh. Cetak pada skala 100% supaya gusset melingkari garis bentuk dengan pas.",
    12, 282, 9, "#6F6157", { maxWidthMm: 186 },
  );
  p2.text("Dianjurkan didampingi orang dewasa saat menggunting dan merekatkan.", 12, 288, 9, "#6F6157");
  return buildPdf([...sheets, p2], `${data.template.name} Bantal Kertas`);
}

export function buildStandeePdf(data: PrintData): Blob {
  const t = data.template;
  const p = new Page(210, 297);
  header(p, data, "Standee 3D Mudah — gunting, lipat alasnya, berdirikan");
  legend(p, 24);
  const artW = 148;
  const artH = (artW * t.viewBox[1]) / t.viewBox[0];
  const artX = (210 - artW) / 2;
  const artY = 34;
  drawArtwork(p, data, artX, artY, artW, { strokeW: 2, withStrokes: true });
  // Name on the artwork plaque area is part of the artwork? Draw name text under art instead on the base.
  const baseY = artY + artH + 2;
  // Fold line where art meets base.
  p.line([artX, baseY], [artX + artW, baseY], INK, 1, true);
  // Base strip: three segments forming a triangular fold-under base.
  const segH = [13, 20, 13];
  let y = baseY;
  const labels = ["lipat", "alas — sisi ini menyentuh meja", "rekatkan di bawah alas"];
  segH.forEach((h, i) => {
    p.fillPolygon([[artX, y], [artX + artW, y], [artX + artW, y + h], [artX, y + h]], i === 2 ? "#EFECE6" : "#FFF6E0");
    p.strokePolygon([[artX, y], [artX + artW, y], [artX + artW, y + h], [artX, y + h]], INK, 1.1);
    p.text(labels[i]!, artX + artW / 2, y + h / 2 + 1.6, 8.5, "#6F6157", { align: "center" });
    y += h;
    if (i < segH.length - 1) p.line([artX, y], [artX + artW, y], INK, 0.9, true);
  });
  if (data.name.trim()) {
    p.text(data.name.trim().toUpperCase(), artX + artW / 2, baseY + segH[0]! + 12.5, 15, data.nameColor, {
      bold: true, align: "center", maxWidthMm: artW - 16,
    });
  }
  const iy = y + 10;
  p.text("1. Gunting mengelilingi seluruh gambar (garis tebal). Orang dewasa yang menggunting!", 12, iy, 10.5, INK);
  p.text("2. Lipat pada setiap garis putus-putus. Lipat alasnya menjauhi kamu, lalu ke bawah.", 12, iy + 7, 10.5, INK);
  p.text("3. Rekatkan flap terakhir di bawah alas sampai membentuk segitiga. Berdirikan — ta-da!", 12, iy + 14, 10.5, INK);
  if (data.message.trim()) {
    p.text(data.message.trim(), 105, iy + 26, 11, data.nameColor, { bold: true, align: "center", maxWidthMm: 180 });
  }
  p.text("Dianjurkan didampingi orang dewasa saat menggunting dan melipat.", 12, 288, 9, "#6F6157");
  return buildPdf([p], `${t.name} Easy Standee`);
}
