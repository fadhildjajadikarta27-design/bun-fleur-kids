// Katalog utama Bun & Fleur Kids — 180 ilustrasi yang melengkapi 20
// ilustrasi gambar-tangan di premium.ts menjadi tepat 200 karakter,
// 40 per kategori umur. Semua dibangun dengan bahasa desain yang sama:
// siluet organik bulat, wajah ramah, garis bersih, region SVG tertutup
// dengan id stabil, dan bagian papercraft 3D dari primitif yang sama —
// jadi setiap karakter bisa diwarnai ketuk-untuk-mengisi, diputar
// sebagai model digital Bantal Kertas maupun mesh 3D, dan dicetak.
//
// Tingkat kesulitan mengikuti sistem level per kategori umur:
//   Level 1 (9–18 bln)  : 2–3 bidang sangat besar, satu subjek tunggal.
//   Level 2 (18–24 bln) : 4–5 bidang besar + satu elemen pendamping.
//   Level 3 (2–3 th)    : 6–8 bidang dengan detail karakter.
//   Level 4 (3–4 th)    : 9–13 bidang, karakter + lingkungan sederhana.
//   Level 5 (4–5 th)    : 15–22 bidang, adegan bercerita yang kaya.

import type { DetailEl, NetDef, NetOptions, Pt, RegionDef, SvgEl, TemplateDef } from "./model";
import { INK } from "./model";
import {
  boxPart,
  buildCraftNet,
  discPoly,
  flatPart,
  lathePart,
  partsToFaces,
  prismPart,
  type CraftPart,
  type XfOpts,
} from "./papercraft";

/* ------------------------- helper bersama ------------------------- */

function memoParts(build: () => CraftPart[]): () => CraftPart[] {
  let cache: CraftPart[] | null = null;
  return () => (cache ??= build());
}

function ballPart(o: {
  id: string; label: string; assembly: string; r: number;
  region: string; transform?: XfOpts; segments?: number;
}): CraftPart {
  const R = o.r;
  return lathePart({
    id: o.id, label: o.label, assembly: o.assembly,
    profile: [
      { r: 0, y: -R },
      { r: R * 0.7071, y: -R * 0.7071 },
      { r: R, y: 0 },
      { r: R * 0.7071, y: R * 0.7071 },
      { r: 0, y: R },
    ],
    segments: o.segments ?? 8,
    region: o.region,
    transform: o.transform,
  });
}

function cylPart(o: {
  id: string; label: string; assembly: string; r: number; h: number;
  region: string; capRegion?: string; transform?: XfOpts; segments?: number;
}): CraftPart {
  return lathePart({
    id: o.id, label: o.label, assembly: o.assembly,
    profile: [{ r: o.r, y: -o.h / 2 }, { r: o.r, y: o.h / 2 }],
    segments: o.segments ?? 10,
    region: o.region,
    capBottomRegion: o.capRegion ?? o.region,
    capTopRegion: o.capRegion ?? o.region,
    transform: o.transform,
  });
}

function conePart(o: {
  id: string; label: string; assembly: string; r: number; h: number;
  region: string; transform?: XfOpts; segments?: number;
}): CraftPart {
  return lathePart({
    id: o.id, label: o.label, assembly: o.assembly,
    profile: [{ r: o.r, y: -o.h / 2 }, { r: 0, y: o.h / 2 }],
    segments: o.segments ?? 8,
    region: o.region,
    capBottomRegion: o.region,
    transform: o.transform,
  });
}

/** Badan telur tegak dengan tambalan perut di faset depan-bawah. */
function eggBodyPart(o: {
  id: string; label: string; assembly: string;
  body: string; belly?: string; transform?: XfOpts;
}): CraftPart {
  return lathePart({
    id: o.id, label: o.label, assembly: o.assembly,
    profile: [
      { r: 0, y: -0.52 },
      { r: 0.30, y: -0.50 },
      { r: 0.47, y: -0.34 },
      { r: 0.56, y: -0.10 },
      { r: 0.57, y: 0.14 },
      { r: 0.50, y: 0.36 },
      { r: 0.34, y: 0.50 },
      { r: 0, y: 0.56 },
    ],
    segments: 8,
    region: (band, seg) =>
      o.belly && (band === 2 || band === 3) && seg >= 1 && seg <= 3 ? o.belly : o.body,
    transform: o.transform,
  });
}

/** Badan telur rebah (hewan profil samping) dengan perut di faset bawah-depan. */
function sideBodyPart(o: {
  id: string; label: string; assembly: string;
  body: string; belly?: string; transform?: XfOpts;
}): CraftPart {
  return lathePart({
    id: o.id, label: o.label, assembly: o.assembly,
    profile: [
      { r: 0, y: -0.52 },
      { r: 0.30, y: -0.50 },
      { r: 0.47, y: -0.34 },
      { r: 0.56, y: -0.10 },
      { r: 0.57, y: 0.14 },
      { r: 0.50, y: 0.36 },
      { r: 0.34, y: 0.50 },
      { r: 0, y: 0.56 },
    ],
    segments: 8,
    region: (band, seg) =>
      o.belly && band <= 1 && seg >= 1 && seg <= 3 ? o.belly : o.body,
    transform: { r: [0, 0, Math.PI / 2], ...o.transform, t: o.transform?.t },
  });
}

function nameplatePart(who: string): CraftPart {
  return boxPart({
    id: "nameplate", label: "Papan Nama",
    assembly: `Lipat plakat papan nama, rekatkan tab-nya, dan berdirikan di depan ${who} kamu.`,
    w: 1.15, h: 0.34, d: 0.10,
    regions: { front: "__nameplate", back: "plate", left: "plate", right: "plate", top: "plate", bottom: "plate" },
    nameplate: true,
    transform: { r: [-0.12, 0, 0], t: [0, -0.995, 0.68] },
  });
}

const LBL = { x: 150, y: 312, w: 180, h: 38 };
const STEP_GUNTING = "Gunting mengikuti garis tebal. Orang dewasa yang menggunting!";
const STEP_LIPAT = "Tekuk dulu semua garis lipat: lipatan gunung menonjol ke atas, lipatan lembah masuk ke dalam.";

function stepsFrom(parts: CraftPart[]): string[] {
  return [
    STEP_GUNTING,
    STEP_LIPAT,
    ...parts.filter((p) => p.id !== "nameplate").map((p) => `${p.label}: ${p.assembly}`),
    "Papan nama: lipat papan nama dan berdirikan di depan. Selesai!",
  ];
}

/** Peta Mode Mudah yang dikumpulkan dari semua template di file ini. */
export const KOLEKSI_EASY_MERGES: Record<string, Record<string, string>> = {};

interface BuiltArt {
  regions: RegionDef[];
  details: DetailEl[];
  parts: CraftPart[];
  fallbacks?: Record<string, string>;
  merges?: Record<string, string>;
}

interface Meta {
  id: string;
  name: string;
  collection: string;
  blurb: string;
  band: "9-18bln" | "1-2th" | "2-3th" | "3-4th" | "4-5th";
  who: string;
}

const BAND_AGE: Record<Meta["band"], string> = {
  "9-18bln": "9–18 bulan",
  "1-2th": "18–24 bulan",
  "2-3th": "2–3 tahun",
  "3-4th": "3–4 tahun",
  "4-5th": "4–5 tahun",
};
const BAND_DIFF: Record<Meta["band"], 1 | 2 | 3> = {
  "9-18bln": 1, "1-2th": 1, "2-3th": 2, "3-4th": 3, "4-5th": 3,
};

function finish(meta: Meta, art: BuiltArt): TemplateDef {
  const parts = memoParts(() => [...art.parts, nameplatePart(meta.who)]);
  if (art.merges) KOLEKSI_EASY_MERGES[meta.id] = art.merges;
  return {
    id: meta.id,
    name: meta.name,
    collection: meta.collection,
    blurb: meta.blurb,
    age: BAND_AGE[meta.band],
    ageBand: meta.band,
    difficulty: BAND_DIFF[meta.band],
    viewBox: [480, 360],
    regions: art.regions,
    details: art.details,
    label: LBL,
    regionFallbacks: art.fallbacks,
    buildParts: parts,
    buildModel: () => partsToFaces(parts()),
    buildNet: (opts?: NetOptions): NetDef =>
      buildCraftNet(parts(), opts, { steps: stepsFrom(parts()), orientation: "portrait" }).net,
  };
}

/* ------------------------- helper gambar ------------------------- */

const E = (cx: number, cy: number, rx: number, ry: number): SvgEl => ({ t: "ellipse", cx, cy, rx, ry });
const Ci = (cx: number, cy: number, r: number): SvgEl => ({ t: "circle", cx, cy, r });
const Rc = (x: number, y: number, w: number, h: number, rx = 8): SvgEl => ({ t: "rect", x, y, w, h, rx });
const Pa = (d: string): SvgEl => ({ t: "path", d });

/** Path mulus tertutup melewati titik-titik (kurva Catmull-Rom → Bézier). */
function smooth(pts: Pt[], close = true): string {
  const n = pts.length;
  if (n < 3) return `M${pts.map((p) => `${p[0]} ${p[1]}`).join(" L")}${close ? " Z" : ""}`;
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return close ? d + " Z" : d;
}

function eyesAt(cx: number, cy: number, dx: number, r = 8): DetailEl[] {
  const one = (x: number): DetailEl[] => [
    { el: Ci(x, cy, r), fill: INK },
    { el: Ci(x + r * 0.35, cy - r * 0.35, r * 0.38), fill: "#FFFFFF" },
  ];
  return dx === 0 ? one(cx) : [...one(cx - dx), ...one(cx + dx)];
}

function smileAt(cx: number, cy: number, w = 26): DetailEl {
  return { el: Pa(`M${cx - w / 2} ${cy} Q${cx} ${cy + w * 0.55} ${cx + w / 2} ${cy}`), stroke: INK, sw: 4.5 };
}

function cheeksAt(cx: number, cy: number, dx: number, r = 11): DetailEl[] {
  if (dx === 0) return [{ el: Ci(cx, cy, r), fill: "#F2A0B5" }];
  return [
    { el: Ci(cx - dx, cy, r), fill: "#F2A0B5" },
    { el: Ci(cx + dx, cy, r), fill: "#F2A0B5" },
  ];
}

function groundAt(cy = 300, rx = 150): DetailEl {
  return { el: E(240, cy, rx, 10), fill: "#3B323014" };
}

/** Pemetaan koordinat SVG (480×360, tanah di y≈292) ke ruang 3D pratinjau
 * (tanah 3D di y≈−1, sama seperti model katalog yang sudah ada). */
const MX = (x: number) => (x - 240) / 165;
const MY = (y: number) => (292 - y) / 165 - 1;
const MS = (s: number) => s / 165;

/* ================================================================== */
/* PEMBANGUN KELUARGA — hewan bundar tampak depan ("buddy")            */
/* ================================================================== */

type EarKind = "round" | "pointy" | "long" | "floppy" | "tuft" | "horn" | "none";

interface BuddyOpts {
  earKind: EarKind;
  belly?: boolean;
  muzzle?: boolean;
  wings?: boolean;
  tailSide?: boolean;
  woolTop?: boolean;
  spikesTop?: boolean;
  nose?: "round" | "beak" | "pig" | "big" | "none";
  eyeDx?: number;
  eyeY?: number;
  bodyRx?: number;
  bodyRy?: number;
  bodyCy?: number;
  accessory?: { id: string; label: string; els: SvgEl[]; part: CraftPart };
  extraDetails?: DetailEl[];
}

function buddyArt(o: BuddyOpts): BuiltArt {
  const rx = o.bodyRx ?? 106, ry = o.bodyRy ?? 90, cy = o.bodyCy ?? 202;
  const eyeY = o.eyeY ?? cy - 20;
  const eyeDx = o.eyeDx ?? 36;
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [groundAt(298, 130)];

  if (o.tailSide) {
    regions.push({ id: "tail", label: "Ekor", els: [Ci(240 + rx + 6, cy + 52, 20)] });
    parts.push(ballPart({ id: "tail", label: "Ekor", assembly: "Buat bola ekor kecil dan rekatkan di sisi badan.", r: 0.13, region: "tail", transform: { t: [0.78, -0.55, -0.1] } }));
  }
  // Telinga digambar sebelum badan supaya pangkalnya tertutup badan.
  const earRegion: RegionDef = { id: "ears", label: "Telinga", els: [] };
  const earParts: CraftPart[] = [];
  const ex = 240 - rx * 0.62, ex2 = 240 + rx * 0.62, ey = cy - ry * 0.82;
  switch (o.earKind) {
    case "round":
      earRegion.els = [Ci(ex, ey, 30), Ci(ex2, ey, 30)];
      earParts.push(
        ballPart({ id: "ear-l", label: "Telinga", assembly: "Buat dua bola telinga dan rekatkan di atas kepala.", r: 0.19, region: "ears", transform: { t: [-0.55, 0.30, 0] } }),
        ballPart({ id: "ear-r", label: "Telinga", assembly: "Buat dua bola telinga dan rekatkan di atas kepala.", r: 0.19, region: "ears", transform: { t: [0.55, 0.30, 0] } }),
      );
      break;
    case "pointy":
      earRegion.els = [
        Pa(`M${ex - 26} ${ey + 26} L${ex - 6} ${ey - 34} L${ex + 22} ${ey + 14} Z`),
        Pa(`M${ex2 + 26} ${ey + 26} L${ex2 + 6} ${ey - 34} L${ex2 - 22} ${ey + 14} Z`),
      ];
      earParts.push(
        prismPart({ id: "ear-l", label: "Telinga", assembly: "Lipat dua telinga lancip dan rekatkan di atas kepala.", poly: [[-0.16, -0.16], [0.16, -0.16], [0, 0.24]], depth: 0.09, region: "ears", transform: { t: [-0.52, 0.36, 0], r: [0, 0, 0.25] } }),
        prismPart({ id: "ear-r", label: "Telinga", assembly: "Lipat dua telinga lancip dan rekatkan di atas kepala.", poly: [[-0.16, -0.16], [0.16, -0.16], [0, 0.24]], depth: 0.09, region: "ears", transform: { t: [0.52, 0.36, 0], r: [0, 0, -0.25] } }),
      );
      break;
    case "long":
      earRegion.els = [
        Pa(`M${ex - 18} ${ey + 20} C${ex - 30} ${ey - 52} ${ex + 6} ${ey - 62} ${ex + 12} ${ey - 6} C${ex + 14} ${ey + 16} ${ex - 8} ${ey + 28} ${ex - 18} ${ey + 20} Z`),
        Pa(`M${ex2 + 18} ${ey + 20} C${ex2 + 30} ${ey - 52} ${ex2 - 6} ${ey - 62} ${ex2 - 12} ${ey - 6} C${ex2 - 14} ${ey + 16} ${ex2 + 8} ${ey + 28} ${ex2 + 18} ${ey + 20} Z`),
      ];
      earParts.push(
        cylPart({ id: "ear-l", label: "Telinga", assembly: "Gulung dua telinga panjang dan rekatkan di atas kepala.", r: 0.10, h: 0.52, region: "ears", transform: { t: [-0.5, 0.40, 0], r: [0, 0, 0.18], s: [1, 1, 0.6] } }),
        cylPart({ id: "ear-r", label: "Telinga", assembly: "Gulung dua telinga panjang dan rekatkan di atas kepala.", r: 0.10, h: 0.52, region: "ears", transform: { t: [0.5, 0.40, 0], r: [0, 0, -0.18], s: [1, 1, 0.6] } }),
      );
      break;
    case "floppy":
      earRegion.els = [E(240 - rx - 2, cy - 26, 24, 46), E(240 + rx + 2, cy - 26, 24, 46)];
      earParts.push(
        ballPart({ id: "ear-l", label: "Telinga", assembly: "Buat dua telinga terkulai dan rekatkan di sisi kepala.", r: 0.20, region: "ears", transform: { s: [0.55, 1.15, 0.5], t: [-0.78, 0.05, 0] } }),
        ballPart({ id: "ear-r", label: "Telinga", assembly: "Buat dua telinga terkulai dan rekatkan di sisi kepala.", r: 0.20, region: "ears", transform: { s: [0.55, 1.15, 0.5], t: [0.78, 0.05, 0] } }),
      );
      break;
    case "tuft":
      earRegion.els = [
        Pa(`M${ex - 16} ${ey + 14} C${ex - 20} ${ey - 18} ${ex + 2} ${ey - 26} ${ex + 14} ${ey + 6} C${ex + 4} ${ey + 14} ${ex - 8} ${ey + 18} ${ex - 16} ${ey + 14} Z`),
        Pa(`M${ex2 + 16} ${ey + 14} C${ex2 + 20} ${ey - 18} ${ex2 - 2} ${ey - 26} ${ex2 - 14} ${ey + 6} C${ex2 - 4} ${ey + 14} ${ex2 + 8} ${ey + 18} ${ex2 + 16} ${ey + 14} Z`),
      ];
      earParts.push(
        prismPart({ id: "ear-l", label: "Jambul", assembly: "Lipat dua jambul kecil dan rekatkan di atas kepala.", poly: [[-0.12, -0.1], [0.12, -0.1], [0, 0.18]], depth: 0.08, region: "ears", transform: { t: [-0.48, 0.38, 0] } }),
        prismPart({ id: "ear-r", label: "Jambul", assembly: "Lipat dua jambul kecil dan rekatkan di atas kepala.", poly: [[-0.12, -0.1], [0.12, -0.1], [0, 0.18]], depth: 0.08, region: "ears", transform: { t: [0.48, 0.38, 0] } }),
      );
      break;
    case "horn":
      earRegion.els = [Ci(ex, ey, 24), Ci(ex2, ey, 24)];
      details.push(
        { el: Pa(`M${ex - 20} ${ey - 34} C${ex - 8} ${ey - 52} ${ex + 10} ${ey - 50} ${ex + 16} ${ey - 36}`), stroke: INK, sw: 9 },
        { el: Pa(`M${ex2 + 20} ${ey - 34} C${ex2 + 8} ${ey - 52} ${ex2 - 10} ${ey - 50} ${ex2 - 16} ${ey - 36}`), stroke: INK, sw: 9 },
      );
      earParts.push(
        ballPart({ id: "ear-l", label: "Telinga", assembly: "Buat dua bola telinga dan rekatkan di atas kepala.", r: 0.16, region: "ears", transform: { t: [-0.55, 0.30, 0] } }),
        ballPart({ id: "ear-r", label: "Telinga", assembly: "Buat dua bola telinga dan rekatkan di atas kepala.", r: 0.16, region: "ears", transform: { t: [0.55, 0.30, 0] } }),
      );
      break;
    case "none":
      break;
  }
  if (o.earKind !== "none") {
    regions.push(earRegion);
    parts.push(...earParts);
  }
  if (o.spikesTop) {
    regions.push({ id: "spikes", label: "Duri", els: [
      Pa(smooth([[240 - rx * 0.7, cy - ry * 0.55], [240 - rx * 0.45, cy - ry * 1.12], [240 - rx * 0.15, cy - ry * 0.7], [240, cy - ry * 1.18], [240 + rx * 0.15, cy - ry * 0.7], [240 + rx * 0.45, cy - ry * 1.12], [240 + rx * 0.7, cy - ry * 0.55], [240, cy - ry * 0.28]])),
    ] });
    parts.push(prismPart({ id: "spikes", label: "Duri Punggung", assembly: "Lipat mahkota duri dan rekatkan di punggung atas.", poly: [[-0.5, -0.1], [-0.3, 0.22], [-0.1, -0.02], [0.1, 0.24], [0.3, -0.02], [0.5, 0.2], [0.52, -0.12]], depth: 0.3, region: "spikes", transform: { t: [0, 0.30, -0.18] } }));
  }
  if (o.woolTop) {
    regions.push({ id: "wool", label: "Wol", els: [
      Pa(smooth([[240 - 62, cy - ry + 26], [240 - 66, cy - ry - 8], [240 - 34, cy - ry - 22], [240, cy - ry - 28], [240 + 34, cy - ry - 22], [240 + 66, cy - ry - 8], [240 + 62, cy - ry + 26], [240 + 30, cy - ry + 14], [240, cy - ry + 22], [240 - 30, cy - ry + 14]])),
    ] });
    parts.push(ballPart({ id: "wool", label: "Wol", assembly: "Buat gumpalan wol dan rekatkan di atas kepala.", r: 0.34, region: "wool", transform: { s: [1.35, 0.62, 1], t: [0, 0.38, 0.05] } }));
  }
  regions.push({ id: "body", label: "Badan", els: [E(240, cy, rx, ry)] });
  parts.push(eggBodyPart({
    id: "body", label: "Badan",
    assembly: "Rekatkan strip badan menjadi bentuk telur bundar. Tambalan perut menghadap ke depan.",
    body: "body", belly: o.belly ? "belly" : undefined,
    transform: { s: [rx / 82, ry / 82, 0.88], t: [0, -0.28, 0] },
  }));
  if (o.wings) {
    regions.push({ id: "wings", label: "Sayap", els: [
      Pa(`M${240 - rx + 8} ${cy - 6} C${240 - rx - 34} ${cy + 8} ${240 - rx - 30} ${cy + 52} ${240 - rx + 16} ${cy + 62} C${240 - rx + 2} ${cy + 36} ${240 - rx + 2} ${cy + 12} ${240 - rx + 8} ${cy - 6} Z`),
      Pa(`M${240 + rx - 8} ${cy - 6} C${240 + rx + 34} ${cy + 8} ${240 + rx + 30} ${cy + 52} ${240 + rx - 16} ${cy + 62} C${240 + rx - 2} ${cy + 36} ${240 + rx - 2} ${cy + 12} ${240 + rx - 8} ${cy - 6} Z`),
    ] });
    parts.push(
      prismPart({ id: "wing-l", label: "Sayap", assembly: "Lipat dua sayap dan rekatkan di sisi badan.", poly: [[0, 0.3], [0.26, 0.05], [0.2, -0.32], [-0.05, -0.28]], depth: 0.08, region: "wings", transform: { t: [-0.72, -0.1, 0] } }),
      prismPart({ id: "wing-r", label: "Sayap", assembly: "Lipat dua sayap dan rekatkan di sisi badan.", poly: [[0, 0.3], [-0.26, 0.05], [-0.2, -0.32], [0.05, -0.28]], depth: 0.08, region: "wings", transform: { t: [0.72, -0.1, 0] } }),
    );
  }
  if (o.belly) {
    regions.push({ id: "belly", label: "Perut", els: [E(240, cy + 36, 52, 42)] });
    parts.push(flatPart({ id: "belly", label: "Perut", assembly: "Tempelkan perut bundar di bagian depan badan.", poly: discPoly(0.40), region: "belly", transform: { s: [1, 0.85, 1], t: [0, -0.38, 0.52] } }));
  }
  if (o.muzzle) {
    regions.push({ id: "muzzle", label: "Moncong", els: [E(240, cy + 26, 42, 28)] });
    parts.push(flatPart({ id: "muzzle", label: "Moncong", assembly: "Tempelkan moncong di bawah wajah.", poly: discPoly(0.26), region: "muzzle", transform: { s: [1.3, 0.85, 1], t: [0, -0.12, 0.52] } }));
  }
  if (o.accessory) {
    regions.push({ id: o.accessory.id, label: o.accessory.label, els: o.accessory.els });
    parts.push(o.accessory.part);
  }
  // Wajah
  details.push(...eyesAt(240, eyeY, eyeDx, 9));
  if (o.nose === "round") {
    details.push({ el: E(240, eyeY + 22, 13, 9), fill: INK }, smileAt(240, eyeY + 34, 24));
  } else if (o.nose === "beak") {
    details.push({ el: Pa(`M226 ${eyeY + 16} L254 ${eyeY + 16} L240 ${eyeY + 34} Z`), fill: "#F4842B", stroke: INK, sw: 3 });
  } else if (o.nose === "pig") {
    details.push(
      { el: Ci(240 - 9, eyeY + 26, 4.5), fill: INK },
      { el: Ci(240 + 9, eyeY + 26, 4.5), fill: INK },
      smileAt(240, eyeY + 44, 22),
    );
  } else if (o.nose === "big") {
    details.push({ el: E(240, eyeY + 20, 17, 22), fill: "#3B3230" }, smileAt(240, eyeY + 48, 20));
  }
  if (o.nose !== "none" && o.nose !== "pig") details.push(...cheeksAt(240, eyeY + 32, eyeDx + 38));
  if (o.extraDetails) details.push(...o.extraDetails);
  const merges: Record<string, string> = {};
  if (o.accessory) merges[o.accessory.id] = "body";
  if (o.muzzle && o.belly) merges.muzzle = "body";
  return { regions, details, parts, merges: Object.keys(merges).length ? merges : undefined };
}

/* ================================================================== */
/* PEMBANGUN KELUARGA — hewan profil samping ("quad")                  */
/* ================================================================== */

interface QuadOpts {
  neck?: boolean;
  pattern?: { id: string; label: string; els: SvgEl[] };
  saddle?: boolean;
  belly?: boolean;
  tailKind?: "tuft" | "curl" | "long" | "stub";
  earKind?: "round" | "pointy" | "long" | "none";
  headR?: number;
  accessory?: { id: string; label: string; els: SvgEl[]; part: CraftPart };
  extraDetails?: DetailEl[];
  merges?: Record<string, string>;
}

function quadArt(o: QuadOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [groundAt(298, 155)];
  const headR = o.headR ?? 48;
  const headCx = o.neck ? 388 : 356, headCy = o.neck ? 92 : 138;

  // Ekor
  const tailD = o.tailKind === "curl"
    ? "M118 168 C84 160 66 132 82 112 C94 98 112 104 114 120 C116 134 104 140 98 132"
    : o.tailKind === "long"
      ? "M120 160 C76 168 52 200 58 232 C62 252 82 256 94 244 L126 196 C134 178 132 164 120 160 Z"
      : o.tailKind === "stub"
        ? "M122 176 C104 172 96 158 104 146 C112 136 128 142 130 156 C131 168 130 178 122 176 Z"
        : "M120 158 C88 148 74 122 88 104 C112 116 128 138 128 158 Z";
  regions.push({ id: "tail", label: "Ekor", els: [Pa(tailD)] });
  parts.push(conePart({ id: "tail", label: "Ekor", assembly: "Gulung ekor menjadi kerucut dan rekatkan di belakang badan.", r: 0.11, h: 0.55, region: "tail", transform: { r: [0, 0, -1.9], t: [-0.72, 0.05, -0.08] } }));

  // Badan
  regions.push({ id: "body", label: "Badan", els: [
    Pa("M118 168 C120 118 168 88 232 90 C296 92 332 124 334 172 C336 220 306 254 256 260 L168 260 C138 246 116 216 118 168 Z"),
  ] });
  parts.push(sideBodyPart({
    id: "body", label: "Badan",
    assembly: "Rekatkan strip badan menjadi bentuk telur rebah. Perut menghadap ke bawah-depan.",
    body: "body", belly: o.belly ? "belly" : undefined,
    transform: { s: [1.3, 0.92, 0.85], t: [-0.08, -0.28, 0] },
  }));

  // Kaki
  regions.push({ id: "legs", label: "Kaki", els: [E(172, 268, 27, 12), E(282, 268, 27, 12)] });
  parts.push(
    cylPart({ id: "leg-l", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah badan.", r: 0.16, h: 0.24, region: "legs", transform: { t: [-0.44, -0.88, 0.14] } }),
    cylPart({ id: "leg-r", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah badan.", r: 0.16, h: 0.24, region: "legs", transform: { t: [0.28, -0.88, 0.14] } }),
  );

  if (o.belly) {
    regions.push({ id: "belly", label: "Perut", els: [
      Pa("M168 196 C200 188 268 188 300 198 C296 232 268 252 232 252 C198 252 174 230 168 196 Z"),
    ] });
  }
  if (o.pattern) {
    regions.push({ id: o.pattern.id, label: o.pattern.label, els: o.pattern.els });
    o.pattern.els.forEach((el, i) => {
      if (el.t === "circle" || el.t === "ellipse") {
        const cx = el.cx, cyv = el.cy, r = el.t === "circle" ? el.r : el.rx;
        parts.push(flatPart({ id: `pat-${i}`, label: o.pattern!.label, assembly: `Tempelkan corak ${o.pattern!.label.toLowerCase()} di sisi badan.`, poly: discPoly(MS(r)), region: o.pattern!.id, transform: { t: [MX(cx), MY(cyv), 0.52] } }));
      } else if (el.t === "path") {
        parts.push(flatPart({ id: `pat-${i}`, label: o.pattern!.label, assembly: `Tempelkan corak ${o.pattern!.label.toLowerCase()} di sisi badan.`, poly: rectPolyLocal(0.1, 0.36), region: o.pattern!.id, transform: { t: [MX(185 + i * 42), -0.32, 0.52] } }));
      }
    });
  }
  if (o.neck) {
    regions.push({ id: "neck", label: "Leher", els: [
      Pa("M318 158 C330 108 348 66 372 44 L404 58 C392 92 384 128 380 162 C360 172 334 170 318 158 Z"),
    ] });
    parts.push(cylPart({ id: "neck", label: "Leher", assembly: "Gulung leher menjadi tabung miring dan rekatkan antara badan dan kepala.", r: 0.20, h: 0.85, region: "neck", transform: { r: [0, 0, -0.5], t: [0.62, 0.28, 0] } }));
  }
  if (o.saddle) {
    regions.push({ id: "saddle", label: "Pelana", els: [Rc(196, 96, 76, 34, 12)] });
    parts.push(boxPart({ id: "saddle", label: "Pelana", assembly: "Lipat pelana dan letakkan di punggung.", w: 0.5, h: 0.16, d: 0.55, regions: { front: "saddle", back: "saddle", left: "saddle", right: "saddle", top: "saddle", bottom: "saddle" }, transform: { t: [-0.05, 0.28, 0] } }));
  }

  // Kepala + telinga
  if (o.earKind !== "none") {
    const earEls: SvgEl[] = o.earKind === "pointy"
      ? [Pa(`M${headCx - 30} ${headCy - headR + 16} L${headCx - 18} ${headCy - headR - 22} L${headCx + 2} ${headCy - headR + 10} Z`)]
      : o.earKind === "long"
        ? [Pa(`M${headCx - 34} ${headCy - 20} C${headCx - 52} ${headCy + 8} ${headCx - 44} ${headCy + 42} ${headCx - 24} ${headCy + 44} C${headCx - 16} ${headCy + 22} ${headCx - 20} ${headCy - 6} ${headCx - 34} ${headCy - 20} Z`)]
        : [Ci(headCx - 26, headCy - headR + 8, 17)];
    regions.push({ id: "ears", label: "Telinga", els: earEls });
    parts.push(ballPart({ id: "ears", label: "Telinga", assembly: "Buat bola telinga dan rekatkan di atas kepala.", r: 0.13, region: "ears", transform: { t: [MX(headCx) - 0.15, MY(headCy) + 0.3, 0] } }));
  }
  regions.push({ id: "head", label: "Kepala", els: [Ci(headCx, headCy, headR)] });
  parts.push(ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di depan badan.", r: MS(headR), region: "head", transform: { t: [MX(headCx), MY(headCy), 0] } }));

  if (o.accessory) {
    regions.push({ id: o.accessory.id, label: o.accessory.label, els: o.accessory.els });
    parts.push(o.accessory.part);
  }
  details.push(...eyesAt(headCx + 10, headCy - 6, 0, 8));
  details.push({ el: Ci(headCx + headR - 12, headCy + 14, 4.2), fill: INK });
  details.push({ el: Pa(`M${headCx + 16} ${headCy + 24} C${headCx + 24} ${headCy + 30} ${headCx + 34} ${headCy + 30} ${headCx + 38} ${headCy + 24}`), stroke: INK, sw: 3.5 });
  details.push(...cheeksAt(headCx - 16, headCy + 16, 0, 10));
  if (o.extraDetails) details.push(...o.extraDetails);
  return { regions, details, parts, merges: o.merges };
}

/* ================================================================== */
/* PEMBANGUN KELUARGA — burung ("bird")                                */
/* ================================================================== */


/* ================================================================== */
/* PEMBANGUN KELUARGA — makhluk laut profil ("fish")                    */
/* ================================================================== */

interface FishOpts {
  kind: "fish" | "whale" | "shark" | "dolphin";
  pattern?: { id: string; label: string; els: SvgEl[] };
  bubbles?: boolean;
  merges?: Record<string, string>;
}

function fishArt(o: FishOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [];
  if (o.bubbles) {
    regions.push({ id: "bubbles", label: "Gelembung", els: [Ci(392, 84, 13), Ci(416, 112, 9), Ci(378, 118, 7)] });
    parts.push(
      ballPart({ id: "bub-1", label: "Gelembung", assembly: "Buat bola-bola gelembung kecil dan susun melayang di dekat mulut.", r: 0.08, region: "bubbles", transform: { t: [0.95, 0.55, 0.1] } }),
      ballPart({ id: "bub-2", label: "Gelembung", assembly: "Buat bola-bola gelembung kecil dan susun melayang di dekat mulut.", r: 0.06, region: "bubbles", transform: { t: [1.05, 0.3, 0] } }),
    );
  }
  const bodyD = o.kind === "whale"
    ? "M96 190 C110 128 176 92 252 94 C330 96 384 140 388 196 C390 240 356 268 300 274 L150 274 C116 254 90 232 96 190 Z"
    : o.kind === "shark"
      ? "M92 196 C130 148 210 122 292 130 C356 136 398 164 404 196 C398 228 350 252 282 256 L160 254 C124 240 100 224 92 196 Z"
      : o.kind === "dolphin"
        ? "M88 214 C140 156 226 118 312 122 C366 124 402 148 410 178 C390 190 350 192 306 186 C240 178 160 192 118 226 C104 234 92 230 88 214 Z"
        : "M110 192 C140 138 210 108 282 112 C344 116 386 152 390 194 C386 238 338 268 272 270 L176 268 C138 250 114 228 110 192 Z";
  // Ekor
  const tailD = o.kind === "whale" || o.kind === "shark"
    ? "M104 168 C76 140 52 138 40 158 C58 176 60 196 44 220 C62 234 88 224 108 196 Z"
    : "M118 160 C92 132 64 128 52 150 C68 172 70 196 54 222 C72 236 100 224 120 196 Z";
  regions.push({ id: "tail", label: "Ekor", els: [Pa(tailD)] });
  parts.push(prismPart({ id: "tail", label: "Ekor", assembly: "Lipat ekor dan rekatkan di belakang badan.", poly: [[-0.22, 0.3], [0.14, 0.05], [-0.2, -0.3], [0.2, -0.05]], depth: 0.12, region: "tail", transform: { t: [-0.78, -0.3, 0] } }));
  regions.push({ id: "body", label: "Badan", els: [Pa(bodyD)] });
  parts.push(sideBodyPart({
    id: "body", label: "Badan",
    assembly: "Rekatkan strip badan menjadi bentuk telur rebah yang ramping.",
    body: "body", belly: "belly",
    transform: { s: [1.45, 0.8, 0.62], t: [-0.02, -0.42, 0] },
  }));
  regions.push({ id: "belly", label: "Perut", els: [
    Pa(o.kind === "dolphin"
      ? "M150 216 C210 188 300 182 366 190 C330 214 260 230 196 228 C172 226 156 224 150 216 Z"
      : "M150 226 C210 204 310 202 366 218 C336 248 262 262 204 254 C176 248 158 240 150 226 Z"),
  ] });
  // Sirip punggung / sirip sisi
  if (o.kind === "shark" || o.kind === "dolphin") {
    regions.push({ id: "dorsal", label: "Sirip Punggung", els: [Pa("M238 128 C248 100 268 82 292 78 C296 104 288 122 272 132 Z")] });
    parts.push(prismPart({ id: "dorsal", label: "Sirip Punggung", assembly: "Lipat sirip punggung dan rekatkan di atas badan.", poly: [[-0.18, -0.14], [0.05, 0.2], [0.2, -0.12]], depth: 0.09, region: "dorsal", transform: { t: [0.1, 0.02, 0] } }));
  }
  regions.push({ id: "fin", label: "Sirip", els: [
    Pa(o.kind === "whale" ? "M238 252 C252 276 276 288 300 284 C292 262 272 250 250 246 Z" : "M232 238 C244 264 266 278 290 276 C284 252 264 238 244 232 Z"),
  ] });
  parts.push(prismPart({ id: "fin", label: "Sirip", assembly: "Lipat sirip sisi dan rekatkan di bawah badan.", poly: [[-0.16, 0.1], [0.14, 0.16], [0.2, -0.14], [-0.08, -0.16]], depth: 0.09, region: "fin", transform: { t: [0.05, -0.72, 0.2], r: [0.4, 0, 0] } }));
  if (o.kind === "whale") {
    regions.push({ id: "spout", label: "Semburan Air", els: [
      Pa("M232 92 C226 66 210 52 192 48 C206 34 230 34 240 50 C248 34 272 34 286 48 C268 54 254 68 248 92 Z"),
    ] });
    parts.push(prismPart({ id: "spout", label: "Semburan Air", assembly: "Lipat semburan air dan rekatkan di atas kepala paus.", poly: [[-0.3, -0.16], [-0.05, 0.22], [0.1, -0.05], [0.3, 0.2], [0.28, -0.16]], depth: 0.08, region: "spout", transform: { t: [0, 0.28, 0] } }));
  }
  if (o.pattern) {
    regions.push({ id: o.pattern.id, label: o.pattern.label, els: o.pattern.els });
    o.pattern.els.forEach((el, i) => {
      if (el.t === "circle" || el.t === "ellipse") {
        parts.push(flatPart({ id: `fpat-${i}`, label: o.pattern!.label, assembly: "Tempelkan corak di sisi badan.", poly: discPoly(MS(el.t === "circle" ? el.r : el.rx)), region: o.pattern!.id, transform: { t: [MX(el.cx), MY(el.cy), 0.4] } }));
      } else if (el.t === "path") {
        parts.push(flatPart({ id: `fpat-${i}`, label: o.pattern!.label, assembly: "Tempelkan corak di sisi badan.", poly: rectPolyLocal(0.09, 0.34), region: o.pattern!.id, transform: { t: [MX(240 + i * 34 - 34), -0.35, 0.4] } }));
      }
    });
  }
  const eyeX = o.kind === "fish" ? 336 : 348;
  details.push(...eyesAt(eyeX, 168, 0, 9));
  details.push({ el: Pa(`M${eyeX + 22} 196 C${eyeX + 30} 202 ${eyeX + 40} 202 ${eyeX + 46} 196`), stroke: INK, sw: 3.5 });
  details.push(...cheeksAt(eyeX - 26, 192, 0, 10));
  return { regions, details, parts, fallbacks: { belly: "body" }, merges: o.merges };
}

function rectPolyLocal(w: number, h: number): Pt[] {
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
}

/* ================================================================== */
/* PEMBANGUN KELUARGA — kendaraan samping ("vehicle")                  */
/* ================================================================== */

interface VehicleOpts {
  kind: "car" | "bus" | "truck" | "van" | "train";
  stripe?: boolean;
  light?: boolean;
  extra?: { id: string; label: string; els: SvgEl[]; part: CraftPart };
  merges?: Record<string, string>;
}

function vehicleArt(o: VehicleOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [groundAt(300, 165)];
  const wheelEls = [Ci(150, 268, 27), Ci(330, 268, 27)];
  const wheelParts = () => [
    cylPart({ id: "wheel-l", label: "Roda", assembly: "Gulung dua roda dan rekatkan di bawah badan kendaraan.", r: 0.17, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [-0.55, -0.82, 0.28] } }),
    cylPart({ id: "wheel-r", label: "Roda", assembly: "Gulung dua roda dan rekatkan di bawah badan kendaraan.", r: 0.17, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [0.55, -0.82, 0.28] } }),
  ];
  if (o.kind === "truck") {
    regions.push({ id: "cargo", label: "Bak Muatan", els: [Rc(84, 108, 196, 118, 10)] });
    parts.push(boxPart({ id: "cargo", label: "Bak Muatan", assembly: "Lipat bak muatan menjadi kotak besar.", w: 1.15, h: 0.72, d: 0.62, regions: { front: "cargo", back: "cargo", left: "cargo", right: "cargo", top: "cargo", bottom: "cargo" }, transform: { t: [-0.42, -0.3, 0] } }));
    regions.push({ id: "cabin", label: "Kabin", els: [Pa("M292 226 L292 148 C292 132 304 124 320 124 L366 124 C384 124 396 138 402 156 L412 196 C414 212 406 226 392 226 Z")] });
    parts.push(boxPart({ id: "cabin", label: "Kabin", assembly: "Lipat kabin dan rekatkan di depan bak.", w: 0.62, h: 0.62, d: 0.6, regions: { front: "window", back: "cabin", left: "cabin", right: "cabin", top: "cabin", bottom: "cabin" }, transform: { t: [0.62, -0.36, 0] } }));
    regions.push({ id: "window", label: "Jendela", els: [Rc(318, 140, 52, 40, 8)] });
    if (o.stripe) {
      regions.push({ id: "stripe", label: "Garis", els: [Rc(84, 176, 196, 18, 6)] });
      parts.push(flatPart({ id: "stripe", label: "Garis", assembly: "Tempelkan garis warna di sisi bak.", poly: rectPolyLocal(1.15, 0.11), region: "stripe", transform: { t: [-0.42, -0.32, 0.33] } }));
    }
  } else if (o.kind === "train") {
    regions.push({ id: "smoke", label: "Asap", els: [Ci(140, 84, 20), Ci(168, 66, 15), Ci(118, 62, 12)] });
    parts.push(
      ballPart({ id: "smoke-1", label: "Asap", assembly: "Buat gumpalan asap dan susun di atas cerobong.", r: 0.13, region: "smoke", transform: { t: [-0.6, 0.62, 0] } }),
      ballPart({ id: "smoke-2", label: "Asap", assembly: "Buat gumpalan asap dan susun di atas cerobong.", r: 0.10, region: "smoke", transform: { t: [-0.45, 0.78, 0] } }),
    );
    regions.push({ id: "body", label: "Badan Lokomotif", els: [Rc(92, 150, 176, 76, 10)] });
    parts.push(boxPart({ id: "body", label: "Badan Lokomotif", assembly: "Lipat badan lokomotif menjadi kotak panjang.", w: 1.05, h: 0.46, d: 0.58, regions: { front: "body", back: "body", left: "body", right: "body", top: "body", bottom: "body" }, transform: { t: [-0.35, -0.42, 0] } }));
    regions.push({ id: "cabin", label: "Kabin Masinis", els: [Rc(280, 118, 108, 108, 10)] });
    parts.push(boxPart({ id: "cabin", label: "Kabin Masinis", assembly: "Lipat kabin masinis dan rekatkan di belakang lokomotif.", w: 0.64, h: 0.64, d: 0.58, regions: { front: "cabin", back: "cabin", left: "cabin", right: "cabin", top: "cabin", bottom: "cabin" }, transform: { t: [0.55, -0.34, 0] } }));
    regions.push({ id: "window", label: "Jendela", els: [Rc(300, 134, 42, 40, 8), Rc(350, 134, 30, 40, 8)] });
    parts.push(flatPart({ id: "window", label: "Jendela", assembly: "Tempelkan jendela di sisi kabin.", poly: rectPolyLocal(0.5, 0.26), region: "window", transform: { t: [0.55, -0.28, 0.31] } }));
    if (o.stripe) {
      regions.push({ id: "stripe", label: "Garis", els: [Rc(92, 196, 296, 14, 6)] });
      parts.push(flatPart({ id: "stripe", label: "Garis", assembly: "Tempelkan garis warna di sisi kereta.", poly: rectPolyLocal(1.7, 0.09), region: "stripe", transform: { t: [0.05, -0.5, 0.31] } }));
    }
  } else {
    // car / bus / van: satu badan besar + kabin kaca
    const busLike = o.kind !== "car";
    regions.push({ id: "body", label: "Badan", els: [
      Pa(busLike
        ? "M84 226 L84 128 C84 108 96 96 116 96 L356 96 C380 96 394 112 396 136 L398 226 C398 238 390 244 378 244 L104 244 C92 244 84 238 84 226 Z"
        : "M80 226 C80 196 96 178 128 170 L160 162 C176 132 204 116 244 116 L292 116 C330 116 356 134 372 162 L398 172 C416 180 424 196 424 226 C424 238 416 244 404 244 L98 244 C86 244 80 238 80 226 Z"),
    ] });
    parts.push(boxPart({ id: "body", label: "Badan", assembly: "Lipat badan kendaraan menjadi kotak membulat.", w: 1.85, h: 0.78, d: 0.66, regions: { front: "body", back: "body", left: "body", right: "body", top: "body", bottom: "body" }, transform: { t: [0, -0.42, 0] }, splitWalls: true }));
    regions.push({ id: "windows", label: "Jendela", els: busLike
      ? [Rc(108, 118, 52, 44, 8), Rc(172, 118, 52, 44, 8), Rc(236, 118, 52, 44, 8), Rc(300, 118, 66, 44, 8)]
      : [Pa("M176 158 C190 134 210 124 240 124 L262 124 L262 158 Z"), Pa("M274 124 L288 124 C316 124 338 136 352 158 L274 158 Z")] });
    parts.push(flatPart({ id: "windows", label: "Jendela", assembly: "Tempelkan jendela di sisi atas kendaraan.", poly: rectPolyLocal(1.55, 0.28), region: "windows", transform: { t: [0, -0.22, 0.35] } }));
    if (o.stripe) {
      regions.push({ id: "stripe", label: "Garis", els: [Rc(busLike ? 84 : 80, 196, busLike ? 314 : 344, 16, 6)] });
      parts.push(flatPart({ id: "stripe", label: "Garis", assembly: "Tempelkan garis warna di sisi kendaraan.", poly: rectPolyLocal(1.8, 0.1), region: "stripe", transform: { t: [0, -0.52, 0.35] } }));
    }
    if (o.light) {
      regions.push({ id: "lights", label: "Lampu", els: [Ci(busLike ? 382 : 408, 200, 11), Ci(98, 200, 11)] });
      parts.push(
        flatPart({ id: "light-l", label: "Lampu", assembly: "Tempelkan lampu bundar di depan dan belakang.", poly: discPoly(0.07), region: "lights", transform: { t: [-0.85, -0.5, 0.35] } }),
        flatPart({ id: "light-r", label: "Lampu", assembly: "Tempelkan lampu bundar di depan dan belakang.", poly: discPoly(0.07), region: "lights", transform: { t: [0.9, -0.5, 0.35] } }),
      );
    }
  }
  if (o.extra) {
    regions.push({ id: o.extra.id, label: o.extra.label, els: o.extra.els });
    parts.push(o.extra.part);
  }
  regions.push({ id: "wheels", label: "Roda", els: wheelEls });
  parts.push(...wheelParts());
  details.push(...wheelEls.map((w) => ({ el: Ci((w as { cx: number }).cx, (w as { cy: number }).cy, 10), fill: "#FFFFFF", stroke: INK, sw: 3 })));
  return { regions, details, parts, merges: o.merges };
}

/* ================================================================== */
/* PEMBANGUN KELUARGA — kapal & pesawat                                */
/* ================================================================== */

interface BoatOpts {
  sailKind: "triangle" | "cabin" | "double";
  flag?: boolean;
  waves?: boolean;
  merges?: Record<string, string>;
}

function boatArt(o: BoatOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [];
  if (o.sailKind === "triangle" || o.sailKind === "double") {
    regions.push({ id: "sail", label: "Layar", els: [
      Pa("M252 84 L252 196 L168 196 Z"),
      ...(o.sailKind === "double" ? [Pa("M266 108 L266 196 L330 196 Z")] : []),
    ] });
    parts.push(prismPart({ id: "sail", label: "Layar", assembly: "Lipat layar segitiga dan rekatkan di tiang.", poly: [[-0.3, -0.34], [-0.3, 0.34], [0.3, 0.34]], depth: 0.07, region: "sail", transform: { t: [-0.15, 0.05, 0] } }));
    if (o.sailKind === "double") {
      parts.push(prismPart({ id: "sail-2", label: "Layar", assembly: "Lipat layar segitiga dan rekatkan di tiang.", poly: [[0.3, -0.34], [0.3, 0.34], [-0.3, 0.34]], depth: 0.07, region: "sail", transform: { t: [0.35, -0.05, 0] } }));
    }
    details.push({ el: Rc(246, 78, 7, 128, 3), fill: INK });
  }
  if (o.sailKind === "cabin") {
    regions.push({ id: "cabin", label: "Kabin", els: [Rc(196, 148, 110, 52, 8)] });
    parts.push(boxPart({ id: "cabin", label: "Kabin", assembly: "Lipat kabin kapal dan rekatkan di atas lambung.", w: 0.66, h: 0.32, d: 0.5, regions: { front: "cabin", back: "cabin", left: "cabin", right: "cabin", top: "cabin", bottom: "cabin" }, transform: { t: [0.05, -0.22, 0] } }));
    regions.push({ id: "windows", label: "Jendela", els: [Ci(222, 172, 10), Ci(252, 172, 10), Ci(282, 172, 10)] });
    parts.push(flatPart({ id: "windows", label: "Jendela", assembly: "Tempelkan jendela bundar di sisi kabin.", poly: discPoly(0.4), region: "windows", transform: { s: [1.6, 0.4, 1], t: [0.05, -0.22, 0.27] } }));
    regions.push({ id: "funnel", label: "Cerobong", els: [Rc(316, 116, 26, 48, 6)] });
    parts.push(cylPart({ id: "funnel", label: "Cerobong", assembly: "Gulung cerobong asap dan rekatkan di belakang kabin.", r: 0.09, h: 0.3, region: "funnel", transform: { t: [0.5, -0.1, 0] } }));
  }
  if (o.flag) {
    regions.push({ id: "flag", label: "Bendera", els: [Pa("M253 78 L289 88 L253 100 Z")] });
    parts.push(prismPart({ id: "flag", label: "Bendera", assembly: "Lipat bendera kecil dan rekatkan di puncak tiang.", poly: [[0, 0.08], [0.24, 0], [0, -0.08]], depth: 0.05, region: "flag", transform: { t: [0.12, 0.62, 0] } }));
  }
  regions.push({ id: "hull", label: "Lambung", els: [
    Pa("M104 208 L376 208 L348 262 C344 272 334 278 322 278 L158 278 C146 278 136 272 132 262 Z"),
  ] });
  parts.push(boxPart({ id: "hull", label: "Lambung", assembly: "Lipat lambung kapal menjadi kotak memanjang.", w: 1.6, h: 0.42, d: 0.6, regions: { front: "hull", back: "hull", left: "hull", right: "hull", top: "hull", bottom: "hull" }, transform: { t: [0, -0.62, 0] }, splitWalls: true }));
  if (o.waves) {
    regions.push({ id: "waves", label: "Ombak", els: [
      Pa("M60 292 C90 276 120 292 150 292 C180 292 210 276 240 292 C270 292 300 276 330 292 C360 292 390 276 420 292 L420 306 L60 306 Z"),
    ] });
    parts.push(flatPart({ id: "waves", label: "Ombak", assembly: "Tempelkan ombak bergelombang di bawah kapal sebagai alas.", poly: [[-1.1, -0.06], [-0.7, 0.06], [-0.3, -0.06], [0.1, 0.06], [0.5, -0.06], [0.9, 0.06], [1.1, -0.02], [1.1, -0.1], [-1.1, -0.1]], region: "waves", transform: { t: [0, -0.98, 0.3] } }));
  }
  return { regions, details, parts, merges: o.merges };
}

interface PlaneOpts {
  propeller?: boolean;
  stripe?: boolean;
  merges?: Record<string, string>;
}

function planeArt(o: PlaneOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [groundAt(302, 140)];
  regions.push({ id: "tail", label: "Ekor", els: [Pa("M96 148 C84 118 88 92 108 82 L142 128 C130 144 112 150 96 148 Z")] });
  parts.push(prismPart({ id: "tail", label: "Ekor", assembly: "Lipat sirip ekor dan rekatkan tegak di belakang badan.", poly: [[-0.16, -0.2], [0.02, 0.24], [0.2, -0.16]], depth: 0.09, region: "tail", transform: { t: [-0.78, -0.05, 0] } }));
  regions.push({ id: "body", label: "Badan", els: [
    Pa("M92 196 C96 160 130 138 190 132 L330 132 C380 132 414 158 420 190 C414 220 376 238 322 240 L180 240 C132 236 96 224 92 196 Z"),
  ] });
  parts.push(cylPart({ id: "body", label: "Badan", assembly: "Gulung badan pesawat menjadi tabung panjang.", r: 0.34, h: 1.9, region: "body", capRegion: "body", transform: { r: [0, 0, Math.PI / 2], t: [0, -0.35, 0] } }));
  regions.push({ id: "wing", label: "Sayap", els: [Pa("M218 224 L306 224 L348 272 C350 280 344 286 334 286 L236 284 C222 282 212 268 214 250 Z")] });
  parts.push(prismPart({ id: "wing", label: "Sayap", assembly: "Lipat sayap besar dan rekatkan di bawah badan.", poly: [[-0.4, 0.1], [0.35, 0.1], [0.55, -0.2], [-0.3, -0.22]], depth: 0.08, region: "wing", transform: { t: [0.25, -0.62, 0.15], r: [0.3, 0, 0] } }));
  regions.push({ id: "windows", label: "Jendela", els: [Ci(196, 168, 11), Ci(232, 168, 11), Ci(268, 168, 11), Ci(304, 168, 11)] });
  parts.push(flatPart({ id: "windows", label: "Jendela", assembly: "Tempelkan deretan jendela di sisi badan.", poly: rectPolyLocal(0.85, 0.14), region: "windows", transform: { t: [0.05, -0.22, 0.36] } }));
  if (o.stripe) {
    regions.push({ id: "stripe", label: "Garis", els: [Pa("M100 202 L416 202 L414 218 L102 218 Z")] });
    parts.push(flatPart({ id: "stripe", label: "Garis", assembly: "Tempelkan garis warna memanjang di sisi badan.", poly: rectPolyLocal(1.85, 0.1), region: "stripe", transform: { t: [0, -0.48, 0.36] } }));
  }
  if (o.propeller) {
    regions.push({ id: "propeller", label: "Baling-baling", els: [E(424, 186, 10, 44)] });
    parts.push(prismPart({ id: "propeller", label: "Baling-baling", assembly: "Lipat baling-baling dan rekatkan di hidung pesawat.", poly: [[-0.05, 0.28], [0.05, 0.28], [0.05, -0.28], [-0.05, -0.28]], depth: 0.06, region: "propeller", transform: { t: [1.12, -0.35, 0] } }));
    details.push({ el: Ci(424, 186, 7), fill: INK });
  }
  return { regions, details, parts, merges: o.merges };
}

/* ================================================================== */
/* PEMBANGUN KELUARGA — tanaman & taman ("plant")                       */
/* ================================================================== */

interface PlantOpts {
  kind: "flower" | "tree" | "mushroom" | "cactus";
  pot?: boolean;
  fruit?: boolean;
  house?: boolean;
  merges?: Record<string, string>;
}

function petalEls(cx: number, cy: number, n: number, dist: number, rx: number, ry: number): SvgEl[] {
  const els: SvgEl[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    els.push(E(cx + dist * Math.cos(a), cy + dist * Math.sin(a), rx, ry));
  }
  return els;
}

function plantArt(o: PlantOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [groundAt(300, 130)];
  if (o.kind === "flower") {
    regions.push({ id: "stem", label: "Batang", els: [Pa("M234 196 C232 232 232 262 236 292 L252 292 C250 262 250 232 248 196 Z")] });
    parts.push(cylPart({ id: "stem", label: "Batang", assembly: "Gulung batang menjadi tabung ramping.", r: 0.06, h: 0.62, region: "stem", transform: { t: [0, -0.62, 0] } }));
    regions.push({ id: "leaves", label: "Daun", els: [
      Pa("M236 248 C204 244 184 228 182 204 C208 206 230 222 238 242 Z"),
      Pa("M250 262 C278 254 292 236 292 214 C268 220 254 238 248 256 Z"),
    ] });
    parts.push(
      prismPart({ id: "leaf-l", label: "Daun", assembly: "Lipat dua daun dan rekatkan di sisi batang.", poly: [[-0.2, -0.05], [0.05, 0.16], [0.2, -0.02], [0, -0.14]], depth: 0.07, region: "leaves", transform: { t: [-0.28, -0.55, 0] } }),
      prismPart({ id: "leaf-r", label: "Daun", assembly: "Lipat dua daun dan rekatkan di sisi batang.", poly: [[0.2, -0.05], [-0.05, 0.16], [-0.2, -0.02], [0, -0.14]], depth: 0.07, region: "leaves", transform: { t: [0.28, -0.68, 0] } }),
    );
    regions.push({ id: "petals", label: "Kelopak", els: petalEls(240, 128, 6, 44, 27, 27) });
    parts.push(ballPart({ id: "petals", label: "Kelopak", assembly: "Buat bola kelopak pipih dan rekatkan di puncak batang.", r: 0.42, region: "petals", transform: { s: [1.25, 1.25, 0.45], t: [0, 0.35, 0] } }));
    regions.push({ id: "center", label: "Tengah Bunga", els: [Ci(240, 128, 26)] });
    parts.push(flatPart({ id: "center", label: "Tengah Bunga", assembly: "Tempelkan tengah bunga yang bundar di depan kelopak.", poly: discPoly(0.17), region: "center", transform: { t: [0, 0.35, 0.2] } }));
    details.push(...eyesAt(240, 122, 11, 5.5), smileAt(240, 136, 14));
  } else if (o.kind === "tree") {
    regions.push({ id: "trunk", label: "Batang", els: [Pa("M226 292 C228 250 230 214 228 184 L254 184 C252 214 252 250 256 292 Z")] });
    parts.push(cylPart({ id: "trunk", label: "Batang", assembly: "Gulung batang pohon menjadi tabung kokoh.", r: 0.13, h: 0.7, region: "trunk", transform: { t: [0, -0.6, 0] } }));
    regions.push({ id: "canopy", label: "Daun Pohon", els: [Ci(240, 108, 62), Ci(178, 138, 44), Ci(302, 138, 44)] });
    parts.push(ballPart({ id: "canopy", label: "Daun Pohon", assembly: "Buat bola daun pohon besar dan rekatkan di atas batang.", r: 0.55, region: "canopy", transform: { s: [1.35, 0.95, 1], t: [0, 0.32, 0] } }));
    if (o.fruit) {
      regions.push({ id: "fruit", label: "Buah", els: [Ci(196, 118, 13), Ci(272, 96, 13), Ci(238, 148, 13), Ci(300, 140, 12)] });
      parts.push(
        ballPart({ id: "fruit-1", label: "Buah", assembly: "Buat bola-bola buah kecil dan gantungkan di daun pohon.", r: 0.085, region: "fruit", transform: { t: [-0.3, 0.42, 0.35] } }),
        ballPart({ id: "fruit-2", label: "Buah", assembly: "Buat bola-bola buah kecil dan gantungkan di daun pohon.", r: 0.085, region: "fruit", transform: { t: [0.2, 0.52, 0.35] } }),
        ballPart({ id: "fruit-3", label: "Buah", assembly: "Buat bola-bola buah kecil dan gantungkan di daun pohon.", r: 0.085, region: "fruit", transform: { t: [0.02, 0.2, 0.4] } }),
      );
    }
  } else if (o.kind === "mushroom") {
    regions.push({ id: "stem", label: o.house ? "Dinding" : "Batang", els: [
      Pa(o.house ? "M188 292 C192 240 196 200 200 168 L280 168 C284 200 288 240 292 292 Z" : "M206 292 C210 246 214 208 218 176 L262 176 C266 208 270 246 274 292 Z"),
    ] });
    parts.push(cylPart({ id: "stem", label: o.house ? "Dinding" : "Batang", assembly: "Gulung batang jamur menjadi tabung gemuk.", r: 0.3, h: 0.72, region: "stem", transform: { s: [1, 1, 0.8], t: [0, -0.6, 0] } }));
    regions.push({ id: "cap", label: "Topi Jamur", els: [
      Pa("M128 172 C136 104 184 62 240 62 C296 62 344 104 352 172 C306 156 174 156 128 172 Z"),
    ] });
    parts.push(conePart({ id: "cap", label: "Topi Jamur", assembly: "Gulung topi jamur menjadi kerucut lebar dan letakkan di atas batang.", r: 0.72, h: 0.5, region: "cap", transform: { t: [0, 0.05, 0] } }));
    regions.push({ id: "spots", label: "Bintik", els: [Ci(196, 112, 15), Ci(268, 96, 12), Ci(292, 132, 10), Ci(168, 140, 9)] });
    parts.push(
      flatPart({ id: "spot-1", label: "Bintik", assembly: "Tempelkan bintik-bintik bundar di topi jamur.", poly: discPoly(0.1), region: "spots", transform: { t: [-0.28, 0.28, 0.3], r: [-0.5, 0, 0] } }),
      flatPart({ id: "spot-2", label: "Bintik", assembly: "Tempelkan bintik-bintik bundar di topi jamur.", poly: discPoly(0.08), region: "spots", transform: { t: [0.18, 0.38, 0.28], r: [-0.5, 0, 0] } }),
    );
    if (o.house) {
      regions.push({ id: "door", label: "Pintu", els: [Pa("M222 292 L222 238 C222 224 258 224 258 238 L258 292 Z")] });
      parts.push(flatPart({ id: "door", label: "Pintu", assembly: "Tempelkan pintu lengkung di depan batang jamur.", poly: [[-0.11, -0.17], [0.11, -0.17], [0.11, 0.1], [0, 0.17], [-0.11, 0.1]], region: "door", transform: { t: [0, -0.72, 0.26] } }));
      regions.push({ id: "window", label: "Jendela", els: [Ci(240, 200, 0).t === "circle" ? Ci(206, 204, 11) : Ci(206, 204, 11), Ci(276, 204, 11)] });
      parts.push(flatPart({ id: "window", label: "Jendela", assembly: "Tempelkan dua jendela bundar di sisi pintu.", poly: discPoly(0.3), region: "window", transform: { s: [1.9, 0.35, 1], t: [0, -0.42, 0.26] } }));
      details.push({ el: Ci(240, 262, 3.5), fill: INK });
    }
  } else {
    // kaktus
    if (o.pot) {
      regions.push({ id: "pot", label: "Pot", els: [Pa("M186 292 L198 232 L282 232 L294 292 Z")] });
      parts.push(boxPart({ id: "pot", label: "Pot", assembly: "Lipat pot menjadi kotak meruncing.", w: 0.62, h: 0.36, d: 0.5, regions: { front: "pot", back: "pot", left: "pot", right: "pot", top: "pot", bottom: "pot" }, transform: { t: [0, -0.8, 0] } }));
    }
    regions.push({ id: "body", label: "Badan", els: [
      Pa("M208 236 L208 128 C208 100 222 82 240 82 C258 82 272 100 272 128 L272 236 C272 252 258 260 240 260 C222 260 208 252 208 236 Z"),
    ] });
    parts.push(cylPart({ id: "body", label: "Badan", assembly: "Gulung badan kaktus menjadi tabung tegak.", r: 0.21, h: 1.05, region: "body", transform: { t: [0, -0.1, 0] } }));
    regions.push({ id: "arms", label: "Lengan", els: [
      Pa("M208 168 C184 168 172 154 172 134 L172 122 C172 110 186 106 192 116 L192 140 C192 148 198 152 208 152 Z"),
      Pa("M272 150 C296 150 308 136 308 116 L308 104 C308 92 322 88 328 98 L328 124 C328 134 320 140 272 140 Z"),
    ] });
    parts.push(
      cylPart({ id: "arm-l", label: "Lengan", assembly: "Gulung dua lengan kaktus dan rekatkan di sisi badan.", r: 0.08, h: 0.4, region: "arms", transform: { t: [-0.38, 0.05, 0] } }),
      cylPart({ id: "arm-r", label: "Lengan", assembly: "Gulung dua lengan kaktus dan rekatkan di sisi badan.", r: 0.08, h: 0.45, region: "arms", transform: { t: [0.4, 0.12, 0] } }),
    );
    regions.push({ id: "flower", label: "Bunga", els: petalEls(240, 74, 5, 13, 9, 9) });
    parts.push(ballPart({ id: "flower", label: "Bunga", assembly: "Buat bunga kecil dan letakkan di puncak kaktus.", r: 0.09, region: "flower", transform: { t: [0, 0.48, 0] } }));
    details.push(...eyesAt(240, 160, 16, 6), smileAt(240, 176, 16));
  }
  if (o.pot && o.kind === "flower") {
    regions.push({ id: "pot", label: "Pot", els: [Pa("M192 306 L202 252 L278 252 L288 306 Z")] });
    parts.push(boxPart({ id: "pot", label: "Pot", assembly: "Lipat pot bunga menjadi kotak meruncing.", w: 0.58, h: 0.32, d: 0.46, regions: { front: "pot", back: "pot", left: "pot", right: "pot", top: "pot", bottom: "pot" }, transform: { t: [0, -0.9, 0] } }));
  }
  return { regions, details, parts, merges: o.merges };
}

/* ================================================================== */
/* PEMBANGUN KELUARGA — makanan & benda manis ("food")                  */
/* ================================================================== */

interface FoodOpts {
  kind: "icecream" | "cupcake" | "donut" | "cake";
  scoops?: number;
  merges?: Record<string, string>;
}

function foodArt(o: FoodOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [groundAt(302, 110)];
  if (o.kind === "icecream") {
    regions.push({ id: "cone", label: "Kerucut", els: [Pa("M196 196 L284 196 L240 300 Z")] });
    parts.push(conePart({ id: "cone", label: "Kerucut", assembly: "Gulung kerucut es krim dan rekatkan ujungnya.", r: 0.3, h: 0.68, region: "cone", transform: { r: [Math.PI, 0, 0], t: [0, -0.62, 0] } }));
    const n = o.scoops ?? 1;
    if (n >= 2) {
      regions.push({ id: "scoop2", label: "Es Krim Atas", els: [Ci(240, 96, 40)] });
      parts.push(ballPart({ id: "scoop2", label: "Es Krim Atas", assembly: "Buat bola es krim kedua dan tumpuk di atasnya.", r: 0.26, region: "scoop2", transform: { t: [0, 0.28, 0] } }));
    }
    regions.push({ id: "scoop", label: "Es Krim", els: [Ci(240, n >= 2 ? 152 : 138, n >= 2 ? 46 : 56)] });
    parts.push(ballPart({ id: "scoop", label: "Es Krim", assembly: "Buat bola es krim besar dan letakkan di atas kerucut.", r: 0.36, region: "scoop", transform: { t: [0, n >= 2 ? -0.08 : 0.02, 0] } }));
    regions.push({ id: "cherry", label: "Ceri", els: [Ci(240, n >= 2 ? 52 : 76, 13)] });
    parts.push(ballPart({ id: "cherry", label: "Ceri", assembly: "Buat bola ceri kecil dan letakkan di puncak es krim.", r: 0.085, region: "cherry", transform: { t: [0, n >= 2 ? 0.58 : 0.42, 0] } }));
    details.push({ el: Pa(`M248 ${n >= 2 ? 44 : 68} C258 ${n >= 2 ? 30 : 54} 270 ${n >= 2 ? 28 : 52} 280 ${n >= 2 ? 34 : 58}`), stroke: INK, sw: 4 });
  } else if (o.kind === "cupcake") {
    regions.push({ id: "wrapper", label: "Kertas Cupcake", els: [Pa("M188 196 L292 196 L276 292 L204 292 Z")] });
    parts.push(boxPart({ id: "wrapper", label: "Kertas Cupcake", assembly: "Lipat kertas cupcake menjadi mangkuk kotak.", w: 0.6, h: 0.55, d: 0.5, regions: { front: "wrapper", back: "wrapper", left: "wrapper", right: "wrapper", top: "wrapper", bottom: "wrapper" }, transform: { t: [0, -0.62, 0] } }));
    regions.push({ id: "frosting", label: "Krim", els: [
      Pa("M176 198 C160 168 184 146 208 150 C206 122 228 104 240 118 C252 104 274 122 272 150 C296 146 320 168 304 198 C268 186 212 186 176 198 Z"),
    ] });
    parts.push(ballPart({ id: "frosting", label: "Krim", assembly: "Buat gumpalan krim berputar dan letakkan di atas kertas cupcake.", r: 0.42, region: "frosting", transform: { s: [1.05, 0.72, 1], t: [0, -0.18, 0] } }));
    regions.push({ id: "sprinkles", label: "Taburan", els: [Rc(208, 148, 16, 6, 3), Rc(246, 138, 16, 6, 3), Rc(228, 164, 16, 6, 3), Rc(262, 160, 14, 6, 3)] });
    parts.push(flatPart({ id: "sprinkles", label: "Taburan", assembly: "Tempelkan taburan warna-warni di atas krim.", poly: rectPolyLocal(0.5, 0.2), region: "sprinkles", transform: { t: [0, -0.05, 0.32], r: [-0.4, 0, 0] } }));
    regions.push({ id: "cherry", label: "Ceri", els: [Ci(240, 108, 12)] });
    parts.push(ballPart({ id: "cherry", label: "Ceri", assembly: "Buat bola ceri kecil dan letakkan di puncak krim.", r: 0.08, region: "cherry", transform: { t: [0, 0.16, 0] } }));
  } else if (o.kind === "donut") {
    regions.push({ id: "ring", label: "Donat", els: [Ci(240, 178, 92)] });
    parts.push(lathePart({
      id: "ring", label: "Donat", assembly: "Rekatkan strip donat menjadi cincin gemuk.",
      profile: [{ r: 0.30, y: -0.16 }, { r: 0.52, y: -0.08 }, { r: 0.58, y: 0.06 }, { r: 0.42, y: 0.16 }, { r: 0.30, y: 0.10 }],
      segments: 10, region: "ring", capBottomRegion: "ring", capTopRegion: "ring",
      transform: { r: [Math.PI / 2, 0, 0], t: [0, -0.35, 0] },
    }));
    regions.push({ id: "frosting", label: "Lapisan Gula", els: [
      Pa("M240 96 C296 96 330 128 328 168 C326 196 306 204 292 190 C280 206 254 210 240 196 C226 210 200 206 188 190 C174 204 154 196 152 168 C150 128 184 96 240 96 Z"),
    ] });
    parts.push(flatPart({ id: "frosting", label: "Lapisan Gula", assembly: "Tempelkan lapisan gula bergelombang di atas donat.", poly: discPoly(0.55), region: "frosting", transform: { s: [1, 1, 1], t: [0, -0.18, 0.18], r: [Math.PI / 2 - 0.35, 0, 0] } }));
    regions.push({ id: "sprinkles", label: "Taburan", els: [Rc(190, 138, 15, 6, 3), Rc(262, 128, 15, 6, 3), Rc(226, 112, 15, 6, 3), Rc(282, 162, 14, 6, 3), Rc(196, 176, 14, 6, 3)] });
    parts.push(flatPart({ id: "sprinkles", label: "Taburan", assembly: "Tempelkan taburan di atas lapisan gula.", poly: rectPolyLocal(0.55, 0.4), region: "sprinkles", transform: { t: [0, -0.12, 0.24], r: [Math.PI / 2 - 0.35, 0, 0] } }));
    details.push({ el: Ci(240, 178, 30), fill: "#FFFFFF", stroke: INK, sw: 5 });
  } else {
    // kue lapis ulang tahun
    regions.push({ id: "plate", label: "Piring", els: [E(240, 292, 118, 14)] });
    parts.push(flatPart({ id: "plate", label: "Piring", assembly: "Letakkan piring oval sebagai alas kue.", poly: discPoly(0.72), region: "plate", transform: { s: [1, 0.35, 1], t: [0, -0.97, 0.2], r: [Math.PI / 2, 0, 0] } }));
    regions.push({ id: "layer1", label: "Lapis Bawah", els: [Rc(156, 226, 168, 58, 10)] });
    parts.push(boxPart({ id: "layer1", label: "Lapis Bawah", assembly: "Lipat lapis bawah kue menjadi kotak lebar.", w: 1.02, h: 0.35, d: 0.6, regions: { front: "layer1", back: "layer1", left: "layer1", right: "layer1", top: "frosting", bottom: "layer1" }, transform: { t: [0, -0.72, 0] } }));
    regions.push({ id: "layer2", label: "Lapis Atas", els: [Rc(182, 176, 116, 52, 10)] });
    parts.push(boxPart({ id: "layer2", label: "Lapis Atas", assembly: "Lipat lapis atas dan tumpuk di atas lapis bawah.", w: 0.7, h: 0.32, d: 0.55, regions: { front: "layer2", back: "layer2", left: "layer2", right: "layer2", top: "frosting", bottom: "layer2" }, transform: { t: [0, -0.38, 0] } }));
    regions.push({ id: "frosting", label: "Krim", els: [Pa("M182 176 L298 176 L298 188 C286 178 274 192 262 182 C250 194 236 180 224 190 C210 180 198 192 188 184 C184 190 182 184 182 176 Z"), Pa("M156 226 L324 226 L324 236 C310 228 298 240 284 230 C268 242 252 230 238 238 C222 230 208 240 194 232 C180 240 168 230 156 236 Z")] });
    parts.push(flatPart({ id: "frosting", label: "Krim", assembly: "Tempelkan lelehan krim di tepi atas kedua lapis kue.", poly: rectPolyLocal(0.95, 0.3), region: "frosting", transform: { t: [0, -0.45, 0.32] } }));
    regions.push({ id: "candles", label: "Lilin", els: [Rc(206, 128, 10, 34, 4), Rc(235, 122, 10, 40, 4), Rc(264, 128, 10, 34, 4)] });
    parts.push(
      cylPart({ id: "candle-1", label: "Lilin", assembly: "Gulung tiga lilin ramping dan berdirikan di atas kue.", r: 0.035, h: 0.24, region: "candles", transform: { t: [-0.2, -0.08, 0] } }),
      cylPart({ id: "candle-2", label: "Lilin", assembly: "Gulung tiga lilin ramping dan berdirikan di atas kue.", r: 0.035, h: 0.27, region: "candles", transform: { t: [0, -0.05, 0] } }),
      cylPart({ id: "candle-3", label: "Lilin", assembly: "Gulung tiga lilin ramping dan berdirikan di atas kue.", r: 0.035, h: 0.24, region: "candles", transform: { t: [0.2, -0.08, 0] } }),
    );
    regions.push({ id: "cherry", label: "Ceri", els: [Ci(240, 196, 0).t === "circle" ? Ci(196, 240, 9) : Ci(196, 240, 9), Ci(284, 240, 9)] });
    parts.push(
      ballPart({ id: "cherry-1", label: "Ceri", assembly: "Buat bola ceri dan letakkan di depan lapis bawah.", r: 0.06, region: "cherry", transform: { t: [-0.28, -0.68, 0.32] } }),
      ballPart({ id: "cherry-2", label: "Ceri", assembly: "Buat bola ceri dan letakkan di depan lapis bawah.", r: 0.06, region: "cherry", transform: { t: [0.28, -0.68, 0.32] } }),
    );
    details.push(
      { el: E(211, 118, 6, 10), fill: "#FFC93C", stroke: INK, sw: 2.5 },
      { el: E(240, 110, 6, 10), fill: "#FFC93C", stroke: INK, sw: 2.5 },
      { el: E(269, 118, 6, 10), fill: "#FFC93C", stroke: INK, sw: 2.5 },
    );
  }
  return { regions, details, parts, merges: o.merges };
}

/* ================================================================== */
/* PEMBANGUN KELUARGA — antariksa & rumah ("space", "house")            */
/* ================================================================== */

interface PlanetOpts {
  craters?: boolean;
  moon?: boolean;
  merges?: Record<string, string>;
}

function planetArt(o: PlanetOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [];
  regions.push({ id: "ring", label: "Cincin", els: [
    Pa("M84 216 C130 168 350 168 396 216 C350 252 130 252 84 216 Z M132 214 C168 240 312 240 348 214 C312 190 168 190 132 214 Z"),
  ] });
  parts.push(lathePart({
    id: "ring", label: "Cincin", assembly: "Rekatkan cincin planet menjadi pita pipih melingkar.",
    profile: [{ r: 0.62, y: -0.03 }, { r: 1.05, y: 0 }, { r: 0.62, y: 0.03 }],
    segments: 12, region: "ring", capBottomRegion: "ring", capTopRegion: "ring",
    transform: { r: [0.5, 0, 0], t: [0, -0.35, 0] },
  }));
  regions.push({ id: "planet", label: "Planet", els: [Ci(240, 178, 84)] });
  parts.push(ballPart({ id: "planet", label: "Planet", assembly: "Buat bola planet besar dan lalui cincinnya di tengah.", r: 0.54, region: "planet", transform: { t: [0, -0.3, 0] } }));
  if (o.craters) {
    regions.push({ id: "spots", label: "Kawah", els: [Ci(206, 148, 15), Ci(262, 190, 11), Ci(226, 214, 8)] });
    parts.push(
      flatPart({ id: "crater-1", label: "Kawah", assembly: "Tempelkan kawah-kawah bundar di permukaan planet.", poly: discPoly(0.1), region: "spots", transform: { t: [-0.2, -0.12, 0.5] } }),
      flatPart({ id: "crater-2", label: "Kawah", assembly: "Tempelkan kawah-kawah bundar di permukaan planet.", poly: discPoly(0.07), region: "spots", transform: { t: [0.15, -0.38, 0.5] } }),
    );
  }
  if (o.moon) {
    regions.push({ id: "moon", label: "Bulan Kecil", els: [Ci(368, 84, 24)] });
    parts.push(ballPart({ id: "moon", label: "Bulan Kecil", assembly: "Buat bola bulan kecil dan letakkan melayang di sisi planet.", r: 0.15, region: "moon", transform: { t: [0.85, 0.35, -0.1] } }));
    details.push({ el: Ci(360, 78, 5), fill: "#FFFFFF", stroke: INK, sw: 2.5 }, { el: Ci(376, 92, 4), fill: "#FFFFFF", stroke: INK, sw: 2.5 });
  }
  details.push(...eyesAt(240, 168, 24, 7), smileAt(240, 190, 22), ...cheeksAt(240, 190, 52, 10));
  return { regions, details, parts, fallbacks: { spots: "planet" }, merges: o.merges };
}

interface HouseOpts {
  kind: "house" | "castle" | "lighthouse" | "windmill";
  chimney?: boolean;
  merges?: Record<string, string>;
}

function houseArt(o: HouseOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [groundAt(302, 150)];
  if (o.kind === "castle") {
    regions.push({ id: "towers", label: "Menara", els: [Rc(120, 130, 52, 140, 8), Rc(308, 130, 52, 140, 8)] });
    parts.push(
      boxPart({ id: "tower-l", label: "Menara", assembly: "Lipat dua menara tinggi dan berdirikan di sisi kastil.", w: 0.32, h: 0.85, d: 0.4, regions: { front: "towers", back: "towers", left: "towers", right: "towers", top: "towers", bottom: "towers" }, transform: { t: [-0.62, -0.55, 0] } }),
      boxPart({ id: "tower-r", label: "Menara", assembly: "Lipat dua menara tinggi dan berdirikan di sisi kastil.", w: 0.32, h: 0.85, d: 0.4, regions: { front: "towers", back: "towers", left: "towers", right: "towers", top: "towers", bottom: "towers" }, transform: { t: [0.62, -0.55, 0] } }),
    );
    regions.push({ id: "roofs", label: "Atap", els: [Pa("M112 132 L146 84 L180 132 Z"), Pa("M300 132 L334 84 L368 132 Z"), Pa("M196 148 L240 96 L284 148 Z")] });
    parts.push(
      conePart({ id: "roof-l", label: "Atap", assembly: "Gulung atap kerucut dan letakkan di atas setiap menara.", r: 0.22, h: 0.32, region: "roofs", transform: { t: [-0.62, 0.05, 0] } }),
      conePart({ id: "roof-r", label: "Atap", assembly: "Gulung atap kerucut dan letakkan di atas setiap menara.", r: 0.22, h: 0.32, region: "roofs", transform: { t: [0.62, 0.05, 0] } }),
      conePart({ id: "roof-c", label: "Atap", assembly: "Gulung atap kerucut dan letakkan di atas setiap menara.", r: 0.28, h: 0.36, region: "roofs", transform: { t: [0, -0.05, 0] } }),
    );
    regions.push({ id: "walls", label: "Dinding", els: [Rc(172, 148, 136, 122, 8)] });
    parts.push(boxPart({ id: "walls", label: "Dinding", assembly: "Lipat dinding tengah kastil menjadi kotak.", w: 0.82, h: 0.74, d: 0.5, regions: { front: "walls", back: "walls", left: "walls", right: "walls", top: "walls", bottom: "walls" }, transform: { t: [0, -0.62, 0] } }));
    regions.push({ id: "flags", label: "Bendera", els: [Pa("M146 84 L146 58 L172 66 L146 74 Z"), Pa("M334 84 L334 58 L360 66 L334 74 Z")] });
    parts.push(
      prismPart({ id: "flag-l", label: "Bendera", assembly: "Lipat bendera kecil dan rekatkan di puncak atap menara.", poly: [[0, 0.09], [0.18, 0.02], [0, -0.06]], depth: 0.04, region: "flags", transform: { t: [-0.6, 0.28, 0] } }),
      prismPart({ id: "flag-r", label: "Bendera", assembly: "Lipat bendera kecil dan rekatkan di puncak atap menara.", poly: [[0, 0.09], [0.18, 0.02], [0, -0.06]], depth: 0.04, region: "flags", transform: { t: [0.64, 0.28, 0] } }),
    );
    regions.push({ id: "door", label: "Gerbang", els: [Pa("M216 270 L216 216 C216 200 264 200 264 216 L264 270 Z")] });
    parts.push(flatPart({ id: "door", label: "Gerbang", assembly: "Tempelkan gerbang lengkung di tengah dinding.", poly: [[-0.15, -0.22], [0.15, -0.22], [0.15, 0.14], [0, 0.22], [-0.15, 0.14]], region: "door", transform: { t: [0, -0.75, 0.27] } }));
    regions.push({ id: "windows", label: "Jendela", els: [Rc(138, 168, 16, 26, 7), Rc(326, 168, 16, 26, 7), Rc(232, 168, 16, 26, 7)] });
    parts.push(flatPart({ id: "windows", label: "Jendela", assembly: "Tempelkan jendela-jendela kecil di menara dan dinding.", poly: rectPolyLocal(1.15, 0.16), region: "windows", transform: { t: [0, -0.35, 0.27] } }));
  } else if (o.kind === "lighthouse") {
    regions.push({ id: "base", label: "Batu Karang", els: [Pa("M168 292 C180 262 300 262 312 292 Z")] });
    parts.push(flatPart({ id: "base", label: "Batu Karang", assembly: "Letakkan batu karang pipih sebagai alas mercusuar.", poly: [[-0.45, -0.1], [0.45, -0.1], [0.3, 0.1], [-0.3, 0.1]], region: "base", transform: { t: [0, -0.95, 0.15] } }));
    regions.push({ id: "tower", label: "Menara", els: [Pa("M208 268 L222 108 L258 108 L272 268 Z")] });
    parts.push(cylPart({ id: "tower", label: "Menara", assembly: "Gulung menara mercusuar menjadi tabung meruncing.", r: 0.2, h: 1.0, region: "tower", transform: { s: [1, 1, 0.85], t: [0, -0.42, 0] } }));
    regions.push({ id: "stripes", label: "Garis Menara", els: [Pa("M216 196 L264 196 L267 224 L213 224 Z"), Pa("M221 138 L259 138 L261 162 L219 162 Z")] });
    parts.push(flatPart({ id: "stripes", label: "Garis Menara", assembly: "Tempelkan dua garis warna melingkari menara.", poly: rectPolyLocal(0.34, 0.5), region: "stripes", transform: { t: [0, -0.35, 0.19] } }));
    regions.push({ id: "lamp", label: "Ruang Lampu", els: [Rc(214, 72, 52, 38, 8)] });
    parts.push(boxPart({ id: "lamp", label: "Ruang Lampu", assembly: "Lipat ruang lampu menjadi kotak kaca di puncak menara.", w: 0.32, h: 0.24, d: 0.32, regions: { front: "lamp", back: "lamp", left: "lamp", right: "lamp", top: "lamp", bottom: "lamp" }, transform: { t: [0, 0.18, 0] } }));
    regions.push({ id: "roof", label: "Atap", els: [Pa("M206 74 L240 40 L274 74 Z")] });
    parts.push(conePart({ id: "roof", label: "Atap", assembly: "Gulung atap kerucut dan letakkan di atas ruang lampu.", r: 0.24, h: 0.22, region: "roof", transform: { t: [0, 0.38, 0] } }));
    regions.push({ id: "light", label: "Cahaya", els: [Pa("M266 78 L330 58 L330 108 L266 96 Z"), Pa("M214 78 L150 58 L150 108 L214 96 Z")] });
    parts.push(
      prismPart({ id: "light-l", label: "Cahaya", assembly: "Lipat berkas cahaya dan rekatkan menyamping dari ruang lampu.", poly: [[0, 0.1], [0.45, 0.2], [0.45, -0.12], [0, -0.06]], depth: 0.06, region: "light", transform: { t: [0.2, 0.12, 0] } }),
      prismPart({ id: "light-r", label: "Cahaya", assembly: "Lipat berkas cahaya dan rekatkan menyamping dari ruang lampu.", poly: [[0, 0.1], [-0.45, 0.2], [-0.45, -0.12], [0, -0.06]], depth: 0.06, region: "light", transform: { t: [-0.2, 0.12, 0] } }),
    );
  } else if (o.kind === "windmill") {
    regions.push({ id: "tower", label: "Menara", els: [Pa("M204 292 L218 128 L262 128 L276 292 Z")] });
    parts.push(boxPart({ id: "tower", label: "Menara", assembly: "Lipat menara kincir menjadi kotak meruncing.", w: 0.45, h: 1.0, d: 0.45, regions: { front: "tower", back: "tower", left: "tower", right: "tower", top: "tower", bottom: "tower" }, transform: { t: [0, -0.5, 0] } }));
    regions.push({ id: "roof", label: "Atap", els: [Pa("M210 130 L240 96 L270 130 Z")] });
    parts.push(conePart({ id: "roof", label: "Atap", assembly: "Gulung atap kerucut dan letakkan di atas menara.", r: 0.24, h: 0.24, region: "roof", transform: { t: [0, 0.08, 0] } }));
    regions.push({ id: "blades", label: "Baling-baling", els: [
      Pa("M240 118 L228 44 L252 44 Z"), Pa("M240 118 L314 106 L314 130 Z"), Pa("M240 118 L252 192 L228 192 Z"), Pa("M240 118 L166 130 L166 106 Z"),
    ] });
    parts.push(
      prismPart({ id: "blade-1", label: "Baling-baling", assembly: "Lipat empat baling-baling panjang dan rekatkan menyilang di depan atap.", poly: [[-0.07, 0], [0.07, 0], [0.03, 0.45], [-0.03, 0.45]], depth: 0.05, region: "blades", transform: { t: [0, 0.1, 0.26] } }),
      prismPart({ id: "blade-2", label: "Baling-baling", assembly: "Lipat empat baling-baling panjang dan rekatkan menyilang di depan atap.", poly: [[-0.07, 0], [0.07, 0], [0.03, 0.45], [-0.03, 0.45]], depth: 0.05, region: "blades", transform: { t: [0, 0.1, 0.26], r: [0, 0, Math.PI / 2] } }),
      prismPart({ id: "blade-3", label: "Baling-baling", assembly: "Lipat empat baling-baling panjang dan rekatkan menyilang di depan atap.", poly: [[-0.07, 0], [0.07, 0], [0.03, 0.45], [-0.03, 0.45]], depth: 0.05, region: "blades", transform: { t: [0, 0.1, 0.26], r: [0, 0, Math.PI] } }),
      prismPart({ id: "blade-4", label: "Baling-baling", assembly: "Lipat empat baling-baling panjang dan rekatkan menyilang di depan atap.", poly: [[-0.07, 0], [0.07, 0], [0.03, 0.45], [-0.03, 0.45]], depth: 0.05, region: "blades", transform: { t: [0, 0.1, 0.26], r: [0, 0, -Math.PI / 2] } }),
    );
    regions.push({ id: "door", label: "Pintu", els: [Pa("M224 292 L224 246 C224 234 256 234 256 246 L256 292 Z")] });
    parts.push(flatPart({ id: "door", label: "Pintu", assembly: "Tempelkan pintu lengkung di depan menara.", poly: [[-0.1, -0.15], [0.1, -0.15], [0.1, 0.08], [0, 0.15], [-0.1, 0.08]], region: "door", transform: { t: [0, -0.8, 0.24] } }));
    regions.push({ id: "window", label: "Jendela", els: [Rc(230, 168, 20, 26, 6)] });
    parts.push(flatPart({ id: "window", label: "Jendela", assembly: "Tempelkan jendela kecil di tengah menara.", poly: rectPolyLocal(0.13, 0.17), region: "window", transform: { t: [0, -0.32, 0.24] } }));
    details.push({ el: Ci(240, 118, 8), fill: INK });
  } else {
    if (o.chimney) {
      regions.push({ id: "chimney", label: "Cerobong", els: [Rc(292, 84, 26, 44, 4)] });
      parts.push(boxPart({ id: "chimney", label: "Cerobong", assembly: "Lipat cerobong asap dan rekatkan di atas atap.", w: 0.16, h: 0.28, d: 0.16, regions: { front: "chimney", back: "chimney", left: "chimney", right: "chimney", top: "chimney", bottom: "chimney" }, transform: { t: [0.42, 0.22, 0] } }));
    }
    regions.push({ id: "roof", label: "Atap", els: [Pa("M128 168 L240 84 L352 168 C310 152 170 152 128 168 Z")] });
    parts.push(prismPart({ id: "roof", label: "Atap", assembly: "Lipat atap segitiga besar dan letakkan di atas dinding.", poly: [[-0.72, -0.2], [0, 0.3], [0.72, -0.2], [0.6, -0.3], [-0.6, -0.3]], depth: 0.55, region: "roof", transform: { t: [0, 0.05, 0] } }));
    regions.push({ id: "walls", label: "Dinding", els: [Rc(156, 166, 168, 118, 8)] });
    parts.push(boxPart({ id: "walls", label: "Dinding", assembly: "Lipat dinding rumah menjadi kotak.", w: 1.02, h: 0.72, d: 0.6, regions: { front: "walls", back: "walls", left: "walls", right: "walls", top: "walls", bottom: "walls" }, transform: { t: [0, -0.58, 0] } }));
    regions.push({ id: "door", label: "Pintu", els: [Pa("M222 284 L222 226 C222 212 258 212 258 226 L258 284 Z")] });
    parts.push(flatPart({ id: "door", label: "Pintu", assembly: "Tempelkan pintu lengkung di tengah dinding.", poly: [[-0.11, -0.18], [0.11, -0.18], [0.11, 0.1], [0, 0.18], [-0.11, 0.1]], region: "door", transform: { t: [0, -0.68, 0.32] } }));
    regions.push({ id: "windows", label: "Jendela", els: [Rc(176, 196, 30, 34, 6), Rc(274, 196, 30, 34, 6)] });
    parts.push(flatPart({ id: "windows", label: "Jendela", assembly: "Tempelkan dua jendela di sisi pintu.", poly: rectPolyLocal(0.8, 0.2), region: "windows", transform: { t: [0, -0.42, 0.32] } }));
    details.push({ el: Ci(250, 252, 3.5), fill: INK });
  }
  return { regions, details, parts, merges: o.merges };
}

/* ----------------- helper penempatan bagian 3D ----------------- */

const discAt = (id: string, label: string, region: string, cx: number, cy: number, r: number, z = 0.35): CraftPart =>
  flatPart({ id, label, assembly: `Tempelkan ${label.toLowerCase()} di tempatnya.`, poly: discPoly(MS(r)), region, transform: { t: [MX(cx), MY(cy), z] } });
const ballAt = (id: string, label: string, region: string, cx: number, cy: number, r: number, z = 0): CraftPart =>
  ballPart({ id, label, assembly: `Buat ${label.toLowerCase()} dan rekatkan di tempatnya.`, r: MS(r), region, transform: { t: [MX(cx), MY(cy), z] } });
const prismAt = (id: string, label: string, region: string, poly: Pt[], cx: number, cy: number, z = 0): CraftPart =>
  prismPart({ id, label, assembly: `Lipat ${label.toLowerCase()} dan rekatkan di tempatnya.`, poly, depth: 0.09, region, transform: { t: [MX(cx), MY(cy), z] } });
const boxAt = (id: string, label: string, region: string, w: number, h: number, d: number, cx: number, cy: number): CraftPart =>
  boxPart({ id, label, assembly: `Lipat ${label.toLowerCase()} dan rekatkan di tempatnya.`, w, h, d, regions: { front: region, back: region, left: region, right: region, top: region, bottom: region }, transform: { t: [MX(cx), MY(cy), 0] } });

function starPath(cx: number, cy: number, rO: number, rI: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/* ================================================================== */
/* LEVEL 1 — LITTLE DISCOVERERS (9–18 bulan) · 2–3 bidang raksasa      */
/* ================================================================== */

const L1: TemplateDef[] = [
  finish({ id: "kk-kucing", name: "Kucing Bundar", collection: "animal-friends", blurb: "Kucing bundar bertelinga lancip — teman mewarnai pertama si kecil.", band: "9-18bln", who: "kucingmu" },
    buddyArt({ earKind: "pointy", belly: true, nose: "round" })),
  finish({ id: "kk-anjing", name: "Anjing Bundar", collection: "animal-friends", blurb: "Anjing bundar bertelinga terkulai yang selalu ceria.", band: "9-18bln", who: "anjingmu" },
    buddyArt({ earKind: "floppy", belly: true, nose: "round" })),
  finish({ id: "kk-babi", name: "Babi Bundar", collection: "animal-friends", blurb: "Babi bundar bermoncong besar yang menggemaskan.", band: "9-18bln", who: "babimu" },
    buddyArt({ earKind: "round", muzzle: true, nose: "pig" })),
  finish({ id: "kk-katak", name: "Katak Bundar", collection: "animal-friends", blurb: "Katak bundar berpipi lebar, siap melompat ke warna favorit.", band: "9-18bln", who: "katakmu" },
    buddyArt({ earKind: "none", belly: true, nose: "round", bodyRx: 112, bodyRy: 78, eyeDx: 44, extraDetails: [
      { el: Ci(196, 116, 17), fill: "#FFFFFF", stroke: INK, sw: 4 },
      { el: Ci(284, 116, 17), fill: "#FFFFFF", stroke: INK, sw: 4 },
    ] })),
  finish({ id: "kk-burung-hantu", name: "Burung Hantu Kecil", collection: "animal-friends", blurb: "Burung hantu kecil berjambul, penjaga malam yang lembut.", band: "9-18bln", who: "burung hantumu" },
    buddyArt({ earKind: "tuft", belly: true, nose: "beak" })),
  finish({ id: "kk-panda", name: "Panda Bundar", collection: "animal-friends", blurb: "Panda bundar berpipi tembam dengan lingkaran mata khasnya.", band: "9-18bln", who: "pandamu" },
    buddyArt({ earKind: "round", belly: true, nose: "round", extraDetails: [
      { el: E(204, 182, 17, 21), fill: INK },
      { el: E(276, 182, 17, 21), fill: INK },
    ] })),
  finish({ id: "kk-koala", name: "Koala", collection: "animal-friends", blurb: "Koala berhidung besar yang suka tidur siang di pohon.", band: "9-18bln", who: "koalamu" },
    buddyArt({ earKind: "round", belly: true, nose: "big" })),
  finish({ id: "kk-monyet", name: "Monyet Kecil", collection: "animal-friends", blurb: "Monyet kecil bermoncong lebar yang suka bergelantungan.", band: "9-18bln", who: "monyetmu" },
    buddyArt({ earKind: "round", muzzle: true, nose: "round" })),
  finish({ id: "kk-ayam", name: "Anak Ayam", collection: "animal-friends", blurb: "Anak ayam berbulu halus yang baru belajar berkotek.", band: "9-18bln", who: "anak ayammu" },
    buddyArt({ earKind: "tuft", wings: true, nose: "beak", bodyRx: 100, bodyRy: 88 })),
  finish({ id: "kk-penguin", name: "Penguin Kecil", collection: "animal-friends", blurb: "Penguin kecil berperut putih yang berjalan bergoyang.", band: "9-18bln", who: "penguinmu" },
    buddyArt({ earKind: "none", belly: true, wings: true, nose: "beak", bodyRx: 96, bodyRy: 96 })),
  finish({ id: "kk-domba", name: "Domba Kecil", collection: "animal-friends", blurb: "Domba kecil berwol keriting selembut awan.", band: "9-18bln", who: "dombamu" },
    buddyArt({ earKind: "round", woolTop: true, nose: "round" })),
  finish({ id: "kk-sapi", name: "Sapi Kecil", collection: "animal-friends", blurb: "Sapi kecil bertanduk mungil dari peternakan yang cerah.", band: "9-18bln", who: "sapimu" },
    buddyArt({ earKind: "horn", muzzle: true, nose: "pig" })),
  finish({ id: "kk-tikus", name: "Tikus Bundar", collection: "animal-friends", blurb: "Tikus bundar bertelinga besar dan ekor melingkar.", band: "9-18bln", who: "tikusmu" },
    buddyArt({ earKind: "round", tailSide: true, nose: "round", bodyRx: 98, bodyRy: 84 })),
  finish({ id: "kk-kuda-nil", name: "Kuda Nil", collection: "animal-friends", blurb: "Kuda nil bermoncong lebar yang suka berendam.", band: "9-18bln", who: "kuda nilmu" },
    buddyArt({ earKind: "round", muzzle: true, nose: "pig", bodyRx: 110, bodyRy: 84 })),
  finish({ id: "kk-rubah", name: "Rubah Kecil", collection: "animal-friends", blurb: "Rubah kecil bertelinga lancip dengan pipi berbulu putih.", band: "9-18bln", who: "rubahmu" },
    buddyArt({ earKind: "pointy", belly: true, nose: "round", extraDetails: [
      { el: Pa("M168 236 C176 262 200 276 224 272 C204 258 186 250 168 236 Z"), fill: "#FFFFFF" },
      { el: Pa("M312 236 C304 262 280 276 256 272 C276 258 294 250 312 236 Z"), fill: "#FFFFFF" },
    ] })),
  finish({ id: "kk-landak", name: "Landak Bundar", collection: "animal-friends", blurb: "Landak bundar berduri lembut — tidak menusuk, kok.", band: "9-18bln", who: "landakmu" },
    buddyArt({ earKind: "none", spikesTop: true, belly: true, nose: "round", bodyRx: 108, bodyRy: 84 })),

  finish({ id: "ob-apel", name: "Apel Besar", collection: "magical-garden", blurb: "Apel besar yang renyah dengan daun segar di tangkainya.", band: "9-18bln", who: "apelmu" }, {
    regions: [
      { id: "stem", label: "Tangkai", els: [Rc(232, 78, 15, 44, 6)] },
      { id: "leaf", label: "Daun", els: [Pa("M248 96 C252 66 282 52 306 62 C302 92 274 106 250 100 Z")] },
      { id: "fruit", label: "Buah Apel", els: [Pa("M240 108 C262 88 306 92 326 124 C348 160 334 224 306 258 C284 284 258 282 240 268 C222 282 196 284 174 258 C146 224 132 160 154 124 C174 92 218 88 240 108 Z")] },
    ],
    details: [groundAt(298, 120), { el: Pa("M186 150 C178 176 182 204 196 224"), stroke: "#FFFFFF", sw: 9 }],
    parts: [
      cylPart({ id: "stem", label: "Tangkai", assembly: "Gulung tangkai apel dan rekatkan di atas buah.", r: 0.05, h: 0.28, region: "stem", transform: { t: [0, 0.32, 0] } }),
      prismAt("leaf", "Daun", "leaf", [[-0.2, -0.06], [0.05, 0.16], [0.22, -0.02], [0, -0.14]], 278, 78),
      ballPart({ id: "fruit", label: "Buah Apel", assembly: "Buat bola apel besar yang gemuk.", r: 0.62, region: "fruit", transform: { s: [1.05, 1, 0.9], t: [0, -0.42, 0] } }),
    ],
  }),
  finish({ id: "ob-jeruk", name: "Jeruk Segar", collection: "magical-garden", blurb: "Jeruk bulat segar, siap diperas jadi warna cerah.", band: "9-18bln", who: "jerukmu" }, {
    regions: [
      { id: "leaf", label: "Daun", els: [Pa("M244 92 C250 64 278 52 300 62 C296 90 270 102 246 98 Z")] },
      { id: "fruit", label: "Buah Jeruk", els: [Ci(240, 196, 96)] },
    ],
    details: [groundAt(298, 120), { el: Ci(206, 168, 5), fill: "#FFFFFF", stroke: INK, sw: 2.5 }, { el: Ci(272, 226, 5), fill: "#FFFFFF", stroke: INK, sw: 2.5 }, { el: Ci(232, 248, 5), fill: "#FFFFFF", stroke: INK, sw: 2.5 }],
    parts: [
      prismAt("leaf", "Daun", "leaf", [[-0.2, -0.06], [0.05, 0.16], [0.22, -0.02], [0, -0.14]], 274, 76),
      ballPart({ id: "fruit", label: "Buah Jeruk", assembly: "Buat bola jeruk besar yang bulat sempurna.", r: 0.6, region: "fruit", transform: { t: [0, -0.4, 0] } }),
    ],
  }),
  finish({ id: "ob-stroberi", name: "Stroberi", collection: "magical-garden", blurb: "Stroberi merah muda berbiji mungil dan daun mahkota.", band: "9-18bln", who: "stroberimu" }, {
    regions: [
      { id: "leaves", label: "Daun Mahkota", els: [Pa("M240 118 L206 84 L224 118 L240 76 L256 118 L274 84 L240 118 Z"), Pa("M196 96 L240 116 L284 96 L268 122 L212 122 Z")] },
      { id: "fruit", label: "Buah Stroberi", els: [Pa("M240 116 C282 104 316 128 316 168 C316 216 278 262 240 282 C202 262 164 216 164 168 C164 128 198 104 240 116 Z")] },
    ],
    details: [groundAt(298, 110),
      { el: E(214, 168, 4, 7), fill: "#FFFFFF", stroke: INK, sw: 2 }, { el: E(262, 160, 4, 7), fill: "#FFFFFF", stroke: INK, sw: 2 },
      { el: E(240, 200, 4, 7), fill: "#FFFFFF", stroke: INK, sw: 2 }, { el: E(216, 226, 4, 7), fill: "#FFFFFF", stroke: INK, sw: 2 },
      { el: E(264, 224, 4, 7), fill: "#FFFFFF", stroke: INK, sw: 2 }, { el: E(240, 150, 4, 7), fill: "#FFFFFF", stroke: INK, sw: 2 }],
    parts: [
      prismAt("leaves", "Daun Mahkota", "leaves", [[-0.3, -0.08], [0, 0.14], [0.3, -0.08], [0.15, -0.16], [-0.15, -0.16]], 240, 100),
      ballPart({ id: "fruit", label: "Buah Stroberi", assembly: "Buat buah stroberi gemuk meruncing ke bawah.", r: 0.55, region: "fruit", transform: { s: [0.95, 1.1, 0.9], t: [0, -0.42, 0] } }),
    ],
  }),
  finish({ id: "ob-semangka", name: "Semangka", collection: "magical-garden", blurb: "Sepotong semangka segar dengan biji-biji kecil.", band: "9-18bln", who: "semangkamu" }, {
    regions: [
      { id: "rind", label: "Kulit", els: [Pa("M124 148 C124 232 176 284 240 284 C304 284 356 232 356 148 L322 148 C322 214 288 252 240 252 C192 252 158 214 158 148 Z")] },
      { id: "flesh", label: "Daging Buah", els: [Pa("M158 148 C158 214 192 252 240 252 C288 252 322 214 322 148 Z")] },
    ],
    details: [groundAt(298, 120),
      { el: E(214, 186, 5, 8), fill: INK }, { el: E(264, 180, 5, 8), fill: INK },
      { el: E(240, 214, 5, 8), fill: INK }, { el: E(196, 216, 5, 8), fill: INK }, { el: E(286, 212, 5, 8), fill: INK }],
    parts: [
      prismAt("rind", "Kulit", "rind", [[-0.7, 0.3], [0.7, 0.3], [0.55, -0.35], [-0.55, -0.35]], 240, 210),
      prismAt("flesh", "Daging Buah", "flesh", [[-0.5, 0.28], [0.5, 0.28], [0.35, -0.3], [-0.35, -0.3]], 240, 198, 0.06),
    ],
  }),
  finish({ id: "ob-pisang", name: "Pisang", collection: "magical-garden", blurb: "Pisang melengkung seperti senyuman kuning.", band: "9-18bln", who: "pisangmu" }, {
    regions: [
      { id: "peel", label: "Kulit Pisang", els: [Pa("M128 108 C140 208 208 268 300 272 C330 272 354 262 366 246 C330 252 268 240 222 204 C184 174 158 138 148 100 Z")] },
      { id: "fruit", label: "Buah Pisang", els: [Pa("M148 100 C158 138 184 174 222 204 C268 240 330 252 366 246 C340 218 268 214 214 176 C178 150 156 122 148 100 Z")] },
    ],
    details: [groundAt(298, 130), { el: Rc(140, 84, 16, 22, 5), fill: INK }],
    parts: [
      prismAt("peel", "Kulit Pisang", "peel", [[-0.6, -0.3], [0.2, 0.35], [0.7, 0.3], [0.1, 0.05], [-0.35, -0.35]], 240, 200, -0.04),
      prismAt("fruit", "Buah Pisang", "fruit", [[-0.55, -0.28], [0.15, 0.28], [0.65, 0.24], [0.05, 0], [-0.3, -0.3]], 246, 190, 0.03),
    ],
  }),
  finish({ id: "ob-matahari", name: "Matahari", collection: "space-explorers", blurb: "Matahari tersenyum yang menghangatkan pagi.", band: "9-18bln", who: "mataharimu" }, {
    regions: [
      { id: "rays", label: "Sinar", els: Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const cx = 240 + 108 * Math.cos(a), cy = 182 + 108 * Math.sin(a);
        return Pa(`M${cx - 17} ${cy + 15} L${cx + 3} ${cy - 22} L${cx + 19} ${cy + 13} Z`);
      }) },
      { id: "face", label: "Wajah Matahari", els: [Ci(240, 182, 76)] },
    ],
    details: [...eyesAt(240, 168, 26, 8), smileAt(240, 192, 34), ...cheeksAt(240, 196, 50, 11)],
    parts: [
      prismAt("rays", "Sinar", "rays", [[-0.65, -0.65], [0, -0.78], [0.65, -0.65], [0.78, 0], [0.65, 0.65], [0, 0.78], [-0.65, 0.65], [-0.78, 0]], 240, 182, -0.06),
      ballPart({ id: "face", label: "Wajah Matahari", assembly: "Buat bola wajah matahari yang bundar.", r: 0.48, region: "face", transform: { s: [1, 1, 0.55], t: [0, -0.32, 0] } }),
    ],
  }),
  finish({ id: "ob-bulan-awan", name: "Bulan & Awan", collection: "space-explorers", blurb: "Bulan sabit yang bersandar manja di awan lembut.", band: "9-18bln", who: "bulanmu" }, {
    regions: [
      { id: "moon", label: "Bulan Sabit", els: [Pa("M262 62 C202 84 168 136 172 196 C176 254 216 296 272 306 C232 268 214 220 222 168 C228 122 246 88 262 62 Z")] },
      { id: "cloud", label: "Awan", els: [Pa("M148 282 C124 282 108 266 112 248 C116 230 132 220 148 224 C156 202 178 190 200 196 C212 178 240 174 256 190 C276 180 302 192 304 212 C322 216 330 234 322 250 C314 268 296 274 280 268 L168 282 Z")] },
    ],
    details: [{ el: Ci(196, 128, 7), fill: "#FFFFFF", stroke: INK, sw: 3 }, { el: Ci(238, 96, 5), fill: "#FFFFFF", stroke: INK, sw: 3 }, ...eyesAt(196, 236, 20, 6), smileAt(196, 252, 20)],
    parts: [
      prismAt("moon", "Bulan Sabit", "moon", [[0.25, 0.62], [-0.3, 0.25], [-0.32, -0.3], [0.05, -0.62], [-0.12, -0.1], [-0.05, 0.3], [0.2, 0.55]], 224, 180, -0.05),
      ballPart({ id: "cloud", label: "Awan", assembly: "Buat gumpalan awan pipih sebagai alas bulan.", r: 0.5, region: "cloud", transform: { s: [1.3, 0.5, 0.8], t: [0, -0.82, 0.1] } }),
    ],
  }),
  finish({ id: "ob-awan-hujan", name: "Awan Hujan", collection: "space-explorers", blurb: "Awan ramah yang meneteskan hujan untuk bunga-bunga.", band: "9-18bln", who: "awanmu" }, {
    regions: [
      { id: "cloud", label: "Awan", els: [Pa("M132 208 C106 208 90 190 96 170 C102 152 120 144 136 150 C146 124 176 110 202 120 C216 102 248 100 264 116 C286 108 310 122 312 144 C330 150 338 168 330 186 C322 202 304 208 288 204 L150 208 Z")] },
      { id: "rain", label: "Tetes Hujan", els: [Pa("M160 236 C150 254 148 266 160 272 C172 266 170 254 160 236 Z"), Pa("M222 244 C212 262 210 274 222 280 C234 274 232 262 222 244 Z"), Pa("M282 236 C272 254 270 266 282 272 C294 266 292 254 282 236 Z")] },
    ],
    details: [...eyesAt(216, 158, 28, 8), smileAt(216, 180, 28), ...cheeksAt(216, 182, 56, 10)],
    parts: [
      ballPart({ id: "cloud", label: "Awan", assembly: "Buat gumpalan awan besar yang pipih.", r: 0.52, region: "cloud", transform: { s: [1.35, 0.62, 0.85], t: [-0.08, 0.05, 0] } }),
      prismAt("rain-1", "Tetes Hujan", "rain", [[0, 0.14], [0.09, -0.08], [0, -0.14], [-0.09, -0.08]], 160, 254),
      prismAt("rain-2", "Tetes Hujan", "rain", [[0, 0.14], [0.09, -0.08], [0, -0.14], [-0.09, -0.08]], 222, 262),
      prismAt("rain-3", "Tetes Hujan", "rain", [[0, 0.14], [0.09, -0.08], [0, -0.14], [-0.09, -0.08]], 282, 254),
    ],
  }),
  finish({ id: "ob-balon-kembar", name: "Balon Kembar", collection: "magical-garden", blurb: "Dua balon berdampingan yang siap terbang ke langit.", band: "9-18bln", who: "balonmu" }, {
    regions: [
      { id: "balloons", label: "Balon", els: [E(186, 148, 62, 76), E(292, 132, 56, 68)] },
      { id: "bows", label: "Simpul Pita", els: [Pa("M232 226 L208 210 L210 238 Z"), Pa("M232 226 L256 212 L254 240 Z"), Pa("M300 206 L278 192 L280 218 Z"), Pa("M300 206 L322 194 L320 220 Z")] },
    ],
    details: [
      { el: Pa("M232 232 C226 256 218 272 206 288"), stroke: INK, sw: 3.5 },
      { el: Pa("M300 212 C302 238 308 258 318 272"), stroke: INK, sw: 3.5 },
      { el: Pa("M164 116 C156 134 156 154 162 170"), stroke: "#FFFFFF", sw: 8 },
      { el: Pa("M272 104 C265 120 265 138 270 152"), stroke: "#FFFFFF", sw: 8 },
    ],
    parts: [
      ballPart({ id: "balloon-1", label: "Balon", assembly: "Buat dua bola balon besar yang pipih.", r: 0.42, region: "balloons", transform: { s: [0.85, 1.05, 0.6], t: [-0.33, 0.02, 0] } }),
      ballPart({ id: "balloon-2", label: "Balon", assembly: "Buat dua bola balon besar yang pipih.", r: 0.38, region: "balloons", transform: { s: [0.85, 1.05, 0.6], t: [0.32, 0.12, -0.05] } }),
      prismAt("bows", "Simpul Pita", "bows", [[-0.3, 0.1], [0, 0], [0.3, 0.1], [0.15, -0.12], [-0.15, -0.12]], 266, 218, 0.1),
    ],
  }),
  finish({ id: "ob-bola-pantai", name: "Bola Pantai", collection: "magical-garden", blurb: "Bola pantai besar untuk bermain di tepi kolam.", band: "9-18bln", who: "bolamu" }, {
    regions: [
      { id: "panels", label: "Panel Bola", els: [
        Pa("M240 84 C190 118 168 168 172 224 C174 256 186 282 204 296 C182 246 180 178 204 118 C214 96 226 86 240 84 Z"),
        Pa("M240 84 C290 118 312 168 308 224 C306 256 294 282 276 296 C298 246 300 178 276 118 C266 96 254 86 240 84 Z"),
      ] },
      { id: "center", label: "Panel Tengah", els: [Pa("M240 84 C226 86 214 96 204 118 C180 178 182 246 204 296 C218 306 262 306 276 296 C300 246 300 178 276 118 C266 96 254 86 240 84 Z")] },
    ],
    details: [groundAt(300, 120), { el: Ci(240, 92, 12), fill: "#FFFFFF", stroke: INK, sw: 4 }],
    parts: [
      ballPart({ id: "panels", label: "Panel Bola", assembly: "Buat bola pantai besar; panel samping dan tengah bergantian warnanya.", r: 0.62, region: "panels", transform: { t: [0, -0.38, 0] } }),
      discAt("center", "Panel Tengah", "center", 240, 190, 40, 0.55),
    ],
  }),
  finish({ id: "ob-jamur", name: "Jamur", collection: "magical-garden", blurb: "Jamur bertopi lebar berbintik, rumah mungil serangga.", band: "9-18bln", who: "jamurmu" },
    plantArt({ kind: "mushroom" })),
  finish({ id: "ob-bunga", name: "Bunga Besar", collection: "magical-garden", blurb: "Bunga besar berwajah ceria yang suka sinar matahari.", band: "9-18bln", who: "bungamu" }, {
    regions: [
      { id: "petals", label: "Kelopak", els: petalEls(240, 168, 7, 62, 40, 40) },
      { id: "center", label: "Tengah Bunga", els: [Ci(240, 168, 44)] },
    ],
    details: [groundAt(300, 130), ...eyesAt(240, 158, 17, 7), smileAt(240, 180, 24), ...cheeksAt(240, 184, 34, 10)],
    parts: [
      ballPart({ id: "petals", label: "Kelopak", assembly: "Buat bola kelopak pipih yang lebar.", r: 0.55, region: "petals", transform: { s: [1.3, 1.3, 0.4], t: [0, -0.28, 0] } }),
      discAt("center", "Tengah Bunga", "center", 240, 168, 42, 0.25),
    ],
  }),
  finish({ id: "ob-eskrim", name: "Es Krim", collection: "magical-garden", blurb: "Es krim satu scoop dengan ceri di puncaknya.", band: "9-18bln", who: "es krimmu" },
    foodArt({ kind: "icecream", scoops: 1 })),
  finish({ id: "ob-lolipop", name: "Lolipop", collection: "magical-garden", blurb: "Lolipop bundar berputar seperti roda warna.", band: "9-18bln", who: "lolipopmu" }, {
    regions: [
      { id: "candy", label: "Permen", els: [Ci(240, 148, 78)] },
      { id: "stick", label: "Gagang", els: [Rc(231, 222, 18, 78, 8)] },
    ],
    details: [
      { el: Pa("M240 148 m-44 0 C244 118 282 122 284 148 C286 176 254 190 240 172 C228 156 246 138 262 148"), stroke: INK, sw: 5 },
      { el: Pa("M240 148 m-18 0 a18 18 0 1 0 18 -18"), stroke: INK, sw: 5 },
      groundAt(306, 100),
    ],
    parts: [
      ballPart({ id: "candy", label: "Permen", assembly: "Buat bola permen pipih yang besar.", r: 0.5, region: "candy", transform: { s: [1, 1, 0.4], t: [0, 0.05, 0] } }),
      cylPart({ id: "stick", label: "Gagang", assembly: "Gulung gagang lolipop menjadi tabung ramping.", r: 0.055, h: 0.5, region: "stick", transform: { t: [0, -0.72, 0] } }),
    ],
  }),
  finish({ id: "ob-donat", name: "Donat", collection: "magical-garden", blurb: "Donat gemuk berlapis gula dan taburan warna-warni.", band: "9-18bln", who: "donatmu" },
    foodArt({ kind: "donut" })),
  finish({ id: "ob-hati", name: "Hati & Pita", collection: "magical-garden", blurb: "Hati besar berpita — tanda sayang untuk orang tersayang.", band: "9-18bln", who: "hatimu" }, {
    regions: [
      { id: "heart", label: "Hati", els: [Pa("M240 268 C160 214 128 168 128 122 C128 84 156 62 188 62 C212 62 232 76 240 94 C248 76 268 62 292 62 C324 62 352 84 352 122 C352 168 320 214 240 268 Z")] },
      { id: "bow", label: "Pita", els: [Pa("M240 108 L196 84 L198 130 Z"), Pa("M240 108 L284 84 L282 130 Z"), Ci(240, 108, 13)] },
    ],
    details: [groundAt(298, 120), { el: Pa("M168 108 C160 126 162 146 172 160"), stroke: "#FFFFFF", sw: 9 }],
    parts: [
      prismAt("heart", "Hati", "heart", [[0, -0.62], [0.5, -0.28], [0.62, 0.05], [0.3, 0.42], [0, 0.62], [-0.3, 0.42], [-0.62, 0.05], [-0.5, -0.28]], 240, 168, 0),
      prismAt("bow", "Pita", "bow", [[-0.3, 0.08], [0, 0], [0.3, 0.08], [0.18, -0.14], [-0.18, -0.14]], 240, 106, 0.12),
    ],
  }),
  finish({ id: "ob-kepik", name: "Kepik", collection: "magical-garden", blurb: "Kepik bundar berbintik yang suka hinggap di daun.", band: "9-18bln", who: "kepikmu" }, {
    regions: [
      { id: "body", label: "Badan", els: [Ci(240, 196, 88)] },
      { id: "head", label: "Kepala", els: [Pa("M186 148 C196 112 284 112 294 148 C270 162 210 162 186 148 Z")] },
    ],
    details: [
      { el: Pa("M240 150 L240 282"), stroke: INK, sw: 5 },
      { el: Ci(206, 196, 11), fill: INK }, { el: Ci(276, 190, 9), fill: INK }, { el: Ci(222, 244, 9), fill: INK }, { el: Ci(268, 240, 12), fill: INK },
      { el: Pa("M206 118 C196 100 182 92 168 94"), stroke: INK, sw: 5 },
      { el: Pa("M274 118 C284 100 298 92 312 94"), stroke: INK, sw: 5 },
      { el: Ci(166, 94, 6), fill: INK }, { el: Ci(314, 94, 6), fill: INK },
      groundAt(298, 110),
    ],
    parts: [
      ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan kepik yang pipih.", r: 0.56, region: "body", transform: { s: [1, 1, 0.55], t: [0, -0.42, 0] } }),
      ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala kecil dan rekatkan di atas badan.", r: 0.3, region: "head", transform: { s: [1.15, 0.6, 0.6], t: [0, 0.02, 0.05] } }),
    ],
  }),
  finish({ id: "ob-siput", name: "Siput", collection: "magical-garden", blurb: "Siput bercangkang bundar yang berjalan pelan-pelan.", band: "9-18bln", who: "siputmu" }, {
    regions: [
      { id: "shell", label: "Cangkang", els: [Ci(196, 178, 80)] },
      { id: "body", label: "Badan", els: [Pa("M120 268 C118 246 140 236 176 238 L316 238 C348 238 366 250 364 264 C362 278 344 284 316 284 L160 284 C136 284 122 280 120 268 Z")] },
    ],
    details: [
      { el: Pa("M196 178 m-46 0 a46 46 0 1 1 46 46 a30 30 0 1 0 30 -30 a16 16 0 1 1 -16 -16"), stroke: INK, sw: 5 },
      { el: Pa("M330 236 C332 210 344 192 360 184"), stroke: INK, sw: 5 },
      { el: Pa("M306 238 C304 214 296 198 284 188"), stroke: INK, sw: 5 },
      { el: Ci(362, 182, 7), fill: INK }, { el: Ci(282, 186, 7), fill: INK },
      { el: Ci(338, 216, 6), fill: INK },
      groundAt(298, 130),
    ],
    parts: [
      ballPart({ id: "shell", label: "Cangkang", assembly: "Buat bola cangkang pipih yang besar.", r: 0.52, region: "shell", transform: { s: [1, 1, 0.55], t: [-0.28, -0.3, 0] } }),
      boxPart({ id: "body", label: "Badan", assembly: "Lipat badan siput menjadi alas pipih memanjang.", w: 1.5, h: 0.22, d: 0.5, regions: { front: "body", back: "body", left: "body", right: "body", top: "body", bottom: "body" }, transform: { t: [0, -0.85, 0.05] } }),
    ],
  }),
  finish({ id: "ob-bintang-laut", name: "Bintang Laut", collection: "animal-friends", blurb: "Bintang laut berlengan lima yang tersenyum di pasir.", band: "9-18bln", who: "bintang lautmu" }, {
    regions: [
      { id: "star", label: "Bintang Laut", els: [Pa(starPath(240, 182, 96, 44))] },
      { id: "spots", label: "Bintik", els: [Ci(240, 120, 8), Ci(186, 190, 8), Ci(294, 190, 8), Ci(216, 238, 8), Ci(266, 240, 8)] },
    ],
    details: [groundAt(298, 120), ...eyesAt(240, 168, 15, 6.5), smileAt(240, 186, 20)],
    parts: [
      prismAt("star", "Bintang Laut", "star", [[0, -0.6], [0.14, -0.2], [0.58, -0.18], [0.24, 0.08], [0.36, 0.5], [0, 0.26], [-0.36, 0.5], [-0.24, 0.08], [-0.58, -0.18], [-0.14, -0.2]], 240, 182),
      ballAt("spot-1", "Bintik", "spots", 240, 120, 9, 0.12),
      ballAt("spot-2", "Bintik", "spots", 186, 190, 9, 0.12),
      ballAt("spot-3", "Bintik", "spots", 294, 190, 9, 0.12),
    ],
    merges: { spots: "star" },
  }),
  finish({ id: "ob-permen", name: "Permen Bungkus", collection: "magical-garden", blurb: "Permen bundar dengan bungkus berputar di kedua sisi.", band: "9-18bln", who: "permenmu" }, {
    regions: [
      { id: "wrappers", label: "Bungkus", els: [Pa("M168 182 L104 138 L116 182 L104 226 Z"), Pa("M312 182 L376 138 L364 182 L376 226 Z")] },
      { id: "candy", label: "Permen", els: [Ci(240, 182, 74)] },
    ],
    details: [
      { el: Pa("M240 182 m-40 0 C244 154 278 158 279 182 C280 208 248 220 238 200 C230 184 248 168 262 178"), stroke: INK, sw: 5 },
      groundAt(298, 110),
    ],
    parts: [
      prismAt("wrap-l", "Bungkus", "wrappers", [[-0.2, 0.28], [0.18, 0], [-0.2, -0.28], [0.05, 0]], 136, 182, -0.03),
      prismAt("wrap-r", "Bungkus", "wrappers", [[0.2, 0.28], [-0.18, 0], [0.2, -0.28], [-0.05, 0]], 344, 182, -0.03),
      ballPart({ id: "candy", label: "Permen", assembly: "Buat bola permen pipih yang besar.", r: 0.48, region: "candy", transform: { s: [1, 1, 0.45], t: [0, -0.32, 0] } }),
    ],
  }),
];

/* ================================================================== */
/* LEVEL 2 — LITTLE EXPLORERS (18–24 bulan) · 4–5 bidang besar         */
/* ================================================================== */

const L2: TemplateDef[] = [
  finish({ id: "la-katak-daun", name: "Katak di Daun", collection: "animal-friends", blurb: "Katak kecil yang duduk manis di daun teratai.", band: "1-2th", who: "katakmu" }, {
    regions: [
      { id: "leaf", label: "Daun Teratai", els: [Pa("M96 262 C110 206 176 176 240 176 C304 176 370 206 384 262 C340 288 140 288 96 262 Z")] },
      { id: "body", label: "Badan", els: [E(240, 196, 72, 58)] },
      { id: "belly", label: "Perut", els: [E(240, 222, 40, 30)] },
      { id: "eyes", label: "Mata", els: [Ci(202, 138, 19), Ci(278, 138, 19)] },
    ],
    details: [
      { el: Ci(202, 136, 8), fill: INK }, { el: Ci(278, 136, 8), fill: INK },
      { el: Ci(205, 133, 3), fill: "#FFFFFF" }, { el: Ci(281, 133, 3), fill: "#FFFFFF" },
      smileAt(240, 196, 34), ...cheeksAt(240, 204, 52, 10), groundAt(298, 140),
    ],
    parts: [
      discAt("leaf", "Daun Teratai", "leaf", 240, 240, 120, 0),
      ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan katak yang pipih.", r: 0.45, region: "body", transform: { s: [1.1, 0.9, 0.8], t: [0, -0.22, 0.1] } }),
      discAt("belly", "Perut", "belly", 240, 222, 38, 0.5),
      ballAt("eye-l", "Mata", "eyes", 202, 138, 17, 0.3),
      ballAt("eye-r", "Mata", "eyes", 278, 138, 17, 0.3),
    ],
    merges: { eyes: "body", belly: "body" },
  }),
  finish({ id: "la-ikan-gelembung", name: "Ikan & Gelembung", collection: "animal-friends", blurb: "Ikan oranye yang meniup gelembung-gelembung kecil.", band: "1-2th", who: "ikanmu" },
    fishArt({ kind: "fish", bubbles: true, merges: { fin: "body", belly: "body" } })),
  finish({ id: "la-burung-sarang", name: "Burung di Sarang", collection: "animal-friends", blurb: "Burung kecil yang mengintip dari sarang hangatnya.", band: "1-2th", who: "burungmu" }, {
    regions: [
      { id: "body", label: "Badan", els: [Pa("M168 218 C168 156 198 112 240 112 C282 112 312 156 312 218 C282 240 198 240 168 218 Z")] },
      { id: "wing", label: "Sayap", els: [Pa("M196 176 C218 164 246 168 254 186 C260 204 248 220 230 222 C212 222 196 208 194 192 Z")] },
      { id: "tail", label: "Ekor", els: [Pa("M306 190 C330 176 350 176 360 188 C346 206 324 212 308 206 Z")] },
      { id: "nest", label: "Sarang", els: [Pa("M148 226 L332 226 C326 262 292 284 240 284 C188 284 154 262 148 226 Z")] },
    ],
    details: [
      ...eyesAt(240, 158, 24, 8),
      { el: Pa("M228 176 L252 176 L240 192 Z"), fill: "#F4842B", stroke: INK, sw: 3 },
      ...cheeksAt(240, 182, 48, 10),
      { el: Pa("M170 240 C200 250 280 250 310 240"), stroke: INK, sw: 4 },
      { el: Pa("M180 258 C210 266 270 266 300 258"), stroke: INK, sw: 4 },
      groundAt(300, 120),
    ],
    parts: [
      ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan burung dan letakkan di dalam sarang.", r: 0.48, region: "body", transform: { s: [1, 0.95, 0.85], t: [0, -0.28, 0] } }),
      prismAt("wing", "Sayap", "wing", [[-0.2, 0.18], [0.2, 0.2], [0.16, -0.18], [-0.16, -0.14]], 224, 194, 0.45),
      prismAt("tail", "Ekor", "tail", [[-0.16, 0.1], [0.18, 0.14], [0.1, -0.12], [-0.14, -0.1]], 332, 192, -0.05),
      boxPart({ id: "nest", label: "Sarang", assembly: "Lipat sarang menjadi mangkuk lebar di bawah burung.", w: 1.1, h: 0.32, d: 0.7, regions: { front: "nest", back: "nest", left: "nest", right: "nest", top: "nest", bottom: "nest" }, transform: { t: [0, -0.78, 0.05] } }),
    ],
    merges: { wing: "body", tail: "body" },
  }),
  finish({ id: "la-kucing-benang", name: "Kucing & Bola Benang", collection: "animal-friends", blurb: "Kucing bundar yang menemukan bola benang favoritnya.", band: "1-2th", who: "kucingmu" },
    buddyArt({ earKind: "pointy", belly: true, nose: "round", accessory: { id: "yarn", label: "Bola Benang", els: [Ci(356, 258, 30)], part: ballAt("yarn", "Bola Benang", "yarn", 356, 258, 30) }, extraDetails: [
      { el: Pa("M330 244 C318 232 306 232 296 242"), stroke: INK, sw: 3.5 },
      { el: Pa("M338 272 C326 262 314 262 304 270"), stroke: INK, sw: 3.5 },
    ] })),
  finish({ id: "la-anjing-tulang", name: "Anjing & Tulang", collection: "animal-friends", blurb: "Anjing setia menjaga tulang kesayangannya.", band: "1-2th", who: "anjingmu" },
    buddyArt({ earKind: "floppy", belly: true, nose: "round", accessory: { id: "bone", label: "Tulang", els: [Ci(196, 282, 12), Ci(196, 262, 12), Rc(204, 264, 56, 16, 8), Ci(268, 262, 12), Ci(268, 282, 12)], part: prismAt("bone", "Tulang", "bone", [[-0.3, 0.06], [0.3, 0.06], [0.3, -0.06], [-0.3, -0.06]], 232, 272, 0.3) } })),
  finish({ id: "la-beruang-madu", name: "Beruang & Pot Madu", collection: "animal-friends", blurb: "Beruang bundar yang tidak sabar mencicipi madu manis.", band: "1-2th", who: "beruangmu" },
    buddyArt({ earKind: "round", belly: true, nose: "round", accessory: { id: "pot", label: "Pot Madu", els: [Pa("M322 292 L330 244 L382 244 L390 292 Z"), E(356, 242, 27, 9)], part: boxAt("pot", "Pot Madu", "pot", 0.42, 0.3, 0.36, 356, 268) } })),
  finish({ id: "la-kelinci-wortel", name: "Kelinci & Wortel", collection: "animal-friends", blurb: "Kelinci mungil memeluk wortel yang lebih besar darinya.", band: "1-2th", who: "kelincimu" },
    buddyArt({ earKind: "long", belly: true, nose: "round", accessory: { id: "carrot", label: "Wortel", els: [Pa("M336 226 L376 226 L356 292 Z"), Pa("M346 226 C340 206 330 196 318 194 C330 186 344 190 350 202 C354 190 368 184 378 190 C368 200 362 212 362 224 Z")], part: prismAt("carrot", "Wortel", "carrot", [[-0.14, 0.3], [0.14, 0.3], [0, -0.3]], 356, 258, 0.2) } })),
  finish({ id: "la-panda-bambu", name: "Panda & Bambu", collection: "animal-friends", blurb: "Panda bundar mengunyah bambu segar dengan lahap.", band: "1-2th", who: "pandamu" },
    buddyArt({ earKind: "round", belly: true, nose: "round", accessory: { id: "bamboo", label: "Bambu", els: [Rc(338, 176, 17, 116, 8), Pa("M355 196 C368 178 388 172 402 180 C392 196 374 204 356 202 Z"), Pa("M338 236 C326 220 308 214 296 222 C304 238 322 244 336 242 Z")], part: cylPart({ id: "bamboo", label: "Bambu", assembly: "Gulung batang bambu dan rekatkan di sisi panda.", r: 0.06, h: 0.72, region: "bamboo", transform: { t: [0.72, -0.45, 0.1] } }) }, extraDetails: [
      { el: E(204, 182, 17, 21), fill: INK },
      { el: E(276, 182, 17, 21), fill: INK },
    ] })),
  finish({ id: "la-bunga-pot", name: "Bunga dalam Pot", collection: "magical-garden", blurb: "Bunga ceria yang tumbuh subur di pot favoritnya.", band: "1-2th", who: "bungamu" },
    plantArt({ kind: "flower", pot: true, merges: { leaves: "stem", center: "petals" } })),
  finish({ id: "la-rumah-jamur", name: "Rumah Jamur", collection: "magical-garden", blurb: "Rumah jamur mungil berpintu lengkung di tengah taman.", band: "1-2th", who: "rumah jamurmu" },
    plantArt({ kind: "mushroom", house: true, merges: { spots: "cap", window: "stem" } })),
  finish({ id: "la-pohon-apel", name: "Pohon Apel", collection: "magical-garden", blurb: "Pohon apel rindang dengan buah-buah yang siap panen.", band: "1-2th", who: "pohon apelmu" }, {
    regions: [
      { id: "canopy", label: "Daun Pohon", els: [Ci(240, 106, 64), Ci(174, 136, 46), Ci(306, 136, 46)] },
      { id: "trunk", label: "Batang", els: [Pa("M226 284 C228 244 230 208 228 176 L254 176 C252 208 252 244 256 284 Z")] },
      { id: "fruit", label: "Apel", els: [Ci(192, 112, 14), Ci(276, 92, 14), Ci(240, 146, 14), Ci(306, 142, 13)] },
      { id: "grass", label: "Rumput", els: [Pa("M84 306 C88 282 130 272 180 280 L300 280 C350 272 392 282 396 306 Z")] },
    ],
    details: [groundAt(302, 150)],
    parts: [
      ballPart({ id: "canopy", label: "Daun Pohon", assembly: "Buat bola daun pohon besar dan rekatkan di atas batang.", r: 0.56, region: "canopy", transform: { s: [1.35, 0.95, 1], t: [0, 0.35, 0] } }),
      cylPart({ id: "trunk", label: "Batang", assembly: "Gulung batang pohon menjadi tabung kokoh.", r: 0.13, h: 0.68, region: "trunk", transform: { t: [0, -0.62, 0] } }),
      ballAt("fruit-1", "Apel", "fruit", 192, 112, 14, 0.4),
      ballAt("fruit-2", "Apel", "fruit", 276, 92, 14, 0.4),
      ballAt("fruit-3", "Apel", "fruit", 240, 146, 14, 0.45),
      discAt("grass", "Rumput", "grass", 240, 296, 130, -0.1),
    ],
    merges: { fruit: "canopy" },
  }),
  finish({ id: "la-matahari-awan", name: "Matahari & Pelangi", collection: "space-explorers", blurb: "Matahari tersenyum di ujung pelangi setelah hujan.", band: "1-2th", who: "mataharimu" }, {
    regions: [
      { id: "rainbow", label: "Pelangi", els: [Pa("M108 262 C118 168 176 116 240 116 C304 116 362 168 372 262 L330 262 C322 190 282 152 240 152 C198 152 158 190 150 262 Z")] },
      { id: "rays", label: "Sinar", els: [Pa("M240 30 L226 62 L254 62 Z"), Pa("M152 62 L168 90 L188 72 Z"), Pa("M328 62 L312 90 L292 72 Z")] },
      { id: "sun", label: "Matahari", els: [Ci(240, 108, 42)] },
      { id: "cloud", label: "Awan", els: [Pa("M84 268 C66 268 54 254 58 240 C62 226 76 220 88 224 C96 206 118 198 136 206 L168 262 Z"), Pa("M396 268 C414 268 426 254 422 240 C418 226 404 220 392 224 C384 206 362 198 344 206 L312 262 Z")] },
    ],
    details: [...eyesAt(240, 100, 15, 6.5), smileAt(240, 118, 20), ...cheeksAt(240, 120, 30, 8)],
    parts: [
      prismAt("rainbow", "Pelangi", "rainbow", [[-0.85, -0.5], [-0.3, 0.35], [0.3, 0.35], [0.85, -0.5], [0.6, -0.5], [0.25, 0.05], [-0.25, 0.05], [-0.6, -0.5]], 240, 190, -0.15),
      prismAt("rays", "Sinar", "rays", [[-0.55, 0.2], [0, 0.3], [0.55, 0.2], [0.3, -0.05], [-0.3, -0.05]], 240, 66, -0.05),
      ballAt("sun", "Matahari", "sun", 240, 108, 42, 0),
      ballPart({ id: "cloud", label: "Awan", assembly: "Buat dua gumpalan awan pipih di kaki pelangi.", r: 0.3, region: "cloud", transform: { s: [1.5, 0.6, 0.8], t: [-0.75, -0.7, 0.1] } }),
      ballPart({ id: "cloud-2", label: "Awan", assembly: "Buat dua gumpalan awan pipih di kaki pelangi.", r: 0.3, region: "cloud", transform: { s: [1.5, 0.6, 0.8], t: [0.75, -0.7, 0.1] } }),
    ],
    merges: { rays: "sun", cloud: "rainbow" },
  }),
  finish({ id: "la-bus-mini", name: "Bus Mini", collection: "little-vehicles", blurb: "Bus mini ramah yang mengantar anak-anak berkeliling kota.", band: "1-2th", who: "busmu" },
    vehicleArt({ kind: "bus", stripe: true, merges: { stripe: "body", windows: "body" } })),
  finish({ id: "la-truk-mini", name: "Truk Kecil", collection: "little-vehicles", blurb: "Truk kecil pekerja keras dengan bak muatan besar.", band: "1-2th", who: "trukmu" },
    vehicleArt({ kind: "truck", merges: { window: "cabin" } })),
  finish({ id: "la-kereta-mini", name: "Kereta Kecil", collection: "little-vehicles", blurb: "Kereta kecil ber-asap bundar yang siap berangkat. Tuuut!", band: "1-2th", who: "keretamu" },
    vehicleArt({ kind: "train", merges: { smoke: "body", window: "cabin" } })),
  finish({ id: "la-kapal-layar", name: "Kapal Layar", collection: "little-vehicles", blurb: "Kapal layar kecil yang berlayar di ombak lembut.", band: "1-2th", who: "kapalmu" },
    boatArt({ sailKind: "triangle", flag: true, waves: true, merges: { flag: "sail", waves: "hull" } })),
  finish({ id: "la-pesawat-mini", name: "Pesawat Kecil", collection: "little-vehicles", blurb: "Pesawat kecil yang melintasi langit siang yang cerah.", band: "1-2th", who: "pesawatmu" },
    planeArt({ merges: { windows: "body", tail: "body" } })),
  finish({ id: "la-sepeda", name: "Sepeda Bunga", collection: "little-vehicles", blurb: "Sepeda dengan keranjang penuh bunga untuk berkeliling taman.", band: "1-2th", who: "sepedamu" }, {
    regions: [
      { id: "wheels", label: "Roda", els: [Ci(140, 252, 40), Ci(336, 252, 40)] },
      { id: "frame", label: "Rangka", els: [Pa("M140 252 L216 176 L300 176 L336 252 L226 252 L186 190 Z M216 176 L226 252 M262 158 L300 176")] },
      { id: "basket", label: "Keranjang", els: [Pa("M296 168 L348 168 L338 206 L306 206 Z")] },
      { id: "flowers", label: "Bunga", els: [Ci(308, 158, 10), Ci(328, 150, 11), Ci(346, 160, 9)] },
    ],
    details: [
      { el: Ci(140, 252, 9), fill: "#FFFFFF", stroke: INK, sw: 3.5 },
      { el: Ci(336, 252, 9), fill: "#FFFFFF", stroke: INK, sw: 3.5 },
      { el: Rc(196, 158, 34, 9, 4), fill: INK },
      groundAt(300, 150),
    ],
    parts: [
      cylPart({ id: "wheel-l", label: "Roda", assembly: "Gulung dua roda sepeda yang ramping.", r: 0.25, h: 0.06, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [-0.6, -0.72, 0] } }),
      cylPart({ id: "wheel-r", label: "Roda", assembly: "Gulung dua roda sepeda yang ramping.", r: 0.25, h: 0.06, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [0.58, -0.72, 0] } }),
      prismAt("frame", "Rangka", "frame", [[-0.6, -0.45], [0.1, 0.3], [0.55, 0.3], [0.62, -0.45], [0, -0.45], [-0.3, 0.05]], 238, 214, 0),
      boxAt("basket", "Keranjang", "basket", 0.32, 0.22, 0.26, 322, 186),
      ballAt("flower-1", "Bunga", "flowers", 308, 158, 10, 0.15),
      ballAt("flower-2", "Bunga", "flowers", 328, 150, 11, 0.15),
    ],
    merges: { flowers: "basket", basket: "frame" },
  }),
  finish({ id: "la-balon-udara", name: "Balon Udara", collection: "space-explorers", blurb: "Balon udara bergaris yang melayang pelan di atas awan.", band: "1-2th", who: "balon udaramu" }, {
    regions: [
      { id: "balloon", label: "Balon", els: [Pa("M240 52 C306 52 348 102 348 158 C348 206 306 240 268 252 L212 252 C174 240 132 206 132 158 C132 102 174 52 240 52 Z")] },
      { id: "stripes", label: "Garis Balon", els: [Pa("M196 66 C172 100 164 160 178 224 C188 238 200 248 212 252 C190 200 186 120 196 66 Z"), Pa("M284 66 C308 100 316 160 302 224 C292 238 280 248 268 252 C290 200 294 120 284 66 Z")] },
      { id: "basket", label: "Keranjang", els: [Pa("M206 278 L274 278 L264 312 L216 312 Z")] },
      { id: "cloud", label: "Awan", els: [Pa("M84 292 C66 292 54 280 58 266 C62 254 76 248 88 252 C96 236 116 230 132 238 L160 292 Z"), Pa("M396 292 C414 292 426 280 422 266 C418 254 404 248 392 252 C384 236 364 230 348 238 L320 292 Z")] },
    ],
    details: [
      { el: Pa("M216 254 L226 278 M264 254 L254 278"), stroke: INK, sw: 4 },
      ...eyesAt(240, 148, 0, 8), smileAt(240, 168, 22),
    ],
    parts: [
      ballPart({ id: "balloon", label: "Balon", assembly: "Buat bola balon udara besar yang lonjong.", r: 0.62, region: "balloon", transform: { s: [1, 1.15, 0.95], t: [0, 0.12, 0] } }),
      prismAt("stripes", "Garis Balon", "stripes", [[-0.55, 0.5], [-0.2, -0.55], [0.2, -0.55], [0.55, 0.5], [0.3, 0.58], [-0.3, 0.58]], 240, 158, 0.58),
      boxAt("basket", "Keranjang", "basket", 0.4, 0.22, 0.34, 240, 294),
      ballPart({ id: "cloud", label: "Awan", assembly: "Buat dua gumpalan awan pipih di bawah balon.", r: 0.28, region: "cloud", transform: { s: [1.5, 0.6, 0.8], t: [-0.78, -0.78, 0.1] } }),
      ballPart({ id: "cloud-2", label: "Awan", assembly: "Buat dua gumpalan awan pipih di bawah balon.", r: 0.28, region: "cloud", transform: { s: [1.5, 0.6, 0.8], t: [0.78, -0.78, 0.1] } }),
    ],
    merges: { stripes: "balloon", cloud: "balloon" },
  }),
  finish({ id: "la-planet-cincin", name: "Planet Bercincin", collection: "space-explorers", blurb: "Planet tersenyum dengan cincin lebar dan bulan kecilnya.", band: "1-2th", who: "planetmu" },
    planetArt({ craters: true, moon: true, merges: { spots: "planet", moon: "planet", ring: "planet" } })),
  finish({ id: "la-komet", name: "Komet Ceria", collection: "space-explorers", blurb: "Komet ceria yang melesat sambil menyapa planet kecil.", band: "1-2th", who: "kometmu" }, {
    regions: [
      { id: "tail", label: "Ekor Komet", els: [Pa("M236 128 C176 104 116 108 72 140 C124 152 150 168 168 196 C190 178 216 160 244 152 Z"), Pa("M228 168 C176 168 128 184 96 214 C146 216 186 204 214 186 Z")] },
      { id: "head", label: "Kepala Komet", els: [Ci(272, 148, 62)] },
      { id: "planet", label: "Planet Kecil", els: [Ci(368, 252, 34)] },
      { id: "ring", label: "Cincin Planet", els: [Pa("M316 258 C340 238 396 238 420 258 C396 272 340 272 316 258 Z M338 257 C354 266 382 266 398 257 C382 249 354 249 338 257 Z")] },
    ],
    details: [...eyesAt(282, 138, 18, 7), smileAt(282, 160, 20), ...cheeksAt(282, 162, 38, 9)],
    parts: [
      prismAt("tail", "Ekor Komet", "tail", [[-0.7, 0.3], [0.1, 0.05], [0.55, -0.15], [0.05, -0.3], [-0.55, -0.1]], 160, 158, -0.05),
      ballAt("head", "Kepala Komet", "head", 272, 148, 60, 0),
      ballAt("planet", "Planet Kecil", "planet", 368, 252, 33, -0.05),
      prismAt("ring", "Cincin Planet", "ring", [[-0.32, 0], [0, 0.1], [0.32, 0], [0, -0.1]], 368, 256, 0),
    ],
    merges: { ring: "planet", tail: "head" },
  }),
  finish({ id: "la-roket-mini", name: "Roket Mini", collection: "space-explorers", blurb: "Roket mini yang bersiap lepas landas ke langit sore.", band: "1-2th", who: "roketmu" }, {
    regions: [
      { id: "flame", label: "Api", els: [Pa("M222 262 C228 286 236 300 240 310 C244 300 252 286 258 262 C248 274 232 274 222 262 Z")] },
      { id: "fins", label: "Sirip", els: [Pa("M204 196 C188 224 182 248 184 264 L206 254 Z"), Pa("M276 196 C292 224 298 248 296 264 L274 254 Z")] },
      { id: "body", label: "Badan Roket", els: [Pa("M204 258 L204 148 C204 104 220 66 240 52 C260 66 276 104 276 148 L276 258 C252 268 228 268 204 258 Z")] },
      { id: "nose", label: "Hidung Roket", els: [Pa("M240 52 C260 66 276 104 276 148 L204 148 C204 104 220 66 240 52 Z")] },
      { id: "window", label: "Jendela", els: [Ci(240, 188, 24)] },
    ],
    details: [{ el: Ci(240, 188, 15), fill: "#FFFFFF", stroke: INK, sw: 3.5 }, groundAt(316, 120)],
    parts: [
      conePart({ id: "flame", label: "Api", assembly: "Gulung api menjadi kerucut dan rekatkan mengarah ke bawah.", r: 0.14, h: 0.34, region: "flame", transform: { r: [Math.PI, 0, 0], t: [0, -0.82, 0] } }),
      prismPart({ id: "fin-l", label: "Sirip", assembly: "Lipat kedua sirip dan rekatkan di sisi bawah roket.", poly: [[0, 0.24], [0, -0.2], [-0.24, -0.24], [-0.2, 0]], depth: 0.08, region: "fins", transform: { t: [-0.32, -0.5, 0] } }),
      prismPart({ id: "fin-r", label: "Sirip", assembly: "Lipat kedua sirip dan rekatkan di sisi bawah roket.", poly: [[0, 0.24], [0, -0.2], [0.24, -0.24], [0.2, 0]], depth: 0.08, region: "fins", transform: { t: [0.32, -0.5, 0] } }),
      lathePart({
        id: "body", label: "Badan Roket", assembly: "Rekatkan strip badan menjadi tabung roket; hidungnya di atas.",
        profile: [{ r: 0.24, y: -0.62 }, { r: 0.26, y: -0.3 }, { r: 0.26, y: 0.1 }, { r: 0.2, y: 0.38 }, { r: 0.1, y: 0.58 }, { r: 0, y: 0.68 }],
        segments: 8, region: (band) => (band >= 4 ? "nose" : "body"), capBottomRegion: "body",
        transform: { t: [0, -0.12, 0] },
      }),
      discAt("window", "Jendela", "window", 240, 188, 23, 0.28),
    ],
    merges: { nose: "body", window: "body", fins: "body" },
  }),
  finish({ id: "la-cupcake", name: "Cupcake Ceri", collection: "magical-garden", blurb: "Cupcake berkrim lembut dengan ceri di puncaknya.", band: "1-2th", who: "cupcakemu" },
    foodArt({ kind: "cupcake", merges: { sprinkles: "frosting", cherry: "frosting" } })),
  finish({ id: "la-eskrim-dua", name: "Es Krim Dua Rasa", collection: "magical-garden", blurb: "Dua scoop es krim bertumpuk dengan ceri di atasnya.", band: "1-2th", who: "es krimmu" },
    foodArt({ kind: "icecream", scoops: 2, merges: { cherry: "scoop2" } })),
  finish({ id: "la-roti-selai", name: "Roti & Selai", collection: "magical-garden", blurb: "Sepotong roti panggang dengan selai dan mentega.", band: "1-2th", who: "rotimu" }, {
    regions: [
      { id: "plate", label: "Piring", els: [E(240, 288, 116, 14)] },
      { id: "bread", label: "Roti", els: [Pa("M168 272 L168 168 C168 128 196 104 240 104 C284 104 312 128 312 168 L312 272 Z")] },
      { id: "jam", label: "Selai", els: [Pa("M186 160 C186 132 208 122 240 122 C272 122 294 132 294 160 L294 200 L186 200 Z")] },
      { id: "butter", label: "Mentega", els: [Rc(222, 148, 36, 22, 5)] },
    ],
    details: [...eyesAt(240, 226, 22, 7), smileAt(240, 246, 22), ...cheeksAt(240, 248, 44, 9)],
    parts: [
      discAt("plate", "Piring", "plate", 240, 288, 110, -0.1),
      boxAt("bread", "Roti", "bread", 0.88, 1.0, 0.4, 240, 188),
      discAt("jam", "Selai", "jam", 240, 160, 52, 0.24),
      boxAt("butter", "Mentega", "butter", 0.22, 0.13, 0.2, 240, 159),
    ],
    merges: { butter: "jam", jam: "bread" },
  }),
  finish({ id: "la-kaktus", name: "Kaktus Berbunga", collection: "magical-garden", blurb: "Kaktus ramah berbunga kecil yang tidak menusuk.", band: "1-2th", who: "kaktusmu" },
    plantArt({ kind: "cactus", pot: true, merges: { flower: "body", arms: "body" } })),
  finish({ id: "la-rumah-kecil", name: "Rumah Kecil", collection: "little-homes", blurb: "Rumah kecil beratap besar, tempat pulang yang nyaman.", band: "1-2th", who: "rumahmu" },
    houseArt({ kind: "house", merges: { windows: "walls", door: "walls" } })),
  finish({ id: "la-ayam-telur", name: "Ayam Menetas", collection: "animal-friends", blurb: "Anak ayam yang baru menetas dari cangkang telurnya.", band: "1-2th", who: "anak ayammu" }, {
    regions: [
      { id: "body", label: "Anak Ayam", els: [Pa("M176 226 C176 168 204 128 240 128 C276 128 304 168 304 226 C272 244 208 244 176 226 Z")] },
      { id: "hat", label: "Cangkang di Kepala", els: [Pa("M206 138 C212 112 268 112 274 138 C252 128 228 128 206 138 Z")] },
      { id: "shell", label: "Cangkang Telur", els: [Pa("M164 230 L196 252 L224 232 L252 254 L282 234 L316 230 C310 268 278 288 240 288 C202 288 170 268 164 230 Z")] },
      { id: "nest", label: "Sarang", els: [Pa("M132 292 C136 268 180 258 240 258 C300 258 344 268 348 292 C300 304 180 304 132 292 Z")] },
    ],
    details: [
      ...eyesAt(240, 182, 22, 7.5),
      { el: Pa("M228 200 L252 200 L240 214 Z"), fill: "#F4842B", stroke: INK, sw: 3 },
      ...cheeksAt(240, 206, 44, 9),
    ],
    parts: [
      ballPart({ id: "body", label: "Anak Ayam", assembly: "Buat bola badan anak ayam dan letakkan di dalam cangkang.", r: 0.44, region: "body", transform: { s: [1, 0.9, 0.85], t: [0, -0.32, 0] } }),
      prismAt("hat", "Cangkang di Kepala", "hat", [[-0.22, -0.06], [0, 0.1], [0.22, -0.06], [0.1, -0.12], [-0.1, -0.12]], 240, 126, 0.3),
      boxPart({ id: "shell", label: "Cangkang Telur", assembly: "Lipat cangkang telur menjadi mangkuk bergerigi.", w: 0.92, h: 0.3, d: 0.66, regions: { front: "shell", back: "shell", left: "shell", right: "shell", top: "shell", bottom: "shell" }, transform: { t: [0, -0.72, 0.05] } }),
      discAt("nest", "Sarang", "nest", 240, 284, 105, -0.05),
    ],
    merges: { hat: "body", nest: "shell" },
  }),
  finish({ id: "la-ubur-ubur", name: "Ubur-ubur", collection: "animal-friends", blurb: "Ubur-ubur berpayung bundar yang melayang di laut.", band: "1-2th", who: "ubur-uburmu" }, {
    regions: [
      { id: "dome", label: "Payung", els: [Pa("M156 176 C156 108 192 66 240 66 C288 66 324 108 324 176 C288 160 192 160 156 176 Z")] },
      { id: "spots", label: "Bintik", els: [Ci(206, 112, 10), Ci(262, 100, 8), Ci(282, 134, 9)] },
      { id: "tentacles", label: "Tentakel", els: [Pa("M188 172 C180 210 192 240 184 272"), Pa("M240 178 C232 214 244 244 236 276"), Pa("M292 172 C284 210 296 240 288 272")] },
      { id: "bubbles", label: "Gelembung", els: [Ci(356, 108, 11), Ci(374, 140, 8), Ci(348, 152, 6)] },
    ],
    details: [...eyesAt(240, 128, 22, 7), smileAt(240, 146, 20), ...cheeksAt(240, 148, 44, 9)],
    parts: [
      ballPart({ id: "dome", label: "Payung", assembly: "Buat setengah bola payung ubur-ubur.", r: 0.52, region: "dome", transform: { s: [1, 0.85, 0.9], t: [0, 0.05, 0] } }),
      ballAt("spot-1", "Bintik", "spots", 206, 112, 10, 0.4),
      ballAt("spot-2", "Bintik", "spots", 262, 100, 8, 0.42),
      prismAt("tent-1", "Tentakel", "tentacles", [[-0.05, 0.3], [0.05, 0.3], [0.05, -0.3], [-0.05, -0.3]], 186, 222, 0),
      prismAt("tent-2", "Tentakel", "tentacles", [[-0.05, 0.3], [0.05, 0.3], [0.05, -0.3], [-0.05, -0.3]], 238, 226, 0),
      prismAt("tent-3", "Tentakel", "tentacles", [[-0.05, 0.3], [0.05, 0.3], [0.05, -0.3], [-0.05, -0.3]], 290, 222, 0),
      ballAt("bub-1", "Gelembung", "bubbles", 356, 108, 10, 0),
      ballAt("bub-2", "Gelembung", "bubbles", 374, 140, 8, 0),
    ],
    merges: { spots: "dome", bubbles: "dome" },
  }),
  finish({ id: "la-kepiting", name: "Kepiting Kecil", collection: "animal-friends", blurb: "Kepiting kecil bercapit besar yang berjalan menyamping.", band: "1-2th", who: "kepitingmu" }, {
    regions: [
      { id: "legs", label: "Kaki", els: [Pa("M168 246 C146 254 132 268 128 284"), Pa("M182 258 C164 268 154 280 152 292"), Pa("M312 246 C334 254 348 268 352 284"), Pa("M298 258 C316 268 326 280 328 292")] },
      { id: "body", label: "Badan", els: [E(240, 218, 84, 52)] },
      { id: "claws", label: "Capit", els: [Pa("M128 168 C108 150 108 118 130 106 C152 94 176 108 178 132 C178 154 156 172 136 174 Z"), Pa("M352 168 C372 150 372 118 350 106 C328 94 304 108 302 132 C302 154 324 172 344 174 Z")] },
      { id: "eyes", label: "Mata", els: [Ci(216, 158, 13), Ci(264, 158, 13)] },
    ],
    details: [
      { el: Pa("M216 172 L216 186 M264 172 L264 186"), stroke: INK, sw: 5 },
      { el: Ci(216, 156, 6), fill: INK }, { el: Ci(264, 156, 6), fill: INK },
      smileAt(240, 218, 30), ...cheeksAt(240, 226, 52, 10),
      { el: Pa("M138 128 L166 148 M342 128 L314 148"), stroke: INK, sw: 5 },
      groundAt(302, 130),
    ],
    parts: [
      prismAt("legs", "Kaki", "legs", [[-0.65, -0.2], [-0.2, 0.05], [0.2, 0.05], [0.65, -0.2], [0.7, -0.35], [-0.7, -0.35]], 240, 272, -0.05),
      ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan kepiting yang pipih dan lebar.", r: 0.5, region: "body", transform: { s: [1.25, 0.75, 0.9], t: [0, -0.42, 0] } }),
      ballAt("claw-l", "Capit", "claws", 142, 138, 30, 0),
      ballAt("claw-r", "Capit", "claws", 338, 138, 30, 0),
      ballAt("eye-l", "Mata", "eyes", 216, 158, 12, 0.3),
      ballAt("eye-r", "Mata", "eyes", 264, 158, 12, 0.3),
    ],
    merges: { legs: "body", eyes: "body" },
  }),
  finish({ id: "la-bintang-pantai", name: "Bintang Laut di Pantai", collection: "animal-friends", blurb: "Bintang laut yang berjemur di pasir bersama kerang kecil.", band: "1-2th", who: "bintang lautmu" }, {
    regions: [
      { id: "sand", label: "Pasir", els: [Pa("M60 306 C70 262 140 244 240 244 C340 244 410 262 420 306 Z")] },
      { id: "star", label: "Bintang Laut", els: [Pa(starPath(216, 218, 74, 34))] },
      { id: "spots", label: "Bintik", els: [Ci(216, 172, 7), Ci(176, 226, 7), Ci(258, 226, 7), Ci(198, 256, 7), Ci(236, 258, 7)] },
      { id: "shell", label: "Kerang", els: [Pa("M330 268 C318 244 330 224 352 222 C374 224 386 244 374 268 C360 258 344 258 330 268 Z")] },
    ],
    details: [...eyesAt(216, 208, 13, 6), smileAt(216, 224, 18), { el: Pa("M352 226 L352 264"), stroke: INK, sw: 3.5 }],
    parts: [
      discAt("sand", "Pasir", "sand", 240, 282, 150, -0.1),
      prismAt("star", "Bintang Laut", "star", [[0, -0.5], [0.12, -0.16], [0.48, -0.14], [0.2, 0.07], [0.3, 0.42], [0, 0.22], [-0.3, 0.42], [-0.2, 0.07], [-0.48, -0.14], [-0.12, -0.16]], 216, 218, 0.05),
      ballAt("spot-1", "Bintik", "spots", 216, 172, 7, 0.14),
      ballAt("spot-2", "Bintik", "spots", 176, 226, 7, 0.14),
      prismAt("shell", "Kerang", "shell", [[-0.16, -0.14], [0, 0.16], [0.16, -0.14], [0.08, -0.2], [-0.08, -0.2]], 352, 246, 0.05),
    ],
    merges: { spots: "star", shell: "sand" },
  }),
  finish({ id: "la-lebah", name: "Lebah Madu", collection: "animal-friends", blurb: "Lebah madu bergaris yang berdengung dari bunga ke bunga.", band: "1-2th", who: "lebahmu" }, {
    regions: [
      { id: "wings", label: "Sayap", els: [E(206, 118, 26, 40), E(274, 118, 26, 40)] },
      { id: "body", label: "Badan", els: [E(240, 208, 78, 66)] },
      { id: "stripes", label: "Garis", els: [Pa("M202 156 C214 150 266 150 278 156 L282 196 C268 202 212 202 198 196 Z"), Pa("M196 232 C212 240 268 240 284 232 L278 262 C258 272 222 272 202 262 Z")] },
      { id: "head", label: "Kepala", els: [Ci(240, 116, 34)] },
    ],
    details: [
      ...eyesAt(240, 110, 13, 6.5), smileAt(240, 128, 16), ...cheeksAt(240, 130, 26, 8),
      { el: Pa("M226 84 C220 70 210 62 200 60"), stroke: INK, sw: 4 },
      { el: Pa("M254 84 C260 70 270 62 280 60"), stroke: INK, sw: 4 },
      { el: Ci(198, 59, 5), fill: INK }, { el: Ci(282, 59, 5), fill: INK },
      { el: Pa("M316 208 L338 218 L316 228 Z"), fill: INK },
      groundAt(300, 110),
    ],
    parts: [
      prismAt("wing-l", "Sayap", "wings", [[-0.14, 0.22], [0.14, 0.22], [0.1, -0.22], [-0.1, -0.22]], 206, 118, -0.05),
      prismAt("wing-r", "Sayap", "wings", [[-0.14, 0.22], [0.14, 0.22], [0.1, -0.22], [-0.1, -0.22]], 274, 118, -0.05),
      ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan lebah yang gemuk.", r: 0.5, region: "body", transform: { s: [1.05, 0.9, 0.9], t: [0, -0.48, 0] } }),
      prismAt("stripes", "Garis", "stripes", [[-0.42, 0.42], [0.42, 0.42], [0.38, -0.42], [-0.38, -0.42]], 240, 208, 0.46),
      ballAt("head", "Kepala", "head", 240, 116, 33, 0.1),
    ],
    merges: { stripes: "body", wings: "body" },
  }),
  finish({ id: "la-capung", name: "Capung", collection: "magical-garden", blurb: "Capung bersayap lebar yang melayang di atas kolam.", band: "1-2th", who: "capungmu" }, {
    regions: [
      { id: "wings", label: "Sayap", els: [E(168, 138, 52, 20), E(312, 138, 52, 20), E(176, 178, 44, 17), E(304, 178, 44, 17)] },
      { id: "tail", label: "Ekor", els: [Pa("M228 208 L252 208 L248 292 C244 302 236 302 232 292 Z")] },
      { id: "body", label: "Badan", els: [E(240, 176, 26, 40)] },
      { id: "head", label: "Kepala", els: [Ci(240, 118, 30)] },
    ],
    details: [
      { el: Ci(228, 114, 10), fill: INK }, { el: Ci(252, 114, 10), fill: INK },
      { el: Ci(231, 111, 3.5), fill: "#FFFFFF" }, { el: Ci(255, 111, 3.5), fill: "#FFFFFF" },
      smileAt(240, 132, 14),
      { el: Pa("M232 236 L248 236 M231 262 L249 262"), stroke: INK, sw: 3.5 },
      groundAt(306, 110),
    ],
    parts: [
      prismAt("wing-l", "Sayap", "wings", [[-0.5, 0.14], [-0.05, 0.2], [0, -0.14], [-0.45, -0.2]], 178, 156, -0.03),
      prismAt("wing-r", "Sayap", "wings", [[0.5, 0.14], [0.05, 0.2], [0, -0.14], [0.45, -0.2]], 302, 156, -0.03),
      cylPart({ id: "tail", label: "Ekor", assembly: "Gulung ekor capung menjadi tabung ramping ke bawah.", r: 0.07, h: 0.55, region: "tail", transform: { t: [0, -0.68, 0] } }),
      ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan capung yang lonjong.", r: 0.22, region: "body", transform: { s: [0.8, 1.25, 0.8], t: [0, -0.32, 0] } }),
      ballAt("head", "Kepala", "head", 240, 118, 29, 0.05),
    ],
    merges: { wings: "body", tail: "body" },
  }),
  finish({ id: "la-ulat", name: "Ulat di Daun", collection: "magical-garden", blurb: "Ulat hijau yang mengunyah daun dengan gembira.", band: "1-2th", who: "ulatmu" }, {
    regions: [
      { id: "leaf", label: "Daun", els: [Pa("M84 268 C96 196 168 148 252 150 C330 152 388 200 396 262 C320 292 160 292 84 268 Z")] },
      { id: "segments", label: "Badan", els: [Ci(160, 218, 34), Ci(216, 202, 38), Ci(276, 200, 36)] },
      { id: "head", label: "Kepala", els: [Ci(330, 206, 32)] },
      { id: "spots", label: "Bintik", els: [Ci(160, 210, 8), Ci(222, 192, 9), Ci(272, 196, 8)] },
    ],
    details: [
      ...eyesAt(336, 198, 11, 6.5), smileAt(336, 216, 14), ...cheeksAt(336, 218, 22, 7),
      { el: Pa("M322 176 C316 160 306 150 294 146"), stroke: INK, sw: 4 },
      { el: Pa("M342 174 C344 158 352 146 362 140"), stroke: INK, sw: 4 },
      { el: Ci(292, 145, 5), fill: INK }, { el: Ci(364, 139, 5), fill: INK },
      { el: Pa("M120 250 C180 232 300 232 372 252"), stroke: INK, sw: 3.5 },
    ],
    parts: [
      discAt("leaf", "Daun", "leaf", 240, 224, 140, -0.08),
      ballAt("seg-1", "Badan", "segments", 160, 218, 33, 0.05),
      ballAt("seg-2", "Badan", "segments", 216, 202, 37, 0.05),
      ballAt("seg-3", "Badan", "segments", 276, 200, 35, 0.05),
      ballAt("head", "Kepala", "head", 330, 206, 31, 0.08),
      ballAt("spot-1", "Bintik", "spots", 222, 192, 9, 0.3),
    ],
    merges: { spots: "segments", segments: "head" },
  }),
  finish({ id: "la-perahu-nelayan", name: "Perahu Nelayan", collection: "little-vehicles", blurb: "Perahu nelayan kecil yang pulang membawa ikan segar.", band: "1-2th", who: "perahumu" },
    boatArt({ sailKind: "cabin", waves: true, merges: { windows: "cabin", funnel: "cabin", waves: "hull" } })),
  finish({ id: "la-tenda", name: "Tenda Kemah", collection: "magical-garden", blurb: "Tenda kemah mungil untuk bermalam di bawah langit terbuka.", band: "1-2th", who: "tendamu" }, {
    regions: [
      { id: "tent", label: "Tenda", els: [Pa("M96 272 L240 96 L384 272 Z")] },
      { id: "door", label: "Pintu Tenda", els: [Pa("M240 168 L282 272 L198 272 Z")] },
      { id: "flag", label: "Bendera", els: [Pa("M240 96 L240 66 L272 76 L240 88 Z")] },
      { id: "ground", label: "Tanah", els: [Pa("M48 306 C60 280 140 268 240 268 C340 268 420 280 432 306 Z")] },
    ],
    details: [
      { el: Pa("M240 168 L240 272"), stroke: INK, sw: 4 },
      { el: Pa("M120 250 L360 250"), stroke: "#FFFFFF", sw: 5 },
    ],
    parts: [
      prismAt("tent", "Tenda", "tent", [[-0.85, -0.55], [0, 0.55], [0.85, -0.55]], 240, 184, 0),
      prismAt("door", "Pintu Tenda", "door", [[-0.25, -0.3], [0, 0.32], [0.25, -0.3]], 240, 220, 0.08),
      prismAt("flag", "Bendera", "flag", [[0, 0.1], [0.2, 0.02], [0, -0.06]], 254, 76, 0.05),
      discAt("ground", "Tanah", "ground", 240, 290, 150, -0.12),
    ],
    merges: { door: "tent", flag: "tent" },
  }),
];

/* ================================================================== */
/* PEMBANGUN KELUARGA — dinosaurus profil ("dino")                      */
/* ================================================================== */

interface DinoOpts {
  kind: "trike" | "stego" | "bronto" | "ptero" | "raptor";
  merges?: Record<string, string>;
}

function dinoArt(o: DinoOpts): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [groundAt(292, 165)];
  const bodyParts = () => {
    parts.push(eggBodyPart({
      id: "body", label: "Badan",
      assembly: "Rekatkan strip badan satu sambungan setiap kalinya. Tambalan perut menghadap ke depan.",
      body: "body", belly: "belly",
      transform: { s: [1.28, 0.98, 0.86], t: [-0.10, -0.30, 0] },
    }));
    parts.push(cylPart({ id: "foot-1", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah badan.", r: 0.17, h: 0.22, region: "feet", transform: { t: [-0.42, -0.92, 0.16] } }));
    parts.push(cylPart({ id: "foot-2", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah badan.", r: 0.17, h: 0.22, region: "feet", transform: { t: [0.30, -0.92, 0.16] } }));
  };
  const tailPart = () => lathePart({
    id: "tail", label: "Ekor",
    assembly: "Buat ekor menjadi tabung melengkung yang meruncing dan rekatkan di belakang badan.",
    profile: [
      { r: 0.25, y: 0, cx: 0 }, { r: 0.235, y: 0.18, cx: 0.01 }, { r: 0.195, y: 0.38, cx: 0.04 },
      { r: 0.135, y: 0.56, cx: 0.09 }, { r: 0.07, y: 0.72, cx: 0.15 }, { r: 0, y: 0.82, cx: 0.20 },
    ],
    segments: 6, region: "tail",
    transform: { r: [0, 0, 1.65], t: [-0.66, -0.44, 0] },
  });
  const bellyRegion: RegionDef = { id: "belly", label: "Perut", els: [
    Pa("M208 146 C242 146 264 176 262 212 C260 242 238 260 212 258 C187 256 172 232 176 200 C180 170 191 146 208 146 Z"),
  ] };
  const feetRegion: RegionDef = { id: "feet", label: "Kaki", els: [E(168, 272, 28, 13), E(268, 272, 28, 13)] };
  const bodyRegion: RegionDef = { id: "body", label: "Badan", els: [
    Pa("M120 130 C122 84 170 52 228 54 C288 56 326 94 330 148 C334 202 312 246 268 260 L170 260 C140 246 118 192 120 130 Z"),
  ] };
  const tailRegion: RegionDef = { id: "tail", label: "Ekor", els: [
    Pa("M120 232 C72 226 44 200 50 172 C55 150 78 142 100 152 L128 190 C138 210 134 226 120 232 Z"),
  ] };

  if (o.kind === "ptero") {
    regions.push({ id: "wings", label: "Sayap", els: [
      Pa("M196 148 C140 96 84 76 40 84 C76 118 84 152 76 190 C112 164 148 160 182 176 C176 164 186 154 196 148 Z"),
      Pa("M250 140 C300 92 356 70 404 76 C372 112 366 148 376 184 C340 156 300 152 264 164 C262 154 256 146 250 140 Z"),
    ] });
    parts.push(
      prismPart({ id: "wing-l", label: "Sayap", assembly: "Lipat dua sayap lebar dan rekatkan di punggung.", poly: [[-0.55, 0.3], [0.1, 0.05], [0.45, -0.35], [-0.2, -0.3]], depth: 0.08, region: "wings", transform: { t: [-0.45, 0.05, -0.15], r: [0, 0, 0.4] } }),
      prismPart({ id: "wing-r", label: "Sayap", assembly: "Lipat dua sayap lebar dan rekatkan di punggung.", poly: [[0.55, 0.3], [-0.1, 0.05], [-0.45, -0.35], [0.2, -0.3]], depth: 0.08, region: "wings", transform: { t: [0.45, 0.05, -0.15], r: [0, 0, -0.4] } }),
    );
    regions.push({ id: "body", label: "Badan", els: [Pa("M196 148 C200 118 222 100 246 102 C270 104 286 124 286 152 C286 196 268 240 244 258 L196 252 C182 224 190 178 196 148 Z")] });
    parts.push(eggBodyPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan menjadi bentuk telur ramping.", body: "body", transform: { s: [0.95, 1.0, 0.8], t: [0, -0.32, 0] } }));
    regions.push({ id: "crest", label: "Jambul", els: [Pa("M268 92 C282 66 306 52 330 54 C316 74 296 88 274 96 Z")] });
    parts.push(prismPart({ id: "crest", label: "Jambul", assembly: "Lipat jambul panjang dan rekatkan di belakang kepala.", poly: [[-0.05, 0.05], [0.35, 0.22], [0.05, -0.12]], depth: 0.07, region: "crest", transform: { t: [0.42, 0.32, 0] } }));
    regions.push({ id: "head", label: "Kepala", els: [Ci(262, 116, 34)] });
    parts.push(ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di atas badan.", r: 0.24, region: "head", transform: { t: [0.18, 0.18, 0] } }));
    regions.push({ id: "beak", label: "Paruh", els: [Pa("M292 108 L348 122 L292 134 C286 126 286 116 292 108 Z")] });
    parts.push(conePart({ id: "beak", label: "Paruh", assembly: "Gulung paruh menjadi kerucut dan rekatkan di depan kepala.", r: 0.09, h: 0.4, region: "beak", transform: { r: [0, 0, -Math.PI / 2], t: [0.55, 0.12, 0] } }));
    regions.push({ id: "feet", label: "Kaki", els: [E(216, 266, 20, 10), E(262, 266, 20, 10)] });
    parts.push(cylPart({ id: "foot-1", label: "Kaki", assembly: "Buat dua kaki kecil dan rekatkan di bawah badan.", r: 0.12, h: 0.18, region: "feet", transform: { t: [-0.2, -0.92, 0.12] } }));
    parts.push(cylPart({ id: "foot-2", label: "Kaki", assembly: "Buat dua kaki kecil dan rekatkan di bawah badan.", r: 0.12, h: 0.18, region: "feet", transform: { t: [0.15, -0.92, 0.12] } }));
    details.push(...eyesAt(268, 108, 0, 7), ...cheeksAt(246, 128, 0, 9));
    return { regions, details, parts, merges: o.merges };
  }

  regions.push(tailRegion);
  parts.push(tailPart());
  regions.push(bodyRegion);
  if (o.kind === "trike") {
    regions.push(feetRegion);
    regions.push({ id: "frill", label: "Perisai Leher", els: [Ci(352, 118, 66)] });
    parts.push(cylPart({ id: "frill", label: "Perisai Leher", assembly: "Gulung perisai leher menjadi cakram lebar di belakang kepala.", r: 0.44, h: 0.1, region: "frill", transform: { r: [Math.PI / 2, 0, 0], t: [0.68, 0.05, -0.08] } }));
    regions.push({ id: "head", label: "Kepala", els: [Ci(356, 128, 44)] });
    parts.push(ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di depan perisai.", r: 0.3, region: "head", transform: { t: [0.72, -0.02, 0.05] } }));
    regions.push({ id: "horns", label: "Tanduk", els: [
      Pa("M330 92 L340 58 L352 90 Z"), Pa("M368 88 L382 56 L390 92 Z"), Pa("M352 128 L364 106 L372 130 Z"),
    ] });
    parts.push(
      conePart({ id: "horn-1", label: "Tanduk", assembly: "Gulung tiga tanduk kecil dan rekatkan di kepala.", r: 0.06, h: 0.22, region: "horns", transform: { t: [0.6, 0.3, 0.1] } }),
      conePart({ id: "horn-2", label: "Tanduk", assembly: "Gulung tiga tanduk kecil dan rekatkan di kepala.", r: 0.06, h: 0.22, region: "horns", transform: { t: [0.85, 0.32, 0.1] } }),
      conePart({ id: "horn-3", label: "Tanduk", assembly: "Gulung tiga tanduk kecil dan rekatkan di kepala.", r: 0.05, h: 0.16, region: "horns", transform: { t: [0.74, 0.12, 0.32] } }),
    );
    regions.push(bellyRegion);
    bodyParts();
    details.push(...eyesAt(362, 118, 0, 8), { el: Ci(392, 140, 4.2), fill: INK }, { el: Pa("M380 158 C388 164 398 164 404 158"), stroke: INK, sw: 3.5 }, ...cheeksAt(336, 142, 0, 10));
  } else if (o.kind === "stego") {
    regions.push(feetRegion);
    regions.push({ id: "plates", label: "Lempeng Punggung", els: [
      Pa("M158 96 L182 58 L206 92 Z"), Pa("M212 74 L240 34 L264 72 Z"), Pa("M268 76 L294 44 L314 84 Z"),
      Pa("M186 108 L206 82 L224 106 Z"), Pa("M244 92 L264 66 L280 94 Z"),
    ] });
    parts.push(
      prismPart({ id: "plate-1", label: "Lempeng", assembly: "Lipat lempeng-lempeng punggung dan rekatkan berjajar di punggung.", poly: [[-0.11, 0], [0.11, 0], [0, 0.26]], depth: 0.09, region: "plates", transform: { t: [-0.35, 0.22, 0] } }),
      prismPart({ id: "plate-2", label: "Lempeng", assembly: "Lipat lempeng-lempeng punggung dan rekatkan berjajar di punggung.", poly: [[-0.11, 0], [0.11, 0], [0, 0.3]], depth: 0.09, region: "plates", transform: { t: [0.02, 0.3, 0] } }),
      prismPart({ id: "plate-3", label: "Lempeng", assembly: "Lipat lempeng-lempeng punggung dan rekatkan berjajar di punggung.", poly: [[-0.11, 0], [0.11, 0], [0, 0.26]], depth: 0.09, region: "plates", transform: { t: [0.35, 0.24, 0] } }),
    );
    regions.push({ id: "head", label: "Kepala", els: [Ci(356, 168, 36)] });
    parts.push(ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala kecil dan rekatkan rendah di depan badan.", r: 0.25, region: "head", transform: { t: [0.7, -0.35, 0] } }));
    regions.push(bellyRegion);
    bodyParts();
    details.push(...eyesAt(362, 160, 0, 7), { el: Ci(384, 178, 3.8), fill: INK }, { el: Pa("M374 192 C381 197 389 197 394 192"), stroke: INK, sw: 3.5 }, ...cheeksAt(338, 182, 0, 9));
  } else if (o.kind === "bronto") {
    regions.push(feetRegion);
    regions.push({ id: "neck", label: "Leher", els: [
      Pa("M306 120 C330 74 356 40 388 26 L410 44 C392 72 380 108 376 146 C354 156 322 146 306 120 Z"),
    ] });
    parts.push(cylPart({ id: "neck", label: "Leher", assembly: "Gulung leher panjang menjadi tabung miring ke atas.", r: 0.17, h: 0.95, region: "neck", transform: { r: [0, 0, -0.55], t: [0.68, 0.22, 0] } }));
    regions.push({ id: "head", label: "Kepala", els: [Ci(404, 44, 27)] });
    parts.push(ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala kecil dan rekatkan di puncak leher.", r: 0.18, region: "head", transform: { t: [0.98, 0.62, 0] } }));
    regions.push(bellyRegion);
    bodyParts();
    details.push(...eyesAt(408, 38, 0, 6), { el: Ci(424, 52, 3.4), fill: INK }, { el: Pa("M416 62 C421 66 428 66 432 62"), stroke: INK, sw: 3 }, ...cheeksAt(390, 56, 0, 8));
  } else {
    // raptor
    regions.push(feetRegion);
    regions.push({ id: "head", label: "Kepala", els: [Ci(352, 104, 50)] });
    parts.push(ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di depan atas badan.", r: 0.34, region: "head", transform: { t: [0.66, 0.2, 0] } }));
    regions.push({ id: "stripe", label: "Garis Punggung", els: [
      Pa("M150 108 C200 84 268 82 318 100 L314 118 C264 102 202 102 156 122 Z"),
    ] });
    parts.push(flatPart({ id: "stripe", label: "Garis Punggung", assembly: "Tempelkan garis warna memanjang di punggung.", poly: rectPolyLocal(1.05, 0.14), region: "stripe", transform: { t: [-0.05, 0.18, 0.42], r: [0, 0, 0.06] } }));
    regions.push(bellyRegion);
    bodyParts();
    details.push(...eyesAt(360, 92, 0, 8.5), { el: Ci(394, 116, 4.2), fill: INK }, { el: Pa("M382 136 C390 143 401 143 407 136"), stroke: INK, sw: 3.5 }, ...cheeksAt(330, 124, 0, 10),
      { el: Pa("M318 196 C330 204 342 204 350 196"), stroke: INK, sw: 4 });
  }
  return { regions, details, parts, fallbacks: { belly: "body" }, merges: o.merges };
}

/* ================================================================== */
/* LEVEL 3 — LITTLE ARTISTS (2–3 tahun) · 6–8 bidang                    */
/* ================================================================== */

const stripeEls = (xs: number[]): SvgEl[] => xs.map((x) => Pa(`M${x} 108 C${x - 4} 140 ${x - 4} 190 ${x + 2} 232 L${x + 20} 232 C${x + 14} 188 ${x + 14} 142 ${x + 18} 110 Z`));
const spotEls = (list: [number, number, number][]): SvgEl[] => list.map(([cx, cy, r]) => Ci(cx, cy, r));

const L3: TemplateDef[] = [
  finish({ id: "dn-triceratops", name: "Triceratops", collection: "dino-world", blurb: "Triceratops bertanduk tiga dengan perisai leher besar.", band: "2-3th", who: "triceratopsmu" },
    dinoArt({ kind: "trike", merges: { horns: "head", belly: "body" } })),
  finish({ id: "dn-stegosaurus", name: "Stegosaurus", collection: "dino-world", blurb: "Stegosaurus berlempeng punggung yang tersusun rapi.", band: "2-3th", who: "stegosaurusmu" },
    dinoArt({ kind: "stego", merges: { plates: "body", belly: "body" } })),
  finish({ id: "dn-brontosaurus", name: "Brontosaurus", collection: "dino-world", blurb: "Brontosaurus berleher panjang yang makan daun tinggi.", band: "2-3th", who: "brontosaurusmu" },
    dinoArt({ kind: "bronto", merges: { belly: "body" } })),
  finish({ id: "dn-pterodaktil", name: "Pterodaktil", collection: "dino-world", blurb: "Pterodaktil bersayap lebar yang melayang di langit purba.", band: "2-3th", who: "pterodaktilmu" },
    dinoArt({ kind: "ptero", merges: { crest: "head", beak: "head" } })),
  finish({ id: "dn-raptor", name: "Raptor Kecil", collection: "dino-world", blurb: "Raptor kecil yang lincah dengan garis punggung khas.", band: "2-3th", who: "raptormu" },
    dinoArt({ kind: "raptor", merges: { stripe: "body", belly: "body" } })),

  finish({ id: "he-zebra", name: "Zebra", collection: "animal-friends", blurb: "Zebra bergaris-garis yang siap berlari di padang rumput.", band: "2-3th", who: "zebramu" },
    quadArt({ pattern: { id: "stripes", label: "Garis", els: stripeEls([168, 216, 264]) }, tailKind: "tuft", earKind: "round", merges: { stripes: "body", ears: "head" }, extraDetails: [
      { el: Pa("M336 96 C340 78 352 66 366 64 L372 92 C360 88 346 90 336 96 Z"), fill: INK },
    ] })),
  finish({ id: "he-jerapah", name: "Jerapah", collection: "animal-friends", blurb: "Jerapah berleher panjang yang menggapai daun tertinggi.", band: "2-3th", who: "jerapahmu" },
    quadArt({ neck: true, pattern: { id: "spots", label: "Bintik", els: spotEls([[196, 150, 15], [258, 128, 12], [282, 186, 14], [214, 208, 11]]) }, tailKind: "tuft", earKind: "round", merges: { spots: "body", ears: "head" }, extraDetails: [
      { el: Pa("M392 44 C390 32 394 22 402 18 M410 46 C410 34 416 26 424 24"), stroke: INK, sw: 5 },
      { el: Ci(402, 16, 6), fill: INK }, { el: Ci(426, 22, 6), fill: INK },
    ] })),
  finish({ id: "he-kuda", name: "Kuda Poni", collection: "animal-friends", blurb: "Kuda poni berpelana yang siap diajak berjalan santai.", band: "2-3th", who: "kudamu" },
    quadArt({ saddle: true, tailKind: "long", earKind: "pointy", merges: { saddle: "body", ears: "head" }, extraDetails: [
      { el: Pa("M322 108 C312 84 318 62 336 52 C332 76 336 94 346 108 Z"), fill: INK },
    ] })),
  finish({ id: "he-sapi", name: "Sapi Perah", collection: "animal-friends", blurb: "Sapi perah bercorak totol dengan moncong lebar.", band: "2-3th", who: "sapimu" },
    quadArt({ pattern: { id: "spots", label: "Corak", els: spotEls([[186, 142, 19], [262, 176, 22], [226, 214, 14]]) }, tailKind: "tuft", earKind: "round", merges: { spots: "body", ears: "head" }, accessory: { id: "muzzle", label: "Moncong", els: [E(382, 158, 24, 17)], part: discAt("muzzle", "Moncong", "muzzle", 382, 158, 22, 0.3) }, extraDetails: [
      { el: Ci(374, 156, 3.6), fill: INK }, { el: Ci(390, 156, 3.6), fill: INK },
    ] })),
  finish({ id: "he-kambing", name: "Kambing Kecil", collection: "animal-friends", blurb: "Kambing kecil bertanduk lengkung yang suka memanjat.", band: "2-3th", who: "kambingmu" },
    quadArt({ tailKind: "stub", earKind: "long", merges: { ears: "head" }, accessory: { id: "horns", label: "Tanduk", els: [Pa("M330 96 C318 76 322 56 340 48"), Pa("M366 92 C362 72 370 54 386 50")], part: prismAt("horns", "Tanduk", "horns", [[-0.2, 0.14], [0, -0.16], [0.2, 0.14], [0, 0.02]], 356, 76, 0) }, extraDetails: [
      { el: Pa("M348 178 L366 178 L357 196 Z"), fill: "#FFFFFF", stroke: INK, sw: 3 },
    ] })),
  finish({ id: "he-rusa", name: "Rusa Muda", collection: "animal-friends", blurb: "Rusa muda bertanduk cabang dengan bintik-bintik putih.", band: "2-3th", who: "rusamu" },
    quadArt({ pattern: { id: "spots", label: "Bintik", els: spotEls([[200, 148, 9], [248, 128, 8], [282, 168, 9], [224, 196, 8]]) }, tailKind: "stub", earKind: "round", merges: { spots: "body", ears: "head" }, accessory: { id: "antlers", label: "Tanduk Cabang", els: [Pa("M334 100 C322 74 324 52 338 38 M332 78 C320 70 316 58 318 46 M340 66 C338 52 342 40 350 32"), Pa("M372 96 C378 70 392 54 408 48 M378 74 C388 64 390 52 388 40")], part: prismAt("antlers", "Tanduk Cabang", "antlers", [[-0.24, -0.2], [-0.05, 0.2], [0.1, -0.05], [0.24, 0.18], [0.26, -0.22], [0, -0.05], [-0.22, -0.24]], 356, 74, -0.05) } })),
  finish({ id: "he-harimau", name: "Harimau Kecil", collection: "animal-friends", blurb: "Harimau kecil bergaris yang berani mengaum pelan.", band: "2-3th", who: "harimaumu" },
    quadArt({ pattern: { id: "stripes", label: "Garis", els: stripeEls([172, 220, 268]) }, tailKind: "long", earKind: "round", merges: { stripes: "body", ears: "head" } })),
  finish({ id: "he-rubah", name: "Rubah Hutan", collection: "animal-friends", blurb: "Rubah hutan berekor lebat dengan dada berbulu putih.", band: "2-3th", who: "rubahmu" },
    quadArt({ tailKind: "tuft", earKind: "pointy", merges: { ears: "head" }, accessory: { id: "chest", label: "Dada", els: [Pa("M318 168 C330 190 330 220 318 244 C306 224 304 192 318 168 Z")], part: discAt("chest", "Dada", "chest", 316, 206, 20, 0.45) } })),
  finish({ id: "he-kucing-topi", name: "Kucing Bertopi", collection: "animal-friends", blurb: "Kucing bundar bergaya dengan topi tinggi favoritnya.", band: "2-3th", who: "kucingmu" },
    buddyArt({ earKind: "pointy", belly: true, muzzle: true, nose: "round", tailSide: true, accessory: { id: "hat", label: "Topi", els: [Rc(206, 62, 68, 44, 6), Rc(188, 100, 104, 12, 6)], part: boxAt("hat", "Topi", "hat", 0.42, 0.3, 0.42, 240, 84) } })),
  finish({ id: "he-monyet-pisang", name: "Monyet & Pisang", collection: "animal-friends", blurb: "Monyet kecil yang baru menemukan pisang emasnya.", band: "2-3th", who: "monyetmu" },
    buddyArt({ earKind: "round", belly: true, muzzle: true, nose: "round", tailSide: true, accessory: { id: "banana", label: "Pisang", els: [Pa("M330 218 C344 248 374 264 402 262 C388 278 350 282 326 262 C314 250 318 230 330 218 Z")], part: prismAt("banana", "Pisang", "banana", [[-0.3, 0.15], [0.15, 0.3], [0.4, 0.1], [0.05, -0.15], [-0.25, -0.05]], 362, 248, 0.15) } })),
  finish({ id: "he-koala-pohon", name: "Koala di Pohon", collection: "animal-friends", blurb: "Koala yang memeluk batang pohon sambil mengantuk.", band: "2-3th", who: "koalamu" }, {
    regions: [
      { id: "leaves", label: "Daun", els: [Ci(120, 84, 40), Ci(360, 84, 40), Ci(240, 58, 46)] },
      { id: "trunk", label: "Batang Pohon", els: [Rc(224, 108, 32, 184, 12)] },
      { id: "body", label: "Badan", els: [E(240, 218, 62, 52)] },
      { id: "head", label: "Kepala", els: [Ci(240, 142, 46)] },
      { id: "ears", label: "Telinga", els: [Ci(192, 128, 21), Ci(288, 128, 21)] },
      { id: "belly", label: "Perut", els: [E(240, 232, 34, 28)] },
    ],
    details: [
      ...eyesAt(240, 136, 19, 7.5),
      { el: E(240, 152, 10, 14), fill: "#3B3230" },
      smileAt(240, 172, 16), ...cheeksAt(240, 160, 36, 9),
      { el: Pa("M186 208 C172 222 172 242 184 254 M294 208 C308 222 308 242 296 254"), stroke: INK, sw: 5 },
      groundAt(300, 130),
    ],
    parts: [
      ballPart({ id: "leaves", label: "Daun", assembly: "Buat gumpalan daun di puncak pohon.", r: 0.4, region: "leaves", transform: { s: [1.6, 0.7, 0.9], t: [0, 0.55, -0.15] } }),
      cylPart({ id: "trunk", label: "Batang Pohon", assembly: "Gulung batang pohon menjadi tabung tinggi.", r: 0.11, h: 1.15, region: "trunk", transform: { t: [0, -0.35, -0.1] } }),
      ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan koala yang memeluk batang.", r: 0.42, region: "body", transform: { s: [1, 0.85, 0.85], t: [0, -0.45, 0.12] } }),
      ballAt("head", "Kepala", "head", 240, 142, 45, 0.15),
      ballAt("ear-l", "Telinga", "ears", 192, 128, 20, 0.1),
      ballAt("ear-r", "Telinga", "ears", 288, 128, 20, 0.1),
      discAt("belly", "Perut", "belly", 240, 232, 32, 0.55),
    ],
    merges: { belly: "body", ears: "head", leaves: "trunk" },
  }),

  finish({ id: "la-paus", name: "Paus Biru", collection: "animal-friends", blurb: "Paus besar yang menyemburkan air sambil berenang santai.", band: "2-3th", who: "pausmu" },
    fishArt({ kind: "whale", bubbles: true, merges: { fin: "body", belly: "body", spout: "body" } })),
  finish({ id: "la-gurita", name: "Gurita Bertopi", collection: "animal-friends", blurb: "Gurita ceria bertopi pesta dengan delapan tentakel.", band: "2-3th", who: "guritamu" }, {
    regions: [
      { id: "bubbles", label: "Gelembung", els: [Ci(368, 92, 11), Ci(388, 122, 8)] },
      { id: "head", label: "Kepala", els: [Pa("M156 178 C156 104 192 60 240 60 C288 60 324 104 324 178 C324 200 306 212 288 204 L192 204 C174 212 156 200 156 178 Z")] },
      { id: "spots", label: "Bintik", els: [Ci(198, 104, 9), Ci(276, 96, 8), Ci(292, 136, 7)] },
      { id: "hat", label: "Topi Pesta", els: [Pa("M216 62 L240 14 L264 62 Z")] },
      { id: "tentacles", label: "Tentakel", els: [Pa("M168 202 C160 236 168 262 186 276 C192 258 196 240 194 220 L214 226 C212 248 218 268 230 280 C240 264 240 240 234 222 L252 222 C246 242 248 264 258 278 C270 262 274 244 270 224 L288 218 C286 240 292 260 304 272 C318 256 320 228 310 204 C268 216 212 216 168 202 Z")] },
      { id: "suckers", label: "Pengisap", els: [Ci(196, 248, 6), Ci(238, 252, 6), Ci(282, 246, 6)] },
    ],
    details: [...eyesAt(240, 138, 26, 8.5), smileAt(240, 162, 26), ...cheeksAt(240, 164, 54, 11), { el: Ci(240, 12, 7), fill: INK }],
    parts: [
      ballAt("bub-1", "Gelembung", "bubbles", 368, 92, 10, 0),
      ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala gurita yang besar dan bundar.", r: 0.55, region: "head", transform: { s: [1, 0.95, 0.9], t: [0, 0.08, 0] } }),
      ballAt("spot-1", "Bintik", "spots", 198, 104, 9, 0.45),
      ballAt("spot-2", "Bintik", "spots", 276, 96, 8, 0.46),
      conePart({ id: "hat", label: "Topi Pesta", assembly: "Gulung topi pesta menjadi kerucut dan letakkan di puncak kepala.", r: 0.16, h: 0.32, region: "hat", transform: { t: [0, 0.62, 0] } }),
      prismAt("tentacles", "Tentakel", "tentacles", [[-0.5, 0.12], [-0.2, -0.2], [0, 0.14], [0.2, -0.2], [0.5, 0.12], [0.45, -0.12], [-0.45, -0.12]], 240, 240, 0),
      discAt("suck-1", "Pengisap", "suckers", 196, 248, 6, 0.14),
      discAt("suck-2", "Pengisap", "suckers", 238, 252, 6, 0.14),
      discAt("suck-3", "Pengisap", "suckers", 282, 246, 6, 0.14),
    ],
    merges: { spots: "head", suckers: "tentacles", bubbles: "head" },
  }),
  finish({ id: "la-hiu", name: "Hiu Ramah", collection: "animal-friends", blurb: "Hiu ramah bersirip tegak yang tersenyum lebar.", band: "2-3th", who: "hiumu" },
    fishArt({ kind: "shark", pattern: { id: "gills", label: "Insang", els: [Pa("M316 156 C308 172 308 190 316 206"), Pa("M332 152 C324 170 324 192 332 210")] }, merges: { fin: "body", belly: "body", dorsal: "body" } })),
  finish({ id: "la-kuda-laut", name: "Kuda Laut", collection: "animal-friends", blurb: "Kuda laut bermahkota kecil yang melayang di antara karang.", band: "2-3th", who: "kuda lautmu" }, {
    regions: [
      { id: "crown", label: "Mahkota", els: [Pa("M196 66 L188 40 L204 52 L216 34 L226 54 L240 42 L238 68 Z")] },
      { id: "snout", label: "Moncong", els: [Pa("M238 92 L286 100 L284 118 L240 116 Z")] },
      { id: "body", label: "Badan", els: [Pa("M196 66 C168 84 156 118 164 152 C172 186 196 204 226 206 C204 222 192 244 200 264 L246 264 C232 240 238 222 254 210 C276 196 282 164 268 132 C256 102 228 62 196 66 Z")] },
      { id: "belly", label: "Perut", els: [Pa("M196 128 C210 118 234 122 244 140 C254 158 248 182 230 192 C212 182 198 156 196 128 Z")] },
      { id: "fin", label: "Sirip", els: [Pa("M164 148 C138 138 118 144 108 162 C126 176 150 178 166 168 Z")] },
      { id: "tail", label: "Ekor Melingkar", els: [Pa("M200 264 C186 282 190 302 210 306 C230 310 246 296 240 280 C236 268 222 266 214 274 L246 264 Z")] },
    ],
    details: [...eyesAt(222, 92, 0, 8), ...cheeksAt(214, 112, 0, 9), groundAt(312, 110)],
    parts: [
      prismAt("crown", "Mahkota", "crown", [[-0.18, -0.08], [-0.1, 0.1], [0, -0.14], [0.1, 0.1], [0.18, -0.08], [0.14, -0.16], [-0.14, -0.16]], 214, 52, 0.05),
      prismAt("snout", "Moncong", "snout", [[-0.14, 0.07], [0.18, 0.1], [0.18, -0.05], [-0.14, -0.09]], 260, 106, 0.1),
      ballPart({ id: "body", label: "Badan", assembly: "Buat badan kuda laut yang melengkung seperti tanda tanya.", r: 0.45, region: "body", transform: { s: [0.85, 1.15, 0.75], t: [-0.12, -0.25, 0] } }),
      discAt("belly", "Perut", "belly", 222, 156, 26, 0.35),
      prismAt("fin", "Sirip", "fin", [[-0.2, 0.1], [0.05, 0.18], [0.18, -0.05], [-0.05, -0.16]], 138, 156, -0.05),
      prismAt("tail", "Ekor Melingkar", "tail", [[-0.16, 0.05], [0.05, 0.16], [0.18, -0.02], [0.02, -0.14], [-0.12, -0.08]], 218, 284, 0),
    ],
    merges: { crown: "body", belly: "body", fin: "body" },
  }),
  finish({ id: "la-lumba", name: "Lumba-lumba", collection: "animal-friends", blurb: "Lumba-lumba lincah yang melompat di atas ombak kecil.", band: "2-3th", who: "lumba-lumbamu" },
    fishArt({ kind: "dolphin", bubbles: true, merges: { fin: "body", belly: "body", dorsal: "body" } })),

  finish({ id: "ke-truk-besar", name: "Truk Pengangkut", collection: "little-vehicles", blurb: "Truk pengangkut bergaris cerah dengan lampu bundar.", band: "2-3th", who: "trukmu" },
    vehicleArt({ kind: "truck", stripe: true, extra: { id: "lights", label: "Lampu", els: [Ci(404, 204, 10)], part: discAt("lights", "Lampu", "lights", 404, 204, 10, 0.32) }, merges: { window: "cabin", stripe: "cargo" } })),
  finish({ id: "ke-ekskavator", name: "Ekskavator", collection: "little-vehicles", blurb: "Ekskavator berlengan panjang yang siap menggali tanah.", band: "2-3th", who: "ekskavatormu" }, {
    regions: [
      { id: "tracks", label: "Rantai Roda", els: [Rc(108, 244, 190, 44, 22)] },
      { id: "body", label: "Badan", els: [Rc(120, 176, 150, 68, 10)] },
      { id: "cabin", label: "Kabin", els: [Rc(140, 108, 84, 72, 10)] },
      { id: "window", label: "Jendela", els: [Rc(154, 120, 56, 44, 8)] },
      { id: "arm", label: "Lengan", els: [Pa("M262 128 L348 84 L366 104 L292 156 L314 208 L292 220 L262 168 Z")] },
      { id: "bucket", label: "Keruk", els: [Pa("M292 220 L340 208 L352 248 C330 262 302 256 292 220 Z")] },
    ],
    details: [
      { el: Ci(150, 266, 11), fill: "#FFFFFF", stroke: INK, sw: 3.5 },
      { el: Ci(196, 266, 11), fill: "#FFFFFF", stroke: INK, sw: 3.5 },
      { el: Ci(242, 266, 11), fill: "#FFFFFF", stroke: INK, sw: 3.5 },
      groundAt(302, 150),
    ],
    parts: [
      boxAt("tracks", "Rantai Roda", "tracks", 1.15, 0.27, 0.55, 203, 266),
      boxAt("body", "Badan", "body", 0.9, 0.4, 0.55, 195, 210),
      boxAt("cabin", "Kabin", "cabin", 0.5, 0.42, 0.52, 182, 144),
      discAt("window", "Jendela", "window", 182, 142, 26, 0.29),
      prismAt("arm", "Lengan", "arm", [[-0.5, -0.35], [0.25, 0.3], [0.45, 0.1], [-0.05, -0.2], [0.1, -0.5], [-0.15, -0.55]], 312, 150, 0),
      prismAt("bucket", "Keruk", "bucket", [[-0.18, 0.15], [0.2, 0.2], [0.24, -0.15], [-0.05, -0.2]], 322, 232, 0.05),
    ],
    merges: { window: "cabin", bucket: "arm" },
  }),
  finish({ id: "ke-helikopter", name: "Helikopter", collection: "little-vehicles", blurb: "Helikopter berbaling-baling panjang yang siap terbang.", band: "2-3th", who: "helikoptermu" }, {
    regions: [
      { id: "rotor", label: "Baling-baling", els: [Rc(120, 62, 240, 13, 6)] },
      { id: "body", label: "Badan", els: [E(226, 176, 92, 72)] },
      { id: "window", label: "Jendela", els: [Pa("M252 118 C282 124 300 146 302 176 C302 204 284 226 258 232 C240 210 238 150 252 118 Z")] },
      { id: "tail", label: "Ekor", els: [Pa("M140 160 L64 138 C52 136 44 144 46 156 L50 176 C52 186 60 190 70 188 L142 196 Z")] },
      { id: "stripe", label: "Garis", els: [Pa("M140 200 C180 214 280 214 312 198 L310 216 C272 230 182 230 144 218 Z")] },
      { id: "skid", label: "Kaki Pendarat", els: [Pa("M168 262 L292 262 L292 274 L168 274 Z"), Rc(190, 244, 9, 22, 4), Rc(262, 244, 9, 22, 4)] },
    ],
    details: [{ el: Ci(240, 82, 7), fill: INK }, { el: Pa("M56 128 L56 196 M44 140 L68 140 M44 184 L68 184"), stroke: INK, sw: 5 }, groundAt(300, 130)],
    parts: [
      boxAt("rotor", "Baling-baling", "rotor", 1.45, 0.07, 0.14, 240, 68),
      ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan helikopter yang gemuk.", r: 0.55, region: "body", transform: { s: [1.1, 0.9, 0.9], t: [-0.1, -0.35, 0] } }),
      discAt("window", "Jendela", "window", 276, 176, 34, 0.45),
      prismAt("tail", "Ekor", "tail", [[-0.55, 0.12], [0.45, 0.2], [0.5, -0.05], [-0.5, -0.18]], 94, 168, -0.05),
      prismAt("stripe", "Garis", "stripe", [[-0.5, 0.05], [0.5, 0.05], [0.45, -0.1], [-0.45, -0.1]], 226, 208, 0.48),
      boxAt("skid", "Kaki Pendarat", "skid", 0.75, 0.08, 0.3, 230, 266),
    ],
    merges: { stripe: "body", window: "body", skid: "body" },
  }),
  finish({ id: "ke-kereta-panjang", name: "Kereta Api", collection: "little-vehicles", blurb: "Kereta api bergaris cerah dengan kabin masinis yang tinggi.", band: "2-3th", who: "keretamu" },
    vehicleArt({ kind: "train", stripe: true, merges: { smoke: "body", window: "cabin", stripe: "body" } })),
  finish({ id: "ke-mobil-balap", name: "Mobil Balap", collection: "little-vehicles", blurb: "Mobil balap bersayap belakang yang siap melesat. Vroom!", band: "2-3th", who: "mobil balapmu" },
    vehicleArt({ kind: "car", stripe: true, light: true, extra: { id: "spoiler", label: "Sayap Belakang", els: [Rc(72, 128, 52, 14, 6), Rc(82, 140, 8, 26, 3), Rc(106, 140, 8, 26, 3)], part: boxAt("spoiler", "Sayap Belakang", "spoiler", 0.32, 0.09, 0.4, 98, 134) }, merges: { stripe: "body", lights: "body", windows: "body" } })),
  finish({ id: "ke-bus-sekolah", name: "Bus Sekolah", collection: "little-vehicles", blurb: "Bus sekolah ramah dengan pintu dan lampu bundar.", band: "2-3th", who: "bus sekolahmu" },
    vehicleArt({ kind: "bus", stripe: true, light: true, extra: { id: "door", label: "Pintu", els: [Rc(330, 168, 34, 76, 6)], part: discAt("door", "Pintu", "door", 347, 206, 20, 0.36) }, merges: { stripe: "body", lights: "body", windows: "body" } })),
  finish({ id: "ke-kapal-besar", name: "Kapal Pesiar Kecil", collection: "little-vehicles", blurb: "Kapal pesiar kecil bercerobong yang berlayar santai.", band: "2-3th", who: "kapalmu" }, {
    regions: [
      { id: "deck", label: "Dek", els: [Rc(140, 168, 200, 22, 8)] },
      { id: "cabin", label: "Kabin", els: [Rc(168, 118, 130, 52, 8)] },
      { id: "windows", label: "Jendela", els: [Ci(192, 142, 9), Ci(222, 142, 9), Ci(252, 142, 9), Ci(282, 142, 9)] },
      { id: "funnel", label: "Cerobong", els: [Rc(306, 92, 28, 52, 6)] },
      { id: "hull", label: "Lambung", els: [Pa("M108 192 L372 192 L344 248 C340 258 330 264 318 264 L162 264 C150 264 140 258 136 248 Z")] },
      { id: "waves", label: "Ombak", els: [Pa("M60 282 C90 266 120 282 150 282 C180 282 210 266 240 282 C270 282 300 266 330 282 C360 282 390 266 420 282 L420 296 L60 296 Z")] },
    ],
    details: [{ el: Pa("M312 84 C310 70 318 60 330 58"), stroke: INK, sw: 4 }],
    parts: [
      boxAt("deck", "Dek", "deck", 1.2, 0.13, 0.55, 240, 179),
      boxAt("cabin", "Kabin", "cabin", 0.78, 0.31, 0.5, 233, 144),
      discAt("windows", "Jendela", "windows", 237, 142, 52, 0.28),
      cylPart({ id: "funnel", label: "Cerobong", assembly: "Gulung cerobong asap dan rekatkan di belakang kabin.", r: 0.09, h: 0.32, region: "funnel", transform: { t: [0.48, -0.05, 0] } }),
      boxPart({ id: "hull", label: "Lambung", assembly: "Lipat lambung kapal menjadi kotak memanjang.", w: 1.6, h: 0.42, d: 0.6, regions: { front: "hull", back: "hull", left: "hull", right: "hull", top: "hull", bottom: "hull" }, transform: { t: [0, -0.62, 0] }, splitWalls: true }),
      discAt("waves", "Ombak", "waves", 240, 282, 150, 0.3),
    ],
    merges: { windows: "cabin", deck: "hull", waves: "hull" },
  }),

  finish({ id: "an-ufo", name: "UFO & Alien", collection: "space-explorers", blurb: "UFO bercahaya dengan alien kecil yang melambaikan tangan.", band: "2-3th", who: "UFO-mu" }, {
    regions: [
      { id: "dome", label: "Kubah Kaca", els: [Pa("M176 148 C176 100 204 68 240 68 C276 68 304 100 304 148 C264 132 216 132 176 148 Z")] },
      { id: "alien", label: "Alien", els: [Ci(240, 116, 26)] },
      { id: "disc", label: "Piring Terbang", els: [E(240, 168, 130, 34)] },
      { id: "lights", label: "Lampu", els: [Ci(168, 172, 10), Ci(240, 186, 10), Ci(312, 172, 10)] },
      { id: "beam", label: "Berkas Cahaya", els: [Pa("M204 202 L276 202 L306 282 L174 282 Z")] },
      { id: "ground", label: "Bukit", els: [Pa("M84 306 C96 278 160 264 240 264 C320 264 384 278 396 306 Z")] },
    ],
    details: [
      ...eyesAt(240, 110, 10, 7), smileAt(240, 128, 14),
      { el: Pa("M222 92 C216 78 206 70 196 68 M258 92 C264 78 274 70 284 68"), stroke: INK, sw: 4 },
      { el: Ci(194, 67, 5), fill: INK }, { el: Ci(286, 67, 5), fill: INK },
    ],
    parts: [
      ballPart({ id: "dome", label: "Kubah Kaca", assembly: "Buat setengah bola kubah kaca di atas piring terbang.", r: 0.42, region: "dome", transform: { s: [1, 0.8, 0.9], t: [0, 0.05, 0] } }),
      ballAt("alien", "Alien", "alien", 240, 116, 25, 0.1),
      ballPart({ id: "disc", label: "Piring Terbang", assembly: "Buat cakram piring terbang yang lebar dan pipih.", r: 0.55, region: "disc", transform: { s: [1.5, 0.4, 1], t: [0, -0.28, 0] } }),
      ballAt("light-1", "Lampu", "lights", 168, 172, 10, 0.5),
      ballAt("light-2", "Lampu", "lights", 240, 186, 10, 0.55),
      ballAt("light-3", "Lampu", "lights", 312, 172, 10, 0.5),
      prismAt("beam", "Berkas Cahaya", "beam", [[-0.2, 0.25], [0.2, 0.25], [0.42, -0.25], [-0.42, -0.25]], 240, 242, 0),
      discAt("ground", "Bukit", "ground", 240, 288, 140, -0.15),
    ],
    merges: { alien: "dome", lights: "disc", beam: "disc" },
  }),
  finish({ id: "an-planet-alien", name: "Planet & Alien", collection: "space-explorers", blurb: "Alien kecil yang menanam bendera di planet pertamanya.", band: "2-3th", who: "planetmu" }, {
    regions: [
      { id: "planet", label: "Planet", els: [Pa("M84 252 C96 160 168 96 252 100 C330 104 388 162 392 238 C340 268 140 268 84 252 Z")] },
      { id: "craters", label: "Kawah", els: [Ci(150, 176, 16), Ci(196, 226, 11), Ci(320, 216, 9)] },
      { id: "alienBody", label: "Badan Alien", els: [E(262, 84, 24, 30)] },
      { id: "alienHead", label: "Kepala Alien", els: [Ci(262, 44, 21)] },
      { id: "antenna", label: "Antena", els: [Rc(259, 12, 6, 16, 3), Ci(262, 10, 7)] },
      { id: "flag", label: "Bendera", els: [Pa("M322 128 L322 84 L356 94 L322 106 Z"), Rc(318, 82, 6, 52, 3)] },
    ],
    details: [...eyesAt(262, 40, 8, 6), smileAt(262, 54, 10), { el: Ci(150, 176, 7), fill: "#FFFFFF", stroke: INK, sw: 2.5 }],
    parts: [
      ballPart({ id: "planet", label: "Planet", assembly: "Buat bola planet besar yang pipih sebagai panggung alien.", r: 0.85, region: "planet", transform: { s: [1.1, 0.62, 0.9], t: [0, -0.55, 0] } }),
      discAt("crater-1", "Kawah", "craters", 150, 176, 15, 0.5),
      discAt("crater-2", "Kawah", "craters", 196, 226, 11, 0.55),
      ballAt("alien-body", "Badan Alien", "alienBody", 262, 84, 26, 0.35),
      ballAt("alien-head", "Kepala Alien", "alienHead", 262, 44, 20, 0.35),
      prismAt("antenna", "Antena", "antenna", [[-0.03, 0.1], [0.03, 0.1], [0.03, -0.1], [-0.03, -0.1]], 262, 18, 0.35),
      prismAt("flag", "Bendera", "flag", [[0, 0.16], [0.2, 0.08], [0, 0]], 338, 104, 0.3),
    ],
    merges: { craters: "planet", antenna: "alienHead", alienBody: "alienHead" },
  }),
  finish({ id: "ta-jamur-besar", name: "Rumah Jamur Besar", collection: "magical-garden", blurb: "Rumah jamur besar bercerobong dengan jendela bundar.", band: "2-3th", who: "rumah jamurmu" }, {
    regions: [
      { id: "chimney", label: "Cerobong", els: [Rc(286, 62, 24, 40, 5)] },
      { id: "cap", label: "Topi Jamur", els: [Pa("M120 168 C128 96 182 52 240 52 C298 52 352 96 360 168 C306 150 174 150 120 168 Z")] },
      { id: "spots", label: "Bintik", els: [Ci(192, 104, 14), Ci(262, 88, 11), Ci(292, 124, 9)] },
      { id: "walls", label: "Dinding", els: [Pa("M184 292 C188 238 192 198 196 164 L284 164 C288 198 292 238 296 292 Z")] },
      { id: "door", label: "Pintu", els: [Pa("M222 292 L222 240 C222 226 258 226 258 240 L258 292 Z")] },
      { id: "window", label: "Jendela", els: [Ci(240, 196, 12)] },
    ],
    details: [{ el: Ci(250, 262, 3.5), fill: INK }, groundAt(302, 140)],
    parts: [
      boxAt("chimney", "Cerobong", "chimney", 0.15, 0.25, 0.15, 298, 82),
      conePart({ id: "cap", label: "Topi Jamur", assembly: "Gulung topi jamur menjadi kerucut lebar.", r: 0.75, h: 0.52, region: "cap", transform: { t: [0, 0.08, 0] } }),
      discAt("spot-1", "Bintik", "spots", 192, 104, 13, 0.35),
      discAt("spot-2", "Bintik", "spots", 262, 88, 10, 0.38),
      cylPart({ id: "walls", label: "Dinding", assembly: "Gulung dinding jamur menjadi tabung gemuk.", r: 0.32, h: 0.75, region: "walls", transform: { s: [1, 1, 0.82], t: [0, -0.6, 0] } }),
      discAt("door", "Pintu", "door", 240, 264, 18, 0.28),
      discAt("window", "Jendela", "window", 240, 196, 12, 0.3),
    ],
    merges: { spots: "cap", chimney: "cap", window: "walls" },
  }),
  finish({ id: "ta-kastil", name: "Kastil Kecil", collection: "little-homes", blurb: "Kastil kecil bermenara kembar dengan bendera berkibar.", band: "2-3th", who: "kastilmu" },
    houseArt({ kind: "castle", merges: { flags: "roofs", windows: "walls", door: "walls" } })),
  finish({ id: "ta-rumah-pohon", name: "Rumah Pohon", collection: "little-homes", blurb: "Rumah mungil di atas pohon dengan tangga tali.", band: "2-3th", who: "rumah pohonmu" }, {
    regions: [
      { id: "canopy", label: "Daun Pohon", els: [Ci(240, 92, 58), Ci(172, 118, 42), Ci(308, 118, 42)] },
      { id: "trunk", label: "Batang", els: [Pa("M222 292 C226 240 228 196 226 156 L254 156 C252 196 254 240 258 292 Z")] },
      { id: "house", label: "Rumah", els: [Rc(196, 128, 88, 62, 8)] },
      { id: "roof", label: "Atap", els: [Pa("M186 130 L240 88 L294 130 Z")] },
      { id: "door", label: "Pintu", els: [Rc(226, 152, 28, 38, 6)] },
      { id: "ladder", label: "Tangga", els: [Rc(282, 190, 7, 88, 3), Rc(306, 190, 7, 88, 3), Rc(282, 208, 31, 6, 3), Rc(282, 232, 31, 6, 3), Rc(282, 256, 31, 6, 3)] },
    ],
    details: [groundAt(300, 140), { el: Ci(240, 168, 3), fill: INK }],
    parts: [
      ballPart({ id: "canopy", label: "Daun Pohon", assembly: "Buat bola daun pohon besar di puncak batang.", r: 0.52, region: "canopy", transform: { s: [1.4, 0.9, 1], t: [0, 0.38, -0.12] } }),
      cylPart({ id: "trunk", label: "Batang", assembly: "Gulung batang pohon menjadi tabung kokoh.", r: 0.13, h: 0.85, region: "trunk", transform: { t: [0, -0.55, -0.05] } }),
      boxAt("house", "Rumah", "house", 0.54, 0.38, 0.44, 240, 159),
      prismAt("roof", "Atap", "roof", [[-0.34, -0.1], [0, 0.16], [0.34, -0.1], [0.24, -0.16], [-0.24, -0.16]], 240, 109, 0.05),
      discAt("door", "Pintu", "door", 240, 171, 15, 0.25),
      prismAt("ladder", "Tangga", "ladder", [[-0.1, 0.28], [0.1, 0.28], [0.1, -0.28], [-0.1, -0.28]], 297, 234, 0.1),
    ],
    merges: { door: "house", ladder: "trunk", roof: "house" },
  }),
  finish({ id: "ta-bunga-raksasa", name: "Bunga Raksasa & Lebah", collection: "magical-garden", blurb: "Bunga raksasa yang dikunjungi lebah madu kecil.", band: "2-3th", who: "bungamu" }, {
    regions: [
      { id: "petals", label: "Kelopak", els: petalEls(196, 118, 6, 40, 25, 25) },
      { id: "center", label: "Tengah Bunga", els: [Ci(196, 118, 24)] },
      { id: "stem", label: "Batang", els: [Pa("M190 176 C188 216 188 254 192 290 L208 290 C206 254 206 216 204 176 Z")] },
      { id: "leaves", label: "Daun", els: [Pa("M192 240 C160 236 142 220 140 196 C166 198 186 214 194 232 Z"), Pa("M206 258 C232 250 246 234 246 212 C222 218 208 236 204 252 Z")] },
      { id: "beeBody", label: "Badan Lebah", els: [E(330, 108, 34, 28)] },
      { id: "beeWings", label: "Sayap Lebah", els: [E(316, 76, 15, 22), E(344, 76, 15, 22)] },
    ],
    details: [
      ...eyesAt(196, 112, 10, 5), smileAt(196, 126, 13),
      { el: Ci(322, 104, 4.5), fill: INK }, { el: Ci(340, 104, 4.5), fill: INK },
      { el: Pa("M310 108 L310 118 M330 100 L330 124 M350 108 L350 118"), stroke: INK, sw: 4 },
      groundAt(300, 120),
    ],
    parts: [
      ballPart({ id: "petals", label: "Kelopak", assembly: "Buat bola kelopak pipih yang besar.", r: 0.4, region: "petals", transform: { s: [1.25, 1.25, 0.45], t: [-0.28, 0.32, 0] } }),
      discAt("center", "Tengah Bunga", "center", 196, 118, 23, 0.2),
      cylPart({ id: "stem", label: "Batang", assembly: "Gulung batang bunga menjadi tabung tinggi.", r: 0.06, h: 0.7, region: "stem", transform: { t: [-0.26, -0.6, 0] } }),
      prismAt("leaf-l", "Daun", "leaves", [[-0.18, -0.04], [0.04, 0.14], [0.18, -0.02], [0, -0.12]], 168, 218, 0),
      ballAt("bee-body", "Badan Lebah", "beeBody", 330, 108, 30, 0.1),
      prismAt("bee-wings", "Sayap Lebah", "beeWings", [[-0.2, 0.14], [0, -0.14], [0.2, 0.14], [0, 0.02]], 330, 76, 0),
    ],
    merges: { center: "petals", leaves: "stem", beeWings: "beeBody" },
  }),
  finish({ id: "ma-kue-ulang-tahun", name: "Kue Ulang Tahun", collection: "magical-garden", blurb: "Kue ulang tahun dua lapis dengan tiga lilin menyala.", band: "2-3th", who: "kuemu" },
    foodArt({ kind: "cake", merges: { candles: "layer2", cherry: "layer1", frosting: "layer2" } })),
  finish({ id: "ma-teko", name: "Teko & Cangkir", collection: "magical-garden", blurb: "Teko ramah yang menuang teh untuk cangkir kecilnya.", band: "2-3th", who: "tekomu" }, {
    regions: [
      { id: "lid", label: "Tutup Teko", els: [Pa("M206 108 C212 88 268 88 274 108 C252 118 228 118 206 108 Z")] },
      { id: "body", label: "Badan Teko", els: [Pa("M168 190 C168 138 202 112 240 112 C278 112 312 138 312 190 C312 240 278 268 240 268 C202 268 168 240 168 190 Z")] },
      { id: "spout", label: "Corong", els: [Pa("M172 168 C146 158 128 138 126 112 L152 108 C156 130 166 146 180 156 Z")] },
      { id: "handle", label: "Gagang", els: [Pa("M308 150 C336 142 356 160 354 186 C352 210 334 224 314 220 C326 208 328 188 320 172 C317 162 312 155 308 150 Z")] },
      { id: "cup", label: "Cangkir", els: [Pa("M196 282 L284 282 L276 312 L204 312 Z")] },
      { id: "saucer", label: "Tatakan", els: [E(240, 318, 62, 9)] },
    ],
    details: [
      ...eyesAt(240, 176, 24, 7.5), smileAt(240, 198, 24), ...cheeksAt(240, 200, 48, 10),
      { el: Ci(240, 92, 7), fill: INK },
      { el: Pa("M222 296 C232 290 248 290 258 296"), stroke: INK, sw: 3.5 },
    ],
    parts: [
      ballPart({ id: "lid", label: "Tutup Teko", assembly: "Buat tutup teko pipih dan letakkan di atas badan.", r: 0.24, region: "lid", transform: { s: [1.1, 0.5, 1], t: [0, 0.28, 0] } }),
      ballPart({ id: "body", label: "Badan Teko", assembly: "Buat bola badan teko yang gemuk.", r: 0.5, region: "body", transform: { s: [1.05, 0.95, 0.9], t: [0, -0.35, 0] } }),
      conePart({ id: "spout", label: "Corong", assembly: "Gulung corong menjadi kerucut miring di sisi teko.", r: 0.11, h: 0.42, region: "spout", transform: { r: [0, 0, 1.1], t: [-0.62, -0.1, 0] } }),
      prismAt("handle", "Gagang", "handle", [[-0.08, 0.24], [0.16, 0.1], [0.14, -0.2], [-0.06, -0.26]], 332, 182, 0),
      boxAt("cup", "Cangkir", "cup", 0.5, 0.18, 0.4, 240, 297),
      discAt("saucer", "Tatakan", "saucer", 240, 318, 55, -0.05),
    ],
    merges: { lid: "body", saucer: "cup" },
  }),
];

/* ================================================================== */
/* ADEGAN — pustaka elemen lingkungan + pahlawan mini untuk Level 4–5  */
/* ================================================================== */

interface ScenePiece {
  regions: RegionDef[];
  parts: CraftPart[];
  details?: DetailEl[];
}

const piece = (region: RegionDef, part: CraftPart, details?: DetailEl[]): ScenePiece => ({ regions: [region], parts: [part], details });

function elSun(id: string, cx: number, cy: number, r = 30): ScenePiece {
  return piece(
    { id, label: "Matahari", els: [Ci(cx, cy, r)] },
    ballPart({ id, label: "Matahari", assembly: "Buat bola matahari pipih dan rekatkan melayang di langit.", r: MS(r), region: id, transform: { s: [1, 1, 0.4], t: [MX(cx), MY(cy), -0.2] } }),
  );
}

function elCloud(id: string, cx: number, cy: number, s = 1): ScenePiece {
  const d = `M${cx - 52 * s} ${cy + 12 * s} C${cx - 58 * s} ${cy - 6 * s} ${cx - 44 * s} ${cy - 16 * s} ${cx - 30 * s} ${cy - 12 * s} C${cx - 22 * s} ${cy - 30 * s} ${cx + 8 * s} ${cy - 34 * s} ${cx + 22 * s} ${cy - 18 * s} C${cx + 40 * s} ${cy - 22 * s} ${cx + 54 * s} ${cy - 8 * s} ${cx + 50 * s} ${cy + 8 * s} C${cx + 40 * s} ${cy + 16 * s} ${cx - 40 * s} ${cy + 18 * s} ${cx - 52 * s} ${cy + 12 * s} Z`;
  return piece(
    { id, label: "Awan", els: [Pa(d)] },
    ballPart({ id, label: "Awan", assembly: "Buat gumpalan awan pipih dan rekatkan melayang.", r: MS(34 * s), region: id, transform: { s: [1.5, 0.55, 0.7], t: [MX(cx), MY(cy), -0.22] } }),
  );
}

function elTreeCanopy(id: string, cx: number, cy: number, r = 40): ScenePiece {
  return piece(
    { id, label: "Daun Pohon", els: [Ci(cx, cy, r), Ci(cx - r * 0.75, cy + r * 0.35, r * 0.62), Ci(cx + r * 0.75, cy + r * 0.35, r * 0.62)] },
    ballPart({ id, label: "Daun Pohon", assembly: "Buat bola daun pohon dan rekatkan di atas batangnya.", r: MS(r), region: id, transform: { s: [1.3, 0.9, 0.9], t: [MX(cx), MY(cy), -0.1] } }),
  );
}

function elTrunk(id: string, cx: number, topY: number, botY: number, w = 13): ScenePiece {
  return piece(
    { id, label: "Batang Pohon", els: [Pa(`M${cx - w} ${botY} C${cx - w + 2} ${botY - (botY - topY) / 2} ${cx - w + 3} ${topY + (botY - topY) / 3} ${cx - w + 2} ${topY} L${cx + w - 2} ${topY} C${cx + w - 3} ${topY + (botY - topY) / 3} ${cx + w - 2} ${botY - (botY - topY) / 2} ${cx + w} ${botY} Z`)] },
    cylPart({ id, label: "Batang Pohon", assembly: "Gulung batang pohon menjadi tabung.", r: MS(w), h: MS(botY - topY), region: id, transform: { t: [MX(cx), MY((topY + botY) / 2), -0.1] } }),
  );
}

function elPine(id: string, cx: number, baseY: number, s = 1): ScenePiece {
  const w = 34 * s, h = 96 * s, top = baseY - h;
  return piece(
    { id, label: "Pohon Pinus", els: [
      Pa(`M${cx} ${top} L${cx + w * 0.62} ${top + h * 0.42} L${cx + w * 0.3} ${top + h * 0.42} L${cx + w} ${baseY - 14 * s} L${cx - w} ${baseY - 14 * s} L${cx - w * 0.3} ${top + h * 0.42} L${cx - w * 0.62} ${top + h * 0.42} Z`),
      Rc(cx - 5 * s, baseY - 14 * s, 10 * s, 14 * s, 3),
    ] },
    prismPart({ id, label: "Pohon Pinus", assembly: "Lipat pohon pinus berlapis dan berdirikan di tanah.", poly: [[0, MS(h / 2)], [MS(w * 0.9), -MS(h / 2)], [-MS(w * 0.9), -MS(h / 2)]], depth: 0.1, region: id, transform: { t: [MX(cx), MY(top + h / 2), -0.12] } }),
  );
}

function elFlower(id: string, cx: number, cy: number, s = 1): ScenePiece {
  return piece(
    { id, label: "Bunga", els: [...petalEls(cx, cy, 5, 11 * s, 8 * s, 8 * s), Ci(cx, cy, 6 * s), Pa(`M${cx} ${cy + 10 * s} L${cx} ${cy + 30 * s}`)] },
    ballPart({ id, label: "Bunga", assembly: "Buat bunga kecil dan rekatkan di taman.", r: MS(13 * s), region: id, transform: { s: [1, 1.2, 0.5], t: [MX(cx), MY(cy + 8 * s), 0.25] } }),
  );
}

function elBush(id: string, cx: number, cy: number, s = 1): ScenePiece {
  return piece(
    { id, label: "Semak", els: [Pa(smooth([[cx - 42 * s, cy + 10 * s], [cx - 40 * s, cy - 14 * s], [cx - 14 * s, cy - 24 * s], [cx + 12 * s, cy - 26 * s], [cx + 38 * s, cy - 14 * s], [cx + 42 * s, cy + 10 * s], [cx, cy + 16 * s]]))] },
    ballPart({ id, label: "Semak", assembly: "Buat gumpalan semak pipih dan rekatkan di tanah.", r: MS(30 * s), region: id, transform: { s: [1.4, 0.7, 0.8], t: [MX(cx), MY(cy), 0.05] } }),
  );
}

function elFence(id: string, cx: number, cy: number, w = 150): ScenePiece {
  const els: SvgEl[] = [Rc(cx - w / 2, cy - 6, w, 9, 3), Rc(cx - w / 2, cy + 12, w, 9, 3)];
  for (let x = cx - w / 2 + 8; x < cx + w / 2 - 6; x += 30) els.push(Rc(x, cy - 20, 11, 52, 4));
  return piece(
    { id, label: "Pagar", els },
    prismPart({ id, label: "Pagar", assembly: "Lipat pagar kayu dan berdirikan di belakang taman.", poly: [[-MS(w / 2), -MS(20)], [MS(w / 2), -MS(20)], [MS(w / 2), MS(20)], [-MS(w / 2), MS(20)]], depth: 0.07, region: id, transform: { t: [MX(cx), MY(cy + 6), -0.18] } }),
  );
}

function elGroundBand(id: string, label: string, topY = 268): ScenePiece {
  return piece(
    { id, label, els: [Pa(`M40 ${topY + 38} L40 ${topY + 8} C110 ${topY - 8} 200 ${topY + 6} 260 ${topY} C330 ${topY - 6} 410 ${topY + 2} 440 ${topY + 10} L440 ${topY + 38} Z`)] },
    flatPart({ id, label, assembly: `Letakkan bidang ${label.toLowerCase()} sebagai alas adegan.`, poly: [[-1.25, -0.1], [1.25, -0.1], [1.25, 0.12], [-1.25, 0.12]], region: id, transform: { t: [0, -0.97, 0.18] } }),
  );
}

function elMountain(id: string, cx: number, baseY: number, w: number, h: number): ScenePiece {
  return piece(
    { id, label: "Gunung", els: [Pa(`M${cx - w / 2} ${baseY} L${cx} ${baseY - h} L${cx + w / 2} ${baseY} Z`)] },
    prismPart({ id, label: "Gunung", assembly: "Lipat gunung segitiga besar dan berdirikan di latar belakang.", poly: [[-MS(w / 2), -MS(h / 2)], [0, MS(h / 2)], [MS(w / 2), -MS(h / 2)]], depth: 0.3, region: id, transform: { t: [MX(cx), MY(baseY - h / 2), -0.3] } }),
  );
}

function elSnowcap(id: string, cx: number, topY: number, w: number): ScenePiece {
  return piece(
    { id, label: "Salju di Puncak", els: [Pa(`M${cx - w / 2} ${topY + w * 0.52} L${cx} ${topY} L${cx + w / 2} ${topY + w * 0.52} L${cx + w * 0.18} ${topY + w * 0.34} L${cx} ${topY + w * 0.5} L${cx - w * 0.18} ${topY + w * 0.34} Z`)] },
    prismPart({ id, label: "Salju di Puncak", assembly: "Tempelkan salju putih di puncak gunung.", poly: [[-MS(w / 2), -MS(w * 0.2)], [0, MS(w * 0.28)], [MS(w / 2), -MS(w * 0.2)], [0, -MS(w * 0.02)]], depth: 0.32, region: id, transform: { t: [MX(cx), MY(topY + w * 0.26), -0.29] } }),
  );
}

function elRainbow(id: string, cx: number, cy: number, r: number): ScenePiece {
  const band = (rr: number, wdt: number) => `M${cx - rr} ${cy} C${cx - rr} ${cy - rr * 1.05} ${cx + rr} ${cy - rr * 1.05} ${cx + rr} ${cy} L${cx + rr - wdt} ${cy} C${cx + rr - wdt} ${cy - (rr - wdt) * 1.05} ${cx - rr + wdt} ${cy - (rr - wdt) * 1.05} ${cx - rr + wdt} ${cy} Z`;
  return piece(
    { id, label: "Pelangi", els: [Pa(band(r, 13)), Pa(band(r - 15, 13)), Pa(band(r - 30, 13))] },
    prismPart({ id, label: "Pelangi", assembly: "Lipat pelangi melengkung dan berdirikan di latar belakang.", poly: [[-MS(r), -MS(r * 0.4)], [-MS(r * 0.7), MS(r * 0.35)], [MS(r * 0.7), MS(r * 0.35)], [MS(r), -MS(r * 0.4)], [MS(r * 0.75), -MS(r * 0.4)], [0, MS(r * 0.05)], [-MS(r * 0.75), -MS(r * 0.4)]], depth: 0.08, region: id, transform: { t: [MX(cx), MY(cy - r * 0.35), -0.28] } }),
  );
}

function elHouseMini(wallsId: string, roofId: string, cx: number, baseY: number, s = 1): ScenePiece {
  const w = 74 * s, h = 52 * s, top = baseY - h;
  return {
    regions: [
      { id: roofId, label: "Atap Rumah", els: [Pa(`M${cx - w / 2 - 8 * s} ${top} L${cx} ${top - 30 * s} L${cx + w / 2 + 8 * s} ${top} Z`)] },
      { id: wallsId, label: "Dinding Rumah", els: [Rc(cx - w / 2, top, w, h, 4)] },
    ],
    parts: [
      prismPart({ id: roofId, label: "Atap Rumah", assembly: "Lipat atap rumah kecil dan letakkan di atas dindingnya.", poly: [[-MS(w / 2 + 8 * s), -MS(14 * s)], [0, MS(16 * s)], [MS(w / 2 + 8 * s), -MS(14 * s)]], depth: MS(40 * s), region: roofId, transform: { t: [MX(cx), MY(top - 14 * s), -0.15] } }),
      boxPart({ id: wallsId, label: "Dinding Rumah", assembly: "Lipat dinding rumah kecil menjadi kotak.", w: MS(w), h: MS(h), d: MS(40 * s), regions: { front: wallsId, back: wallsId, left: wallsId, right: wallsId, top: wallsId, bottom: wallsId }, transform: { t: [MX(cx), MY(top + h / 2), -0.15] } }),
    ],
  };
}

function elPond(id: string, cx: number, cy: number, rx: number, label = "Kolam"): ScenePiece {
  return piece(
    { id, label, els: [E(cx, cy, rx, rx * 0.28)] },
    flatPart({ id, label, assembly: `Letakkan bidang ${label.toLowerCase()} sebagai alas air.`, poly: discPoly(MS(rx)), region: id, transform: { s: [1, 0.3, 1], t: [MX(cx), -0.96, 0.3] } }),
  );
}

/** Pahlawan mini: hewan profil samping di titik (cx, cy) skala s (tinggi badan ≈ 90s). */
function miniQuad(cx: number, cy: number, s: number, o: {
  ear?: "round" | "pointy" | "none";
  pattern?: { id: string; label: string };
  extra?: ScenePiece[];
  merges?: Record<string, string>;
}): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [];
  const bx = cx, by = cy;
  regions.push({ id: "tail", label: "Ekor", els: [Pa(smooth([[bx - 62 * s, by - 18 * s], [bx - 84 * s, by - 34 * s], [bx - 80 * s, by - 56 * s], [bx - 58 * s, by - 44 * s], [bx - 52 * s, by - 24 * s]]))] });
  parts.push(conePart({ id: "tail", label: "Ekor", assembly: "Gulung ekor menjadi kerucut dan rekatkan di belakang badan.", r: MS(10 * s), h: MS(44 * s), region: "tail", transform: { r: [0, 0, -1.9], t: [MX(bx) - MS(58 * s), MY(by) + MS(30 * s), -0.05] } }));
  regions.push({ id: "body", label: "Badan", els: [E(bx, by, 58 * s, 42 * s)] });
  parts.push(ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan dan letakkan di tengah adegan.", r: MS(46 * s), region: "body", transform: { s: [1.25, 0.9, 0.85], t: [MX(bx), MY(by), 0] } }));
  regions.push({ id: "legs", label: "Kaki", els: [E(bx - 34 * s, by + 44 * s, 15 * s, 8 * s), E(bx + 32 * s, by + 44 * s, 15 * s, 8 * s)] });
  parts.push(
    cylPart({ id: "leg-l", label: "Kaki", assembly: "Buat dua kaki pendek di bawah badan.", r: MS(13 * s), h: MS(16 * s), region: "legs", transform: { t: [MX(bx) - MS(34 * s), MY(by) - MS(44 * s), 0.08] } }),
    cylPart({ id: "leg-r", label: "Kaki", assembly: "Buat dua kaki pendek di bawah badan.", r: MS(13 * s), h: MS(16 * s), region: "legs", transform: { t: [MX(bx) + MS(32 * s), MY(by) - MS(44 * s), 0.08] } }),
  );
  if (o.pattern) {
    regions.push({ id: o.pattern.id, label: o.pattern.label, els: [Ci(bx - 18 * s, by - 12 * s, 10 * s), Ci(bx + 16 * s, by + 6 * s, 8 * s), Ci(bx + 2 * s, by - 24 * s, 7 * s)] });
    parts.push(discAt("mpat", o.pattern.label, o.pattern.id, bx - 18 * s, by - 12 * s, 10 * s, 0.42));
  }
  const hx = bx + 66 * s, hy = by - 26 * s, hr = 27 * s;
  if (o.ear !== "none") {
    regions.push({ id: "ears", label: "Telinga", els: o.ear === "pointy"
      ? [Pa(`M${hx - 16 * s} ${hy - hr + 8 * s} L${hx - 8 * s} ${hy - hr - 12 * s} L${hx + 4 * s} ${hy - hr + 6 * s} Z`)]
      : [Ci(hx - 14 * s, hy - hr + 4 * s, 10 * s)] });
    parts.push(ballAt("mear", "Telinga", "ears", hx - 14 * s, hy - hr + 4 * s, 10 * s, 0));
  }
  regions.push({ id: "head", label: "Kepala", els: [Ci(hx, hy, hr)] });
  parts.push(ballAt("mhead", "Kepala", "head", hx, hy, hr, 0));
  details.push(...eyesAt(hx + 6 * s, hy - 4 * s, 0, 5.5 * s), { el: Ci(hx + hr - 7 * s, hy + 7 * s, 3 * s), fill: INK }, ...cheeksAt(hx - 8 * s, hy + 9 * s, 0, 7 * s));
  if (o.extra) for (const p of o.extra) { regions.push(...p.regions); parts.push(...p.parts); if (p.details) details.push(...p.details); }
  return { regions, details, parts, merges: o.merges };
}

/** Pahlawan mini: hewan bundar tampak depan di titik (cx, cy) skala s. */
function miniBuddy(cx: number, cy: number, s: number, o: {
  ear?: "round" | "pointy" | "none";
  belly?: boolean;
  muzzle?: boolean;
  merges?: Record<string, string>;
}): BuiltArt {
  const regions: RegionDef[] = [];
  const parts: CraftPart[] = [];
  const details: DetailEl[] = [];
  if (o.ear !== "none") {
    regions.push({ id: "ears", label: "Telinga", els: o.ear === "pointy"
      ? [Pa(`M${cx - 40 * s} ${cy - 34 * s} L${cx - 30 * s} ${cy - 62 * s} L${cx - 12 * s} ${cy - 36 * s} Z`), Pa(`M${cx + 40 * s} ${cy - 34 * s} L${cx + 30 * s} ${cy - 62 * s} L${cx + 12 * s} ${cy - 36 * s} Z`)]
      : [Ci(cx - 36 * s, cy - 38 * s, 14 * s), Ci(cx + 36 * s, cy - 38 * s, 14 * s)] });
    parts.push(ballAt("mear-l", "Telinga", "ears", cx - 36 * s, cy - 38 * s, 14 * s, 0), ballAt("mear-r", "Telinga", "ears", cx + 36 * s, cy - 38 * s, 14 * s, 0));
  }
  regions.push({ id: "body", label: "Badan", els: [E(cx, cy, 46 * s, 42 * s)] });
  parts.push(ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan dan letakkan di tengah adegan.", r: MS(42 * s), region: "body", transform: { s: [1.1, 1, 0.85], t: [MX(cx), MY(cy), 0] } }));
  if (o.belly) {
    regions.push({ id: "belly", label: "Perut", els: [E(cx, cy + 16 * s, 24 * s, 19 * s)] });
    parts.push(discAt("mbelly", "Perut", "belly", cx, cy + 16 * s, 22 * s, 0.4));
  }
  if (o.muzzle) {
    regions.push({ id: "muzzle", label: "Moncong", els: [E(cx, cy + 12 * s, 20 * s, 13 * s)] });
    parts.push(discAt("mmuzzle", "Moncong", "muzzle", cx, cy + 12 * s, 18 * s, 0.42));
  }
  details.push(...eyesAt(cx, cy - 10 * s, 16 * s, 5.5 * s), smileAt(cx, cy + 4 * s, 15 * s), ...cheeksAt(cx, cy + 6 * s, 32 * s, 7 * s));
  return { regions, details, parts, merges: o.merges };
}

/** Pahlawan mini: ikan samping di titik (cx, cy) skala s. */
function miniFish(cx: number, cy: number, s: number, o: { merges?: Record<string, string> } = {}): BuiltArt {
  const regions: RegionDef[] = [
    { id: "tail", label: "Ekor", els: [Pa(smooth([[cx - 44 * s, cy - 4 * s], [cx - 68 * s, cy - 24 * s], [cx - 66 * s, cy], [cx - 68 * s, cy + 24 * s], [cx - 44 * s, cy + 4 * s]]))] },
    { id: "body", label: "Badan", els: [E(cx, cy, 48 * s, 30 * s)] },
    { id: "fin", label: "Sirip", els: [Pa(smooth([[cx - 4 * s, cy + 18 * s], [cx + 10 * s, cy + 34 * s], [cx + 24 * s, cy + 30 * s], [cx + 12 * s, cy + 14 * s]]))] },
  ];
  const parts: CraftPart[] = [
    prismAt("mtail", "Ekor", "tail", [[-0.14, 0.2], [0.1, 0], [-0.14, -0.2], [0.02, 0]], cx - 56 * s, cy, -0.03),
    ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan ikan yang pipih.", r: MS(34 * s), region: "body", transform: { s: [1.35, 0.85, 0.6], t: [MX(cx), MY(cy), 0] } }),
    prismAt("mfin", "Sirip", "fin", [[-0.08, 0.06], [0.1, 0.14], [0.14, -0.04], [-0.02, -0.08]], cx + 8 * s, cy + 24 * s, 0.15),
  ];
  const details: DetailEl[] = [...eyesAt(cx + 26 * s, cy - 6 * s, 0, 5.5 * s), ...cheeksAt(cx + 12 * s, cy + 6 * s, 0, 7 * s)];
  return { regions, details, parts, merges: o.merges };
}

/** Beri awalan pada semua id region sebuah karya mini (mis. "fish" →
 * fishBody, fishTail) supaya dua pahlawan mini bisa hidup dalam satu
 * adegan tanpa tabrakan id. Label dan geometri tidak berubah. */
function prefixArt(art: BuiltArt, pfx: string): BuiltArt {
  const map = (id: string) =>
    id === "__nameplate" || id === "plate" ? id : pfx + id.charAt(0).toUpperCase() + id.slice(1);
  const remap = (rec?: Record<string, string>) =>
    rec ? Object.fromEntries(Object.entries(rec).map(([k, v]) => [map(k), map(v)])) : undefined;
  return {
    regions: art.regions.map((r) => ({ ...r, id: map(r.id) })),
    details: art.details,
    parts: art.parts.map((p) => ({
      ...p,
      faces: p.faces.map((f) => ({ ...f, region: map(f.region) })),
      decals3d: p.decals3d?.map((d) => ({ ...d, region: d.region ? map(d.region) : d.region })),
    })),
    fallbacks: remap(art.fallbacks),
    merges: remap(art.merges),
  };
}

function mergePieces(...ps: ScenePiece[]): ScenePiece {
  return {
    regions: ps.flatMap((p) => p.regions),
    parts: ps.flatMap((p) => p.parts),
    details: ps.flatMap((p) => p.details ?? []),
  };
}

function scene(meta: Meta, env: ScenePiece, heroes: BuiltArt[], extraDetails: DetailEl[] = []): TemplateDef {
  const regions = [...env.regions, ...heroes.flatMap((h) => h.regions)];
  const parts = [...env.parts, ...heroes.flatMap((h) => h.parts)];
  const details = [...(env.details ?? []), ...heroes.flatMap((h) => h.details), ...extraDetails];
  const merges: Record<string, string> = {};
  for (const h of heroes) if (h.merges) Object.assign(merges, h.merges);
  return finish(meta, { regions, details, parts, merges: Object.keys(merges).length ? merges : undefined });
}

/* ================================================================== */
/* LEVEL 4 — CREATIVE EXPLORERS (3–4 tahun) · 9–13 bidang              */
/* ================================================================== */

const sp = (id: string, label: string, els: SvgEl[], part: CraftPart): ScenePiece => piece({ id, label, els }, part);

function trainPieces(x: number, y: number, wagon: boolean): ScenePiece {
  const pieces: ScenePiece[] = [
    sp("smoke", "Asap", [Ci(x - 52, y - 62, 15), Ci(x - 30, y - 76, 11)], ballAt("tsmoke", "Asap", "smoke", x - 44, y - 66, 14, -0.05)),
    sp("loco", "Lokomotif", [Rc(x - 78, y - 34, 96, 62, 8)], boxAt("tloco", "Lokomotif", "loco", 0.58, 0.38, 0.42, x - 30, y - 3)),
    sp("cabin", "Kabin", [Rc(x + 24, y - 58, 62, 86, 8)], boxAt("tcabin", "Kabin", "cabin", 0.38, 0.52, 0.42, x + 55, y - 15)),
  ];
  if (wagon) pieces.push(sp("wagon", "Gerbong", [Rc(x + 96, y - 40, 84, 68, 8), Rc(x + 108, y - 28, 26, 26, 5), Rc(x + 142, y - 28, 26, 26, 5)], boxAt("twagon", "Gerbong", "wagon", 0.5, 0.4, 0.42, x + 138, y - 6)));
  pieces.push(sp("wheels", "Roda", [Ci(x - 52, y + 32, 15), Ci(x + 30, y + 32, 15), ...(wagon ? [Ci(x + 122, y + 32, 15), Ci(x + 162, y + 32, 15)] : [])],
    cylPart({ id: "twheel", label: "Roda", assembly: "Gulung roda-roda kereta dan rekatkan di bawah badannya.", r: 0.1, h: 0.08, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [MX(x - 52), MY(y + 32), 0.24] } })));
  return mergePieces(...pieces);
}

function boatPieces(o: { sail: boolean; cabin?: boolean; x?: number; y?: number }): ScenePiece {
  const x = o.x ?? 240, y = o.y ?? 218;
  const pieces: ScenePiece[] = [];
  if (o.sail) {
    pieces.push(sp("sail", "Layar", [Pa(`M${x + 4} ${y - 118} L${x + 4} ${y - 26} L${x - 58} ${y - 26} Z`), Pa(`M${x + 16} ${y - 96} L${x + 16} ${y - 26} L${x + 62} ${y - 26} Z`)],
      prismAt("bsail", "Layar", "sail", [[-0.35, 0.3], [0, -0.32], [0.35, 0.3]], x, y - 70, 0)));
    pieces.push(sp("flag", "Bendera", [Pa(`M${x + 10} ${y - 118} L${x + 38} ${y - 110} L${x + 10} ${y - 100} Z`)],
      prismAt("bflag", "Bendera", "flag", [[0, 0.07], [0.18, 0], [0, -0.07]], x + 22, y - 109, 0.05)));
  }
  if (o.cabin) {
    pieces.push(sp("cabin", "Kabin", [Rc(x - 40, y - 62, 76, 36, 6)], boxAt("bcabin", "Kabin", "cabin", 0.46, 0.22, 0.36, x - 2, y - 44)));
  }
  pieces.push(sp("hull", "Lambung", [Pa(`M${x - 84} ${y - 24} L${x + 84} ${y - 24} L${x + 62} ${y + 22} L${x - 62} ${y + 22} Z`)],
    boxAt("bhull", "Lambung", "hull", 1.0, 0.28, 0.44, x, y)));
  return mergePieces(...pieces);
}

const umbrellaPiece = (cx: number, cy: number): ScenePiece =>
  sp("umbrella", "Payung", [Pa(`M${cx - 52} ${cy} C${cx - 40} ${cy - 34} ${cx + 40} ${cy - 34} ${cx + 52} ${cy} C${cx + 34} ${cy - 10} ${cx + 18} ${cy - 10} ${cx} ${cy} C${cx - 18} ${cy - 10} ${cx - 34} ${cy - 10} ${cx - 52} ${cy} Z`), Rc(cx - 3, cy, 6, 30, 3)],
    prismAt("umbrella", "Payung", "umbrella", [[-0.32, 0.05], [0, 0.22], [0.32, 0.05], [0.15, -0.05], [-0.15, -0.05]], cx, cy - 12, 0.15));

const L4: TemplateDef[] = [
  scene({ id: "sk-kucing-taman", name: "Kucing di Taman", collection: "animal-friends", blurb: "Kucing kecil yang bermain di taman bunga yang cerah.", band: "3-4th", who: "kucingmu" },
    mergePieces(elSun("sun", 404, 62, 27), elCloud("cloud", 96, 58, 0.9), elFence("fence", 240, 226, 330), elGroundBand("grass", "Rumput"), elBush("bush", 66, 252, 0.9), elFlower("flower", 356, 252, 1), elFlower("flower2", 116, 262, 0.85)),
    [miniBuddy(228, 196, 1.05, { ear: "pointy", belly: true, merges: { ears: "body", belly: "body" } })]),
  scene({ id: "sk-anjing-pantai", name: "Anjing di Pantai", collection: "animal-friends", blurb: "Anjing ceria yang bermain bola di tepi pantai.", band: "3-4th", who: "anjingmu" },
    mergePieces(elSun("sun", 70, 60, 28), elGroundBand("sea", "Laut", 208), elGroundBand("sand", "Pasir", 282), umbrellaPiece(352, 168),
      sp("ball", "Bola", [Ci(120, 262, 17)], ballAt("pball", "Bola", "ball", 120, 262, 17, 0.2))),
    [miniQuad(226, 218, 0.95, { ear: "round", merges: { ears: "head", legs: "body" } })]),
  scene({ id: "sk-beruang-piknik", name: "Beruang Piknik", collection: "animal-friends", blurb: "Beruang bundar yang piknik di bawah pohon rindang.", band: "3-4th", who: "beruangmu" },
    mergePieces(elTreeCanopy("canopy", 96, 92, 44), elTrunk("trunk", 96, 128, 268, 13), elGroundBand("grass", "Rumput"), elBush("bush", 404, 254, 0.9), elFlower("flower", 150, 258, 0.9),
      sp("blanket", "Tikar Piknik", [Rc(196, 262, 130, 26, 6)], discAt("blanket", "Tikar Piknik", "blanket", 261, 275, 60, 0.05)),
      sp("basket", "Keranjang", [Pa("M300 262 L342 262 L334 238 L308 238 Z")], boxAt("pbasket", "Keranjang", "basket", 0.26, 0.16, 0.22, 321, 250))),
    [miniBuddy(232, 200, 1.0, { ear: "round", belly: true, merges: { ears: "body", belly: "body" } })]),
  scene({ id: "sk-zebra-safari", name: "Zebra di Safari", collection: "animal-friends", blurb: "Zebra bergaris yang berdiri di bawah pohon akasia.", band: "3-4th", who: "zebramu" },
    mergePieces(elSun("sun", 396, 58, 28), elTreeCanopy("canopy", 108, 84, 46), elTrunk("trunk", 108, 122, 262, 11), elGroundBand("grass", "Rumput"), elBush("bush", 392, 256, 1)),
    [miniQuad(248, 208, 1.0, { ear: "round", pattern: { id: "stripes", label: "Garis" }, merges: { ears: "head", stripes: "body", legs: "body" } })]),
  scene({ id: "sk-ayam-peternakan", name: "Ayam di Peternakan", collection: "animal-friends", blurb: "Ayam yang berkotek di depan kandang merahnya.", band: "3-4th", who: "ayammu" },
    mergePieces(elHouseMini("barnWalls", "barnRoof", 368, 268, 1.05), elFence("fence", 120, 232, 170), elGroundBand("grass", "Rumput"), elSun("sun", 66, 56, 25),
      sp("egg", "Telur", [E(150, 262, 13, 16)], ballAt("cegg", "Telur", "egg", 150, 262, 14, 0.15)),
      sp("comb", "Jengger", [Pa("M196 108 C192 94 202 84 210 90 C212 80 224 78 228 88 C236 80 248 86 246 98 C238 106 208 112 196 108 Z")], prismAt("ccomb", "Jengger", "comb", [[-0.16, -0.05], [0, 0.1], [0.16, -0.05], [0, -0.1]], 222, 96, 0.1))),
    [miniBuddy(222, 178, 0.95, { ear: "none", belly: true, merges: { belly: "body" } })]),
  scene({ id: "sk-kereta-stasiun", name: "Kereta di Stasiun", collection: "little-vehicles", blurb: "Kereta yang berhenti di stasiun kecil berbendera jam.", band: "3-4th", who: "keretamu" },
    mergePieces(elHouseMini("stationWalls", "stationRoof", 382, 190, 0.95), elGroundBand("platform", "Peron", 262), elSun("sun", 62, 54, 24),
      sp("clock", "Jam Stasiun", [Ci(382, 128, 15)], discAt("sclock", "Jam Stasiun", "clock", 382, 128, 14, 0.2)),
      sp("sign", "Papan Nama", [Rc(330, 196, 104, 20, 6)], discAt("ssign", "Papan Nama", "sign", 382, 206, 46, 0.15)),
      trainPieces(196, 218, false)),
    []),
  scene({ id: "sk-kapal-pelabuhan", name: "Kapal di Pelabuhan", collection: "little-vehicles", blurb: "Kapal layar yang berlabuh di dekat mercusuar.", band: "3-4th", who: "kapalmu" },
    mergePieces(elSun("sun", 402, 56, 25), elCloud("cloud", 92, 62, 0.85), elGroundBand("sea", "Laut", 252),
      sp("tower", "Menara Mercusuar", [Pa("M56 252 L66 128 L90 128 L100 252 Z")], prismAt("ltower", "Menara Mercusuar", "tower", [[-0.14, 0.4], [0.14, 0.4], [0.1, -0.4], [-0.1, -0.4]], 78, 190, -0.05)),
      sp("lamp", "Lampu Mercusuar", [Rc(62, 100, 32, 28, 6), Pa("M62 92 L78 74 L94 92 Z")], boxAt("llamp", "Lampu Mercusuar", "lamp", 0.2, 0.18, 0.2, 78, 114)),
      sp("waves", "Ombak", [Pa("M120 282 C150 268 180 282 210 282 C240 282 270 268 300 282 C330 282 360 268 390 282 L390 294 L120 294 Z")], discAt("lwaves", "Ombak", "waves", 255, 284, 120, 0.1)),
      boatPieces({ sail: true, x: 268, y: 232 })),
    []),
  scene({ id: "sk-rubah-hutan", name: "Rubah di Hutan", collection: "animal-friends", blurb: "Rubah hutan yang mengintip dari balik pohon pinus.", band: "3-4th", who: "rubahmu" },
    mergePieces(elPine("pine", 74, 268, 1.05), elPine("pine2", 402, 262, 0.85), elGroundBand("grass", "Rumput"), elBush("bush", 128, 256, 0.9),
      sp("cap", "Topi Jamur", [Pa("M322 238 C328 214 352 202 376 202 C400 202 424 214 430 238 C402 228 350 228 322 238 Z")], conePart({ id: "mcap", label: "Topi Jamur", assembly: "Gulung topi jamur menjadi kerucut lebar.", r: 0.34, h: 0.24, region: "cap", transform: { t: [MX(376), MY(222), 0.1] } })),
      sp("stem", "Batang Jamur", [Rc(362, 238, 28, 34, 6)], cylPart({ id: "mstem", label: "Batang Jamur", assembly: "Gulung batang jamur menjadi tabung pendek.", r: 0.09, h: 0.22, region: "stem", transform: { t: [MX(376), MY(255), 0.1] } }))),
    [miniQuad(226, 212, 0.95, { ear: "pointy", merges: { ears: "head", legs: "body" } })]),
  scene({ id: "sk-penguin-salju", name: "Penguin di Salju", collection: "animal-friends", blurb: "Penguin bersyal yang bermain di dekat iglo.", band: "3-4th", who: "penguinmu" },
    mergePieces(elSun("moon", 398, 58, 24), elPine("pine", 66, 258, 0.9), elGroundBand("snow", "Salju", 262),
      sp("igloo", "Iglo", [Pa("M292 262 C296 214 330 186 368 186 C406 186 440 214 444 262 Z")], ballPart({ id: "igloo", label: "Iglo", assembly: "Buat setengah bola iglo besar di belakang penguin.", r: 0.48, region: "igloo", transform: { s: [1.15, 0.75, 0.9], t: [MX(368), MY(232), -0.15] } })),
      sp("iglooDoor", "Pintu Iglo", [Pa("M352 262 L352 232 C352 220 384 220 384 232 L384 262 Z")], prismAt("igdoor", "Pintu Iglo", "iglooDoor", [[-0.1, -0.14], [0.1, -0.14], [0.1, 0.08], [0, 0.14], [-0.1, 0.08]], 368, 244, 0.05)),
      sp("scarf", "Syal", [Pa("M196 168 C210 160 238 160 252 168 L248 184 C236 176 212 176 200 184 Z"), Rc(238, 178, 12, 26, 5)], prismAt("pscarf", "Syal", "scarf", [[-0.18, 0.06], [0.18, 0.06], [0.14, -0.08], [-0.14, -0.08]], 224, 174, 0.35))),
    [miniBuddy(224, 208, 0.95, { ear: "none", belly: true, merges: { belly: "body" } }), prefixArt(miniFish(130, 282, 0.62, { merges: { fin: "body", tail: "body" } }), "fish")]),
  scene({ id: "sk-kebun-sayur", name: "Kebun Sayur", collection: "magical-garden", blurb: "Kelinci yang memanen wortel dan tomat di kebun sayur.", band: "3-4th", who: "kelincimu" },
    mergePieces(elSun("sun", 70, 56, 26), elCloud("cloud", 380, 60, 0.9), elFence("fence", 240, 196, 340), elGroundBand("soil", "Tanah Kebun", 258),
      sp("carrot", "Wortel", [Pa("M96 252 L124 252 L110 292 Z")], prismAt("gcarrot", "Wortel", "carrot", [[-0.09, 0.14], [0.09, 0.14], [0, -0.16]], 110, 272, 0.15)),
      sp("tops", "Daun Wortel", [Pa("M110 252 C100 234 88 226 76 226 C86 214 102 216 108 230 C112 216 126 210 136 218 C124 226 116 238 114 252 Z")], prismAt("gtops", "Daun Wortel", "tops", [[-0.18, -0.06], [0, 0.12], [0.18, -0.06], [0, -0.12]], 106, 234, 0.15)),
      sp("tomatoPlant", "Tanaman Tomat", [Pa("M330 268 C328 240 330 216 336 196 L344 196 C350 216 352 240 350 268 Z"), Pa("M336 224 C318 220 306 208 304 192 C320 194 332 204 338 218 Z"), Pa("M344 210 C358 200 374 198 384 206 C374 218 358 222 346 218 Z")], cylPart({ id: "tplant", label: "Tanaman Tomat", assembly: "Gulung batang tanaman tomat menjadi tabung ramping.", r: 0.05, h: 0.45, region: "tomatoPlant", transform: { t: [MX(340), MY(232), 0] } })),
      sp("tomato", "Tomat", [Ci(322, 238, 12), Ci(356, 252, 12), Ci(340, 218, 10)], ballAt("gtomato", "Tomat", "tomato", 340, 236, 12, 0.25)),
      sp("can", "Penyiram", [Pa("M392 246 L434 246 L428 274 L398 274 Z"), Pa("M392 254 L372 240 L378 232 L398 244 Z")], boxAt("gcan", "Penyiram", "can", 0.26, 0.18, 0.2, 413, 260))),
    [miniBuddy(218, 216, 0.9, { ear: "round", belly: true, merges: { ears: "body", belly: "body" } })]),
  scene({ id: "sk-burung-pelangi", name: "Burung & Pelangi", collection: "magical-garden", blurb: "Burung kecil yang terbang menyusuri lengkung pelangi.", band: "3-4th", who: "burungmu" },
    mergePieces(elRainbow("rainbow", 240, 262, 150), elCloud("cloud", 84, 250, 0.85), elTreeCanopy("canopy", 398, 208, 34), elTrunk("trunk", 398, 238, 282, 9), elSun("sun", 66, 56, 24), elFlower("flower", 150, 272, 0.9),
      sp("birdBody", "Badan Burung", [E(232, 148, 42, 34)], ballPart({ id: "bbird", label: "Badan Burung", assembly: "Buat bola badan burung yang pipih.", r: 0.26, region: "birdBody", transform: { s: [1.2, 0.95, 0.8], t: [MX(232), MY(148), 0.1] } })),
      sp("birdWing", "Sayap Burung", [Pa("M214 140 C232 126 258 128 266 144 C272 160 260 174 242 176 C226 176 212 160 214 140 Z")], prismAt("bwing", "Sayap Burung", "birdWing", [[-0.16, 0.14], [0.18, 0.16], [0.12, -0.14], [-0.12, -0.12]], 240, 152, 0.3)),
      sp("birdTail", "Ekor Burung", [Pa("M192 156 C172 148 158 134 156 118 C174 122 190 134 196 148 Z")], prismAt("btail", "Ekor Burung", "birdTail", [[-0.14, 0.1], [0.1, 0.14], [0.12, -0.1], [-0.08, -0.12]], 176, 138, 0)),
      sp("birdCrest", "Jambul Burung", [Pa("M222 116 C218 98 226 84 240 80 C242 94 248 104 256 110 C246 118 230 120 222 116 Z")], prismAt("bcrest", "Jambul Burung", "birdCrest", [[-0.12, -0.08], [0.02, 0.12], [0.14, -0.04], [0, -0.12]], 238, 100, 0.15))),
    [], [{ el: Ci(252, 140, 5.5), fill: INK }, { el: Pa("M268 148 L288 154 L268 162 Z"), fill: "#F4842B", stroke: INK, sw: 2.5 }, { el: Ci(238, 156, 7), fill: "#F2A0B5" }]),
  scene({ id: "sk-dino-gunung", name: "Dino & Gunung", collection: "dino-world", blurb: "Dino kecil yang berdiri gagah di kaki gunung bersalju.", band: "3-4th", who: "dinomu" },
    mergePieces(elMountain("mountain", 108, 262, 170, 190), elSnowcap("snowcap", 108, 72, 64), elSun("sun", 398, 56, 26), elCloud("cloud", 268, 62, 0.9), elGroundBand("grass", "Rumput"), elFlower("flower", 368, 264, 0.9),
      sp("spikes", "Duri", [Pa("M196 138 L212 108 L226 136 Z"), Pa("M232 124 L250 96 L262 126 Z"), Pa("M266 122 L286 98 L294 128 Z")], prismAt("dspikes", "Duri", "spikes", [[-0.3, -0.08], [0, 0.16], [0.3, -0.08]], 246, 118, -0.05))),
    [miniQuad(246, 196, 1.0, { ear: "none", merges: { legs: "body" } })]),
  scene({ id: "sk-kuda-padang", name: "Kuda di Padang", collection: "animal-friends", blurb: "Kuda poni berpelana yang merumput di padang luas.", band: "3-4th", who: "kudamu" },
    mergePieces(elSun("sun", 66, 56, 26), elCloud("cloud", 388, 58, 0.9), elFence("fence", 240, 210, 350), elGroundBand("grass", "Rumput"), elBush("bush", 56, 258, 0.9),
      sp("saddle", "Pelana", [Rc(216, 148, 56, 26, 9)], boxAt("hsaddle", "Pelana", "saddle", 0.34, 0.15, 0.4, 244, 161))),
    [miniQuad(240, 202, 1.0, { ear: "pointy", merges: { ears: "head", legs: "body" } })]),
  scene({ id: "sk-balon-lembah", name: "Balon Udara di Lembah", collection: "space-explorers", blurb: "Balon udara yang melayang di atas lembah dan sungai.", band: "3-4th", who: "balon udaramu" },
    mergePieces(elMountain("hill", 84, 292, 190, 120), elMountain("hill2", 404, 292, 170, 96), elPond("river", 240, 292, 90, "Sungai"), elTreeCanopy("canopy", 150, 218, 28), elTrunk("trunk", 150, 242, 282, 8), elCloud("cloud", 90, 52, 0.85), elSun("sun", 404, 52, 24),
      sp("balloon", "Balon", [E(252, 108, 52, 60)], ballPart({ id: "vballoon", label: "Balon", assembly: "Buat bola balon udara yang lonjong.", r: 0.36, region: "balloon", transform: { s: [0.95, 1.1, 0.9], t: [MX(252), MY(108), 0] } })),
      sp("balloonStripes", "Garis Balon", [Pa("M226 62 C214 96 214 130 226 160 L240 166 C230 128 230 94 238 60 Z"), Pa("M278 62 C290 96 290 130 278 160 L264 166 C274 128 274 94 266 60 Z")], prismAt("vstripes", "Garis Balon", "balloonStripes", [[-0.3, 0.32], [0, -0.36], [0.3, 0.32], [0.12, 0.36], [-0.12, 0.36]], 252, 112, 0.34)),
      sp("basket", "Keranjang", [Pa("M232 190 L272 190 L264 216 L240 216 Z")], boxAt("vbasket", "Keranjang", "basket", 0.24, 0.16, 0.2, 252, 203))),
    []),
  scene({ id: "sk-perahu-danau", name: "Perahu di Danau", collection: "little-vehicles", blurb: "Perahu layar kecil yang berlayar di danau pegunungan.", band: "3-4th", who: "perahumu" },
    mergePieces(elMountain("mountain", 90, 240, 180, 150), elPond("lake", 250, 278, 165, "Danau"), elSun("sun", 404, 54, 25), elCloud("cloud", 250, 56, 0.85),
      sp("reeds", "Alang-alang", [Pa("M96 268 C92 240 96 216 106 200 L112 200 C114 224 116 246 114 268 Z"), Pa("M122 270 C120 246 126 226 136 212 L142 214 C142 236 140 254 136 270 Z")], prismAt("preeds", "Alang-alang", "reeds", [[-0.14, -0.2], [0, 0.22], [0.14, -0.2], [0.05, -0.24], [-0.05, -0.24]], 118, 240, 0.1)),
      boatPieces({ sail: true, x: 268, y: 238 })),
    [miniFish(150, 288, 0.6, { merges: { fin: "body", tail: "body" } })]),
  scene({ id: "sk-taman-bermain", name: "Taman Bermain", collection: "magical-garden", blurb: "Beruang kecil yang bermain perosotan dan ayunan.", band: "3-4th", who: "beruangmu" },
    mergePieces(elTreeCanopy("canopy", 404, 96, 40), elTrunk("trunk", 404, 130, 262, 11), elGroundBand("grass", "Rumput"), elSun("sun", 62, 54, 25), elCloud("cloud", 190, 52, 0.85),
      sp("slide", "Perosotan", [Pa("M84 262 L150 176 L168 176 L118 262 Z"), Rc(146, 130, 10, 132, 4), Rc(146, 130, 44, 9, 4)], prismAt("pslide", "Perosotan", "slide", [[-0.3, -0.3], [0.05, 0.35], [0.35, -0.25], [0, -0.35]], 128, 216, 0)),
      sp("swingFrame", "Tiang Ayunan", [Pa("M300 262 L322 168 L344 262 M322 168 L388 168 M366 262 L388 168"), Rc(306, 160, 88, 9, 4)], prismAt("psframe", "Tiang Ayunan", "swingFrame", [[-0.3, -0.3], [0, 0.32], [0.3, -0.3]], 347, 214, -0.05)),
      sp("swingSeat", "Kursi Ayunan", [Rc(330, 226, 34, 9, 4), Pa("M334 176 L334 226 M360 176 L360 226")], prismAt("psseat", "Kursi Ayunan", "swingSeat", [[-0.12, 0.04], [0.12, 0.04], [0.12, -0.04], [-0.12, -0.04]], 347, 230, 0.1))),
    [miniBuddy(238, 216, 0.9, { ear: "round", belly: true, merges: { ears: "body", belly: "body" } })]),
  scene({ id: "sk-kemah", name: "Kemah di Hutan", collection: "magical-garden", blurb: "Tenda kemah di hutan pinus dengan api unggun kecil.", band: "3-4th", who: "tendamu" },
    mergePieces(elPine("pine", 66, 268, 1.0), elPine("pine2", 414, 264, 0.9), elSun("moon", 240, 52, 22), elGroundBand("ground", "Tanah", 262), elBush("bush", 130, 258, 0.85),
      sp("tent", "Tenda", [Pa("M156 262 L240 156 L324 262 Z")], prismAt("ctent", "Tenda", "tent", [[-0.5, -0.32], [0, 0.34], [0.5, -0.32]], 240, 210, 0)),
      sp("door", "Pintu Tenda", [Pa("M240 196 L268 262 L212 262 Z")], prismAt("cdoor", "Pintu Tenda", "door", [[-0.17, -0.2], [0, 0.22], [0.17, -0.2]], 240, 230, 0.08)),
      sp("flag", "Bendera", [Pa("M240 156 L240 132 L266 141 L240 152 Z")], prismAt("cflag", "Bendera", "flag", [[0, 0.07], [0.16, 0], [0, -0.07]], 252, 142, 0.05)),
      sp("logs", "Kayu Bakar", [Rc(330, 256, 52, 11, 5), Rc(336, 244, 40, 10, 5)], boxAt("clogs", "Kayu Bakar", "logs", 0.3, 0.09, 0.18, 356, 254)),
      sp("fire", "Api Unggun", [Pa("M356 244 C346 226 350 206 362 192 C374 206 378 226 368 244 C364 250 360 250 356 244 Z")], conePart({ id: "cfire", label: "Api Unggun", assembly: "Gulung api unggun menjadi kerucut di atas kayu bakar.", r: 0.09, h: 0.3, region: "fire", transform: { t: [MX(362), MY(224), 0.1] } }))),
    []),
  scene({ id: "sk-pasar-buah", name: "Kios Buah", collection: "magical-garden", blurb: "Kios buah segar dengan tenda bergaris dan papan nama.", band: "3-4th", who: "kios buahmu" },
    mergePieces(elSun("sun", 64, 54, 25), elCloud("cloud", 396, 56, 0.85), elGroundBand("ground", "Tanah", 272),
      sp("awning", "Tenda Kios", [Pa("M110 128 L370 128 L344 168 L136 168 Z")], prismAt("mawning", "Tenda Kios", "awning", [[-0.8, 0.1], [0.8, 0.1], [0.65, -0.14], [-0.65, -0.14]], 240, 148, 0.1)),
      sp("awningStripe", "Garis Tenda", [Pa("M160 128 L196 128 L186 168 L152 168 Z"), Pa("M262 128 L298 128 L306 168 L272 168 Z")], prismAt("mstripe", "Garis Tenda", "awningStripe", [[-0.55, 0.08], [0.55, 0.08], [0.45, -0.1], [-0.45, -0.1]], 240, 148, 0.13)),
      sp("stall", "Meja Kios", [Rc(128, 216, 224, 52, 8)], boxAt("mstall", "Meja Kios", "stall", 1.35, 0.3, 0.5, 240, 242)),
      sp("apples", "Apel", [Ci(164, 198, 14), Ci(192, 192, 14), Ci(178, 178, 13)], ballAt("mapple", "Apel", "apples", 178, 190, 14, 0.3)),
      sp("oranges", "Jeruk", [Ci(240, 198, 14), Ci(268, 192, 14), Ci(254, 178, 13)], ballAt("morange", "Jeruk", "oranges", 254, 190, 14, 0.3)),
      sp("bananas", "Pisang", [Pa("M300 176 C312 196 330 206 350 206 C338 218 312 218 298 202 C290 192 292 180 300 176 Z")], prismAt("mbanana", "Pisang", "bananas", [[-0.2, 0.1], [0.15, 0.18], [0.3, 0.02], [0, -0.12], [-0.18, -0.04]], 324, 198, 0.3)),
      sp("sign", "Papan Nama", [Rc(196, 84, 88, 26, 8)], discAt("msign", "Papan Nama", "sign", 240, 97, 40, 0.1)),
      sp("basket", "Keranjang", [Pa("M368 236 L406 236 L398 266 L376 266 Z")], boxAt("mbasket", "Keranjang", "basket", 0.24, 0.18, 0.2, 387, 251))),
    []),
  scene({ id: "sk-robot-taman", name: "Robot di Taman", collection: "space-explorers", blurb: "Robot kecil ramah yang menyiram bunga di taman.", band: "3-4th", who: "robotmu" },
    mergePieces(elTreeCanopy("canopy", 84, 92, 40), elTrunk("trunk", 84, 126, 264, 11), elGroundBand("grass", "Rumput"), elFlower("flower", 356, 256, 1), elFlower("flower2", 392, 266, 0.85), elSun("sun", 404, 54, 25),
      sp("antenna", "Antena", [Rc(236, 84, 7, 22, 3), Ci(240, 78, 8)], prismAt("rant", "Antena", "antenna", [[-0.03, 0.12], [0.03, 0.12], [0.03, -0.12], [-0.03, -0.12]], 240, 92, 0.1)),
      sp("head", "Kepala Robot", [Rc(200, 104, 80, 62, 12)], boxAt("rhead", "Kepala Robot", "head", 0.48, 0.38, 0.4, 240, 135)),
      sp("body", "Badan Robot", [Rc(204, 172, 72, 66, 10)], boxAt("rbody", "Badan Robot", "body", 0.44, 0.4, 0.42, 240, 205)),
      sp("panel", "Panel", [Rc(220, 188, 40, 30, 6)], discAt("rpanel", "Panel", "panel", 240, 203, 19, 0.24)),
      sp("arms", "Lengan Robot", [Rc(172, 178, 22, 52, 9), Rc(286, 178, 22, 52, 9)], boxAt("rarm", "Lengan Robot", "arms", 0.14, 0.32, 0.14, 183, 204)),
      sp("legs", "Kaki Robot", [Rc(214, 242, 20, 28, 6), Rc(246, 242, 20, 28, 6)], boxAt("rleg", "Kaki Robot", "legs", 0.13, 0.18, 0.13, 224, 256))),
    [], [{ el: Ci(224, 130, 7), fill: INK }, { el: Ci(256, 130, 7), fill: INK }, { el: Pa("M226 148 L254 148"), stroke: INK, sw: 4 }]),
  scene({ id: "sk-unicorn-pelangi", name: "Unicorn & Pelangi", collection: "magical-garden", blurb: "Unicorn berpelana yang berdiri di bawah pelangi.", band: "3-4th", who: "unicornmu" },
    mergePieces(elRainbow("rainbow", 240, 268, 160), elCloud("cloud", 76, 252, 0.85), elGroundBand("grass", "Rumput"),
      sp("horn", "Tanduk", [Pa("M330 108 L342 72 L354 106 Z")], conePart({ id: "uhorn", label: "Tanduk", assembly: "Gulung tanduk unicorn menjadi kerucut dan rekatkan di kepala.", r: 0.05, h: 0.24, region: "horn", transform: { t: [MX(342), MY(92), 0.1] } })),
      sp("mane", "Surai", [Pa("M296 118 C284 140 284 168 296 190 C306 168 306 142 296 118 Z"), Pa("M306 104 C300 92 302 80 310 72 C316 84 316 96 312 106 Z")], prismAt("umane", "Surai", "mane", [[-0.08, 0.3], [0.1, 0.28], [0.08, -0.3], [-0.06, -0.28]], 298, 148, -0.05)),
      sp("saddle", "Pelana", [Rc(196, 152, 52, 24, 8)], boxAt("usaddle", "Pelana", "saddle", 0.32, 0.14, 0.38, 222, 164))),
    [miniQuad(232, 204, 1.0, { ear: "pointy", merges: { ears: "head", legs: "body" } })]),
  scene({ id: "sk-naga-kastil", name: "Naga & Kastil", collection: "magical-garden", blurb: "Naga kecil bersayap yang menjaga kastil mungil.", band: "3-4th", who: "nagamu" },
    mergePieces(elHouseMini("castleWalls", "castleRoof", 386, 268, 1.0), elGroundBand("grass", "Rumput"), elCloud("cloud", 80, 56, 0.9),
      sp("flag", "Bendera", [Pa("M386 152 L386 128 L412 137 L386 148 Z")], prismAt("nflag", "Bendera", "flag", [[0, 0.07], [0.16, 0], [0, -0.07]], 398, 139, 0.1)),
      sp("wings", "Sayap Naga", [Pa("M196 148 C168 112 132 94 96 100 C124 128 132 158 124 188 C152 164 178 158 202 168 Z")], prismAt("nwings", "Sayap Naga", "wings", [[-0.4, 0.25], [0.15, 0], [0.35, -0.3], [-0.15, -0.28]], 152, 142, -0.08)),
      sp("horns", "Tanduk Naga", [Pa("M282 122 L276 96 L294 112 Z"), Pa("M306 112 L306 84 L320 104 Z")], conePart({ id: "nhorn", label: "Tanduk Naga", assembly: "Gulung tanduk naga menjadi kerucut kecil di kepala.", r: 0.05, h: 0.18, region: "horns", transform: { t: [MX(298), MY(104), 0.05] } })),
      sp("belly", "Perut Naga", [Pa("M218 208 C240 200 268 202 284 212 C280 238 262 254 240 254 C220 254 206 234 218 208 Z")], discAt("nbelly", "Perut Naga", "belly", 250, 228, 30, 0.4))),
    [miniQuad(238, 204, 1.0, { ear: "pointy", merges: { ears: "head", legs: "body" } })]),
  scene({ id: "sk-bajak-laut", name: "Kapal Bajak Laut", collection: "little-vehicles", blurb: "Kapal bajak laut yang berlabuh di pulau palem kecil.", band: "3-4th", who: "kapalmu" },
    mergePieces(elGroundBand("sea", "Laut", 246), elSun("sun", 64, 54, 26), elCloud("cloud", 180, 50, 0.85),
      sp("island", "Pulau", [Pa("M330 268 C340 246 380 236 414 244 C438 250 448 260 446 268 Z")], discAt("bisland", "Pulau", "island", 388, 256, 52, 0)),
      sp("palmTrunk", "Batang Palem", [Pa("M382 246 C386 220 392 198 402 182 L412 186 C404 204 398 226 396 248 Z")], cylPart({ id: "btrunk", label: "Batang Palem", assembly: "Gulung batang palem menjadi tabung melengkung.", r: 0.06, h: 0.42, region: "palmTrunk", transform: { r: [0, 0, -0.25], t: [MX(394), MY(216), 0] } })),
      sp("palmLeaves", "Daun Palem", [Pa("M402 182 C380 162 354 156 332 164 C354 172 378 180 396 190 Z"), Pa("M406 180 C420 156 446 146 468 152 C450 168 428 180 410 188 Z"), Pa("M404 184 C400 160 408 138 424 126 C428 152 420 174 408 188 Z")], prismAt("bleaves", "Daun Palem", "palmLeaves", [[-0.45, 0.1], [0, -0.16], [0.45, 0.1], [0.2, 0.16], [-0.2, 0.16]], 400, 162, 0.05)),
      boatPieces({ sail: true, cabin: true, x: 190, y: 240 })),
    []),
  scene({ id: "sk-sirkus-tenda", name: "Tenda Sirkus", collection: "magical-garden", blurb: "Tenda sirkus bergaris dengan bendera dan panggung kecil.", band: "3-4th", who: "tenda sirkusmu" },
    mergePieces(elGroundBand("ground", "Tanah", 266), elSun("sun", 62, 54, 25), elCloud("cloud", 400, 56, 0.85),
      sp("tent", "Tenda", [Pa("M116 266 L240 108 L364 266 Z")], prismAt("stent", "Tenda", "tent", [[-0.75, -0.48], [0, 0.5], [0.75, -0.48]], 240, 188, 0)),
      sp("tentStripes", "Garis Tenda", [Pa("M196 158 L240 108 L284 158 L268 266 L212 266 Z")], prismAt("sstripe", "Garis Tenda", "tentStripes", [[-0.28, -0.48], [0, 0.5], [0.28, -0.48], [0.18, -0.48], [-0.18, -0.48]], 240, 188, 0.06)),
      sp("tentRoof", "Atap Tenda", [Pa("M196 112 L240 66 L284 112 Z")], conePart({ id: "sroof", label: "Atap Tenda", assembly: "Gulung atap tenda menjadi kerucut di puncak tenda.", r: 0.28, h: 0.3, region: "tentRoof", transform: { t: [MX(240), MY(92), 0.05] } })),
      sp("tentFlag", "Bendera", [Pa("M240 66 L240 40 L268 49 L240 60 Z")], prismAt("sflag", "Bendera", "tentFlag", [[0, 0.07], [0.17, 0], [0, -0.07]], 253, 50, 0.08)),
      sp("entrance", "Pintu Masuk", [Pa("M240 190 L268 266 L212 266 Z")], prismAt("sdoor", "Pintu Masuk", "entrance", [[-0.17, -0.23], [0, 0.25], [0.17, -0.23]], 240, 228, 0.1)),
      sp("drum", "Panggung Drum", [Rc(330, 238, 56, 28, 8)], cylPart({ id: "sdrum", label: "Panggung Drum", assembly: "Gulung panggung drum menjadi tabung pendek.", r: 0.18, h: 0.17, region: "drum", transform: { t: [MX(358), MY(252), 0.15] } })),
      sp("ball", "Bola Sirkus", [Ci(110, 248, 18)], ballAt("sball", "Bola Sirkus", "ball", 110, 248, 18, 0.15))),
    []),
  scene({ id: "sk-mobil-kemah", name: "Mobil Kemah", collection: "little-vehicles", blurb: "Mobil kemah yang parkir di bawah pohon untuk bermalam.", band: "3-4th", who: "mobil kemahmu" },
    mergePieces(elTreeCanopy("canopy", 392, 92, 40), elTrunk("trunk", 392, 126, 262, 11), elGroundBand("grass", "Rumput"), elSun("sun", 60, 54, 25), elCloud("cloud", 200, 52, 0.85),
      sp("vanBody", "Badan Mobil", [Pa("M84 238 L84 156 C84 138 94 128 112 128 L268 128 C292 128 306 142 312 164 L320 208 C322 224 314 238 298 238 Z")], boxAt("vbody", "Badan Mobil", "vanBody", 1.4, 0.66, 0.55, 202, 183)),
      sp("vanWindows", "Jendela Mobil", [Rc(108, 146, 44, 36, 7), Rc(164, 146, 44, 36, 7), Rc(220, 146, 52, 36, 7)], discAt("vwin", "Jendela Mobil", "vanWindows", 190, 164, 75, 0.3)),
      sp("vanStripe", "Garis Mobil", [Rc(84, 198, 236, 14, 6)], prismAt("vstripe", "Garis Mobil", "vanStripe", [[-0.72, 0.04], [0.72, 0.04], [0.72, -0.04], [-0.72, -0.04]], 202, 205, 0.3)),
      sp("vanWheels", "Roda", [Ci(140, 242, 24), Ci(268, 242, 24)], cylPart({ id: "vwheel", label: "Roda", assembly: "Gulung dua roda mobil dan rekatkan di bawah badan.", r: 0.15, h: 0.1, region: "vanWheels", transform: { r: [Math.PI / 2, 0, 0], t: [MX(140), MY(242), 0.3] } })),
      sp("awning", "Tenda Mobil", [Pa("M312 150 L372 168 L372 182 L312 172 Z")], prismAt("vawning", "Tenda Mobil", "awning", [[-0.05, 0.12], [0.35, 0.2], [0.35, 0.05], [-0.05, -0.02]], 340, 166, 0.2))),
    []),
  scene({ id: "sk-helikopter-kota", name: "Helikopter di Kota", collection: "little-vehicles", blurb: "Helikopter yang terbang di antara gedung-gedung kota.", band: "3-4th", who: "helikoptermu" },
    mergePieces(elSun("sun", 404, 52, 24), elCloud("cloud", 70, 56, 0.85),
      sp("building1", "Gedung Satu", [Rc(52, 150, 74, 142, 6)], boxAt("hb1", "Gedung Satu", "building1", 0.45, 0.86, 0.4, 89, 221)),
      sp("windows1", "Jendela Gedung", [Rc(66, 168, 18, 22, 4), Rc(94, 168, 18, 22, 4), Rc(66, 204, 18, 22, 4), Rc(94, 204, 18, 22, 4), Rc(66, 240, 18, 22, 4), Rc(94, 240, 18, 22, 4)], discAt("hw1", "Jendela Gedung", "windows1", 89, 216, 26, 0.24)),
      sp("building2", "Gedung Dua", [Rc(356, 176, 64, 116, 6)], boxAt("hb2", "Gedung Dua", "building2", 0.39, 0.7, 0.38, 388, 234)),
      sp("windows2", "Jendela Gedung", [Rc(368, 192, 16, 20, 4), Rc(392, 192, 16, 20, 4), Rc(368, 224, 16, 20, 4), Rc(392, 224, 16, 20, 4)], discAt("hw2", "Jendela Gedung", "windows2", 388, 214, 22, 0.22)),
      sp("heliBody", "Badan Helikopter", [E(222, 148, 76, 58)], ballPart({ id: "hbody", label: "Badan Helikopter", assembly: "Buat bola badan helikopter yang gemuk.", r: 0.46, region: "heliBody", transform: { s: [1.1, 0.85, 0.85], t: [MX(222), MY(148), 0.05] } })),
      sp("heliWindow", "Jendela Helikopter", [Pa("M238 104 C262 110 276 126 278 148 C278 170 264 186 244 190 C232 162 232 128 238 104 Z")], discAt("hwin", "Jendela Helikopter", "heliWindow", 256, 148, 24, 0.42)),
      sp("heliTail", "Ekor Helikopter", [Pa("M148 138 L84 122 C74 120 68 128 69 138 L71 152 C72 160 78 164 86 162 L150 164 Z")], prismAt("htail", "Ekor Helikopter", "heliTail", [[-0.45, 0.1], [0.4, 0.16], [0.45, -0.04], [-0.4, -0.12]], 108, 144, -0.03)),
      sp("heliRotor", "Baling-baling", [Rc(122, 76, 200, 11, 5)], boxAt("hrotor", "Baling-baling", "heliRotor", 1.2, 0.06, 0.12, 222, 81)),
      sp("heliSkid", "Kaki Pendarat", [Pa("M172 232 L274 232 L274 242 L172 242 Z")], boxAt("hskid", "Kaki Pendarat", "heliSkid", 0.62, 0.07, 0.26, 223, 237))),
    []),
  scene({ id: "sk-pesawat-bandara", name: "Pesawat di Bandara", collection: "little-vehicles", blurb: "Pesawat yang bersiap lepas landas dari bandara kecil.", band: "3-4th", who: "pesawatmu" },
    mergePieces(elSun("sun", 66, 52, 25), elCloud("cloud", 380, 54, 0.85), elGroundBand("runway", "Landasan", 272),
      sp("tower", "Menara Kontrol", [Pa("M58 272 L70 148 L102 148 L114 272 Z")], boxAt("atower", "Menara Kontrol", "tower", 0.3, 0.75, 0.3, 86, 210)),
      sp("towerWindow", "Kaca Menara", [Rc(64, 118, 44, 32, 6)], boxAt("atwin", "Kaca Menara", "towerWindow", 0.27, 0.2, 0.27, 86, 134)),
      sp("planeBody", "Badan Pesawat", [Pa("M130 208 C134 178 164 160 214 156 L330 156 C372 156 402 176 406 204 C400 230 366 244 318 246 L206 246 C164 242 134 232 130 208 Z")], cylPart({ id: "apbody", label: "Badan Pesawat", assembly: "Gulung badan pesawat menjadi tabung panjang.", r: 0.28, h: 1.65, region: "planeBody", transform: { r: [0, 0, Math.PI / 2], t: [MX(268), MY(201), 0] } })),
      sp("planeWing", "Sayap Pesawat", [Pa("M232 232 L310 232 L344 268 L238 266 Z")], prismAt("apwing", "Sayap Pesawat", "planeWing", [[-0.35, 0.08], [0.3, 0.08], [0.5, -0.14], [-0.25, -0.14]], 288, 250, 0.15)),
      sp("planeTail", "Ekor Pesawat", [Pa("M136 170 C126 144 130 120 146 108 L172 152 C162 166 148 172 136 170 Z")], prismAt("aptail", "Ekor Pesawat", "planeTail", [[-0.12, -0.18], [0.02, 0.2], [0.16, -0.14]], 152, 140, -0.03)),
      sp("planeWindows", "Jendela Pesawat", [Ci(216, 184, 9), Ci(248, 184, 9), Ci(280, 184, 9), Ci(312, 184, 9)], discAt("apwin", "Jendela Pesawat", "planeWindows", 264, 184, 52, 0.3)),
      sp("planeStripe", "Garis Pesawat", [Pa("M138 214 L400 214 L398 226 L140 226 Z")], prismAt("apstripe", "Garis Pesawat", "planeStripe", [[-0.8, 0.03], [0.8, 0.03], [0.8, -0.03], [-0.8, -0.03]], 269, 220, 0.3))),
    []),
  scene({ id: "sk-penyu-pantai", name: "Penyu di Pantai", collection: "animal-friends", blurb: "Penyu bercangkang corak yang berjemur di pantai.", band: "3-4th", who: "penyumu" },
    mergePieces(elGroundBand("sea", "Laut", 216), elGroundBand("sand", "Pasir", 278), umbrellaPiece(392, 158),
      sp("palmLeaves", "Daun Palem", [Pa("M64 108 C44 84 18 72 -8 78 L-8 78 C20 88 44 102 58 120 Z"), Pa("M70 104 C78 78 100 60 124 56 C112 82 94 100 74 112 Z")], prismAt("tleaves", "Daun Palem", "palmLeaves", [[-0.4, 0.08], [0, -0.14], [0.4, 0.08], [0.15, 0.14], [-0.15, 0.14]], 62, 88, 0)),
      sp("shell", "Cangkang", [Pa("M150 252 C156 206 196 178 244 178 C292 178 332 206 338 252 C282 266 206 266 150 252 Z")], ballPart({ id: "tshell", label: "Cangkang", assembly: "Buat setengah bola cangkang penyu yang lebar.", r: 0.55, region: "shell", transform: { s: [1.1, 0.72, 0.95], t: [MX(244), MY(228), 0.05] } })),
      sp("pattern", "Corak Cangkang", [Ci(244, 210, 17), Ci(198, 226, 12), Ci(290, 226, 12)], discAt("tpattern", "Corak Cangkang", "pattern", 244, 216, 26, 0.45)),
      sp("head", "Kepala", [Ci(352, 226, 21)], ballAt("thead", "Kepala", "head", 352, 226, 20, 0.1)),
      sp("flippers", "Sirip Kaki", [Pa("M158 252 C138 258 126 270 128 282 C146 284 162 274 168 260 Z"), Pa("M322 254 C340 262 348 274 344 284 C328 284 314 272 310 260 Z")], prismAt("tflip", "Sirip Kaki", "flippers", [[-0.55, 0.05], [-0.1, 0.16], [0.5, 0.1], [0.55, -0.08], [-0.5, -0.12]], 240, 268, 0.05)),
      sp("bucket", "Ember Pasir", [Pa("M392 252 L426 252 L420 282 L398 282 Z")], boxAt("tbucket", "Ember Pasir", "bucket", 0.21, 0.19, 0.18, 409, 267))),
    [], [{ el: Ci(358, 222, 4), fill: INK }, { el: Ci(340, 236, 6), fill: "#F2A0B5" }]),
  scene({ id: "sk-bebek-kolam-besar", name: "Bebek & Kolam", collection: "animal-friends", blurb: "Induk bebek yang berenang bersama anaknya di kolam teratai.", band: "3-4th", who: "bebekmu" },
    mergePieces(elPond("pond", 240, 252, 175), elGroundBand("grass", "Rumput", 288),
      sp("reeds", "Alang-alang", [Pa("M84 246 C80 216 86 190 98 172 L104 174 C106 202 106 224 102 246 Z"), Pa("M112 248 C110 222 116 200 128 186 L134 188 C134 212 132 232 128 248 Z")], prismAt("dreeds", "Alang-alang", "reeds", [[-0.14, -0.2], [0, 0.22], [0.14, -0.2], [0.05, -0.24], [-0.05, -0.24]], 108, 218, 0.05)),
      sp("lily", "Daun Teratai", [Pa("M330 262 C318 246 330 228 352 226 C374 228 386 246 374 262 C360 254 344 254 330 262 Z"), Ci(352, 232, 8)], discAt("dlily", "Daun Teratai", "lily", 352, 246, 24, 0.12)),
      sp("duckBody", "Badan Bebek", [Pa("M156 218 C160 182 190 158 228 158 C266 158 292 182 294 214 C280 234 176 236 156 218 Z")], ballPart({ id: "dbody", label: "Badan Bebek", assembly: "Buat bola badan bebek yang pipih.", r: 0.42, region: "duckBody", transform: { s: [1.15, 0.8, 0.85], t: [MX(225), MY(196), 0.1] } })),
      sp("duckWing", "Sayap Bebek", [Pa("M192 192 C212 180 242 182 252 198 C260 214 250 230 230 232 C212 232 194 216 192 192 Z")], prismAt("dwing", "Sayap Bebek", "duckWing", [[-0.18, 0.14], [0.2, 0.16], [0.14, -0.14], [-0.12, -0.12]], 222, 206, 0.4)),
      sp("duckHead", "Kepala Bebek", [Ci(282, 148, 27)], ballAt("dhead", "Kepala Bebek", "duckHead", 282, 148, 26, 0.1)),
      sp("duckBeak", "Paruh Bebek", [Pa("M304 142 L338 150 L304 160 C298 154 298 148 304 142 Z")], prismAt("dbeak", "Paruh Bebek", "duckBeak", [[-0.1, 0.06], [0.14, 0.02], [0.14, -0.04], [-0.1, -0.06]], 318, 151, 0.25)),
      sp("lingBody", "Badan Anak Bebek", [E(140, 246, 26, 20)], ballPart({ id: "lbody", label: "Badan Anak Bebek", assembly: "Buat bola badan anak bebek yang mungil.", r: 0.17, region: "lingBody", transform: { s: [1.15, 0.85, 0.85], t: [MX(140), MY(246), 0.15] } })),
      sp("lingHead", "Kepala Anak Bebek", [Ci(162, 226, 14)], ballAt("lhead", "Kepala Anak Bebek", "lingHead", 162, 226, 13, 0.15))),
    [], [{ el: Ci(288, 142, 4.5), fill: INK }, { el: Ci(166, 222, 3.4), fill: INK }]),
  scene({ id: "sk-burung-hantu-malam", name: "Burung Hantu di Malam Hari", collection: "animal-friends", blurb: "Burung hantu bermata besar yang berjaga di dahan malam.", band: "3-4th", who: "burung hantumu" },
    mergePieces(elSun("moon", 392, 58, 25), elCloud("cloud", 84, 60, 0.85), elPine("pine", 410, 272, 0.9),
      sp("branch", "Dahan", [Pa("M60 236 C140 220 260 216 420 226 L420 242 C260 234 140 238 60 250 Z")], cylPart({ id: "obranch", label: "Dahan", assembly: "Gulung dahan panjang sebagai tempat bertengger.", r: 0.07, h: 2.1, region: "branch", transform: { r: [0, 0, Math.PI / 2], t: [0, MY(234), -0.05] } })),
      sp("leaves", "Daun Dahan", [Ci(96, 208, 20), Ci(140, 198, 16), Ci(356, 200, 17)], ballPart({ id: "oleaves", label: "Daun Dahan", assembly: "Buat gumpalan daun kecil di ujung dahan.", r: 0.14, region: "leaves", transform: { s: [1.3, 0.8, 0.8], t: [MX(112), MY(204), 0] } })),
      sp("owlEyes", "Mata Besar", [Ci(216, 148, 17), Ci(264, 148, 17)], discAt("oeyes", "Mata Besar", "owlEyes", 240, 148, 30, 0.35))),
    [miniBuddy(240, 178, 1.0, { ear: "pointy", belly: true, merges: { ears: "body", belly: "body" } })],
    [{ el: Pa("M232 166 L248 166 L240 178 Z"), fill: "#F4842B", stroke: INK, sw: 2.5 }]),
  scene({ id: "sk-kucing-hujan", name: "Kucing & Hujan", collection: "animal-friends", blurb: "Kucing berpayung yang menunggu hujan reda di taman.", band: "3-4th", who: "kucingmu" },
    mergePieces(elCloud("cloud", 150, 66, 1.25), elPond("puddle", 250, 288, 130, "Genangan"), elBush("bush", 398, 250, 0.95), elFlower("flower", 84, 262, 0.9),
      sp("rain", "Tetes Hujan", [Pa("M96 108 C88 124 88 136 96 140 C104 136 104 124 96 108 Z"), Pa("M160 118 C152 134 152 146 160 150 C168 146 168 134 160 118 Z"), Pa("M226 106 C218 122 218 134 226 138 C234 134 234 122 226 106 Z"), Pa("M292 118 C284 134 284 146 292 150 C300 146 300 134 292 118 Z")], prismAt("hrain", "Tetes Hujan", "rain", [[-0.6, 0.12], [0, -0.14], [0.6, 0.12], [0.3, 0.16], [-0.3, 0.16]], 194, 130, 0)),
      umbrellaPiece(238, 148),
      sp("boots", "Sepatu Bot", [Rc(204, 258, 20, 18, 5), Rc(252, 258, 20, 18, 5)], boxAt("hboots", "Sepatu Bot", "boots", 0.13, 0.12, 0.13, 214, 267))),
    [miniBuddy(238, 216, 0.9, { ear: "pointy", belly: true, merges: { ears: "body", belly: "body" } })]),
  scene({ id: "sk-mobil-pos-desa", name: "Mobil Pos di Desa", collection: "little-vehicles", blurb: "Mobil pos yang mengantar surat ke rumah-rumah desa.", band: "3-4th", who: "mobil posmu" },
    mergePieces(elHouseMini("houseWalls", "houseRoof", 384, 264, 0.95), elTreeCanopy("canopy", 84, 96, 38), elTrunk("trunk", 84, 128, 258, 10), elGroundBand("grass", "Rumput"), elSun("sun", 200, 50, 23),
      sp("mailbox", "Kotak Surat", [Rc(308, 208, 34, 26, 6), Rc(322, 234, 6, 30, 3)], boxAt("pmail", "Kotak Surat", "mailbox", 0.21, 0.16, 0.18, 325, 221)),
      sp("vanBody", "Badan Mobil", [Pa("M92 240 L92 164 C92 146 102 136 120 136 L240 136 C262 136 276 150 282 172 L288 210 C290 226 282 240 266 240 Z")], boxAt("pbody", "Badan Mobil", "vanBody", 1.18, 0.62, 0.52, 190, 188)),
      sp("vanCabin", "Kaca Mobil", [Rc(226, 152, 40, 34, 7), Rc(120, 152, 40, 34, 7)], discAt("pcabin", "Kaca Mobil", "vanCabin", 193, 169, 66, 0.29)),
      sp("vanWheels", "Roda", [Ci(140, 244, 22), Ci(240, 244, 22)], cylPart({ id: "pwheel", label: "Roda", assembly: "Gulung dua roda mobil pos dan rekatkan di bawah badan.", r: 0.14, h: 0.09, region: "vanWheels", transform: { r: [Math.PI / 2, 0, 0], t: [MX(140), MY(244), 0.28] } }))),
    []),
  scene({ id: "sk-kebun-bunga", name: "Kebun Bunga", collection: "magical-garden", blurb: "Kebun bunga warna-warni di depan rumah kecil yang cerah.", band: "3-4th", who: "kebun bungamu" },
    mergePieces(elHouseMini("houseWalls", "houseRoof", 92, 190, 0.85), elFence("fence", 300, 216, 260), elGroundBand("path", "Jalan Setapak", 272), elSun("sun", 404, 52, 25), elCloud("cloud", 226, 54, 0.85), elTreeCanopy("canopy", 428, 120, 30),
      elFlower("flower", 150, 256, 1), elFlower("flower2", 226, 266, 0.9), elFlower("flower3", 330, 258, 1),
      sp("can", "Penyiram", [Pa("M382 244 L420 244 L414 270 L388 270 Z"), Pa("M382 252 L364 238 L370 230 L386 242 Z")], boxAt("kcan", "Penyiram", "can", 0.23, 0.16, 0.18, 401, 257))),
    []),
  scene({ id: "sk-kereta-gunung", name: "Kereta di Pegunungan", collection: "little-vehicles", blurb: "Kereta yang melintasi lembah di kaki gunung bersalju.", band: "3-4th", who: "keretamu" },
    mergePieces(elMountain("mountain", 118, 250, 210, 185), elSnowcap("snowcap", 118, 65, 74), elPine("pine", 398, 262, 0.9), elGroundBand("ground", "Tanah", 258), elCloud("cloud", 300, 52, 0.85),
      trainPieces(150, 222, true)),
    []),
  scene({ id: "sk-kucing-layangan", name: "Kucing Bermain Layangan", collection: "animal-friends", blurb: "Kucing kecil yang menerbangkan layangan di padang rumput.", band: "3-4th", who: "kucingmu" },
    mergePieces(elSun("sun", 66, 54, 26), elCloud("cloud", 150, 110, 0.8), elGroundBand("grass", "Rumput"), elFlower("flower", 368, 262, 0.95), elBush("bush", 410, 252, 0.9),
      sp("kite", "Layangan", [Pa("M316 62 L362 108 L316 168 L270 108 Z")], prismAt("kkite", "Layangan", "kite", [[0, 0.34], [0.28, 0], [0, -0.36], [-0.28, 0]], 316, 115, 0)),
      sp("kiteTail", "Ekor Layangan", [Pa("M316 168 C306 190 322 204 312 224 C326 218 334 228 330 242"), Pa("M312 196 L296 190 L300 206 Z"), Pa("M318 224 L304 220 L308 234 Z")], prismAt("ktail", "Ekor Layangan", "kiteTail", [[-0.05, 0.24], [0.08, 0.1], [0.02, -0.24], [-0.08, -0.05]], 314, 204, 0))),
    [miniBuddy(196, 220, 0.9, { ear: "pointy", belly: true, merges: { ears: "body", belly: "body" } })],
    [{ el: Pa("M232 196 C262 160 292 140 310 118"), stroke: INK, sw: 2.5 }]),
  scene({ id: "sk-perahu-kertas", name: "Perahu Kertas di Sungai", collection: "little-vehicles", blurb: "Perahu kertas yang berlayar pelan mengikuti arus sungai.", band: "3-4th", who: "perahu kertasmu" },
    mergePieces(elPond("river", 240, 262, 180, "Sungai"), elSun("sun", 398, 54, 25), elCloud("cloud", 84, 58, 0.9),
      sp("reeds", "Alang-alang", [Pa("M70 252 C66 222 72 196 84 178 L90 180 C92 208 92 230 88 252 Z"), Pa("M96 254 C94 228 100 206 112 192 L118 194 C118 218 116 238 112 254 Z")], prismAt("kreeds", "Alang-alang", "reeds", [[-0.14, -0.2], [0, 0.22], [0.14, -0.2], [0.05, -0.24], [-0.05, -0.24]], 92, 224, 0.05)),
      sp("boatHull", "Badan Perahu", [Pa("M176 246 L304 246 L272 278 L208 278 Z")], prismAt("kboat", "Badan Perahu", "boatHull", [[-0.4, 0.1], [0.4, 0.1], [0.2, -0.12], [-0.2, -0.12]], 240, 262, 0.15)),
      sp("boatSail", "Layar Perahu", [Pa("M240 246 L240 178 L282 246 Z"), Pa("M232 246 L232 196 L200 246 Z")], prismAt("ksail", "Layar Perahu", "boatSail", [[-0.26, -0.2], [0, 0.22], [0.26, -0.2]], 240, 214, 0.1)),
      sp("lily", "Daun Teratai", [Pa("M356 272 C346 258 356 242 374 240 C392 242 402 258 392 272 C380 264 368 264 356 272 Z")], discAt("klily", "Daun Teratai", "lily", 374, 258, 22, 0.12))),
    [miniBuddy(374, 232, 0.55, { ear: "none", belly: true, merges: { belly: "body" } }), prefixArt(miniFish(140, 286, 0.6, { merges: { fin: "body", tail: "body" } }), "fish")]),
  scene({ id: "sk-beruang-madu-hutan", name: "Beruang & Sarang Madu", collection: "animal-friends", blurb: "Beruang yang menemukan sarang madu di pohon besar.", band: "3-4th", who: "beruangmu" },
    mergePieces(elTreeCanopy("canopy", 240, 84, 56), elTrunk("trunk", 240, 132, 272, 15), elGroundBand("grass", "Rumput"), elFlower("flower", 96, 262, 0.95), elFlower("flower2", 384, 266, 0.9),
      sp("hive", "Sarang Madu", [Pa("M282 128 C272 152 274 176 288 192 L318 192 C332 176 334 152 324 128 C310 120 296 120 282 128 Z")], ballPart({ id: "hhive", label: "Sarang Madu", assembly: "Buat sarang madu lonjong dan gantungkan di dahan pohon.", r: 0.2, region: "hive", transform: { s: [0.85, 1.1, 0.85], t: [MX(303), MY(158), 0.15] } })),
      sp("bees", "Lebah", [Ci(348, 138, 9), Ci(366, 162, 8)], ballAt("hbee", "Lebah", "bees", 356, 148, 9, 0.2)),
      sp("pot", "Pot Madu", [Pa("M118 288 L126 254 L162 254 L170 288 Z"), E(144, 252, 23, 8)], boxAt("hpot", "Pot Madu", "pot", 0.32, 0.21, 0.28, 144, 271))),
    [miniBuddy(222, 216, 0.95, { ear: "round", belly: true, merges: { ears: "body", belly: "body" } })]),
];

/* ================================================================== */
/* LEVEL 5 — YOUNG CREATORS (4–5 tahun) · 15–22 bidang                 */
/* ================================================================== */

const L5: TemplateDef[] = [
  scene({ id: "ss-kebun-binatang", name: "Kebun Binatang Mini", collection: "animal-friends", blurb: "Gajah dan jerapah menyambut pengunjung di gerbang kebun binatang.", band: "4-5th", who: "kebun binatangmu" },
    mergePieces(elSun("sun", 66, 52, 25), elCloud("cloud", 380, 54, 0.9), elFence("fence", 240, 238, 360), elGroundBand("grass", "Rumput"), elTreeCanopy("canopy", 420, 108, 32), elTrunk("trunk", 420, 138, 240, 9), elBush("bush", 52, 256, 0.9),
      sp("gate", "Gerbang", [Rc(150, 96, 10, 60, 4), Rc(320, 96, 10, 60, 4), Rc(140, 84, 200, 14, 7)], prismAt("zgate", "Gerbang", "gate", [[-0.62, 0.2], [0.62, 0.2], [0.62, -0.24], [-0.62, -0.24]], 240, 118, -0.2)),
      sp("sign", "Papan Nama", [Rc(196, 58, 88, 24, 8)], discAt("zsign", "Papan Nama", "sign", 240, 70, 40, -0.15)),
      sp("eleBody", "Badan Gajah", [E(140, 218, 52, 42)], ballPart({ id: "zebody", label: "Badan Gajah", assembly: "Buat bola badan gajah yang besar.", r: 0.32, region: "eleBody", transform: { s: [1.15, 0.95, 0.9], t: [MX(140), MY(218), 0.05] } })),
      sp("eleEars", "Telinga Gajah", [Ci(104, 196, 20), Ci(176, 196, 20)], ballAt("zeears", "Telinga Gajah", "eleEars", 104, 196, 19, 0.05)),
      sp("eleTrunk", "Belalai", [Pa("M132 232 C126 252 130 268 142 276 L156 268 C148 258 146 244 150 234 Z")], prismAt("zetrunk", "Belalai", "eleTrunk", [[-0.07, 0.16], [0.07, 0.16], [0.05, -0.16], [-0.05, -0.16]], 141, 254, 0.3)),
      sp("eleLegs", "Kaki Gajah", [Rc(106, 254, 16, 24, 5), Rc(158, 254, 16, 24, 5)], boxAt("zelegs", "Kaki Gajah", "eleLegs", 0.11, 0.15, 0.11, 114, 266))),
    [miniQuad(308, 210, 0.92, { ear: "round", pattern: { id: "spots", label: "Bintik" }, merges: { ears: "head", spots: "body", legs: "body" } })],
    [{ el: Ci(150, 210, 5), fill: INK }, { el: Ci(128, 238, 3), fill: INK }]),
  scene({ id: "ss-bawah-laut-dalam", name: "Kerajaan Bawah Laut", collection: "animal-friends", blurb: "Ikan besar, penyu, dan gurita berkumpul di taman karang.", band: "4-5th", who: "kerajaan lautmu" },
    mergePieces(elGroundBand("waves", "Ombak", 44), elGroundBand("sand", "Pasir Dasar", 272),
      sp("seaweed", "Rumput Laut", [Pa("M66 272 C58 238 66 206 58 172 C74 176 82 204 76 236 C84 204 96 182 110 172 C116 204 110 240 118 272 Z")], prismAt("wseaweed", "Rumput Laut", "seaweed", [[-0.2, -0.32], [-0.05, 0.34], [0.1, -0.1], [0.22, 0.32], [0.24, -0.32], [-0.02, -0.34]], 88, 224, -0.05)),
      sp("seaweed2", "Rumput Laut Kecil", [Pa("M392 272 C386 244 392 218 386 192 C398 196 404 220 400 246 C408 222 418 206 428 198 C434 224 430 250 434 272 Z")], prismAt("wseaweed2", "Rumput Laut Kecil", "seaweed2", [[-0.16, -0.26], [-0.02, 0.28], [0.16, -0.26], [0.02, -0.28]], 410, 234, -0.05)),
      sp("coral", "Karang", [Pa("M196 272 C192 248 184 232 170 222 L182 210 C192 222 198 234 200 248 C204 228 214 212 228 204 L234 218 C222 230 216 246 216 262 L228 250 L236 262 C240 268 238 272 232 272 Z")], prismAt("wcoral", "Karang", "coral", [[-0.22, -0.2], [-0.05, 0.22], [0.08, -0.05], [0.2, 0.18], [0.24, -0.2], [0, -0.24]], 204, 240, 0.05)),
      sp("starfish", "Bintang Laut", [Pa(starPath(300, 258, 26, 12))], prismAt("wstar", "Bintang Laut", "starfish", [[0, -0.16], [0.04, -0.05], [0.15, -0.04], [0.06, 0.03], [0.09, 0.13], [0, 0.07], [-0.09, 0.13], [-0.06, 0.03], [-0.15, -0.04], [-0.04, -0.05]], 300, 258, 0.1)),
      sp("bubbles", "Gelembung", [Ci(150, 84, 9), Ci(170, 108, 7), Ci(140, 122, 6), Ci(330, 70, 8)], ballAt("wbub", "Gelembung", "bubbles", 150, 84, 9, 0)),
      sp("shell", "Kerang", [Pa("M336 268 C326 248 336 230 354 228 C372 230 382 248 372 268 C362 260 346 260 336 268 Z")], prismAt("wshell", "Kerang", "shell", [[-0.13, -0.1], [0, 0.13], [0.13, -0.1], [0.06, -0.14], [-0.06, -0.14]], 354, 250, 0.1)),
      sp("turtleShell", "Cangkang Penyu", [Pa("M238 148 C244 118 272 100 302 100 C332 100 360 118 366 148 C334 158 270 158 238 148 Z")], ballPart({ id: "wtshell", label: "Cangkang Penyu", assembly: "Buat setengah bola cangkang penyu.", r: 0.4, region: "turtleShell", transform: { s: [1.1, 0.7, 0.95], t: [MX(302), MY(132), 0] } })),
      sp("turtlePattern", "Corak Cangkang", [Ci(302, 122, 12), Ci(272, 134, 9), Ci(332, 134, 9)], discAt("wtpat", "Corak Cangkang", "turtlePattern", 302, 128, 20, 0.35)),
      sp("turtleHead", "Kepala Penyu", [Ci(376, 140, 15)], ballAt("wthead", "Kepala Penyu", "turtleHead", 376, 140, 14, 0.05)),
      sp("turtleFlippers", "Sirip Penyu", [Pa("M246 150 C230 156 220 166 222 176 C236 176 248 166 252 156 Z"), Pa("M350 150 C364 158 370 168 366 176 C354 174 344 164 342 154 Z")], prismAt("wtflip", "Sirip Penyu", "turtleFlippers", [[-0.45, 0.02], [-0.05, 0.12], [0.42, 0.04], [0.45, -0.08], [-0.42, -0.1]], 294, 162, 0.05)),
      sp("octoHead", "Kepala Gurita", [Pa("M120 108 C122 76 144 56 168 56 C192 56 214 76 216 108 C214 124 202 132 190 126 L146 126 C134 132 122 124 120 108 Z")], ballPart({ id: "wohead", label: "Kepala Gurita", assembly: "Buat bola kepala gurita yang bundar.", r: 0.32, region: "octoHead", transform: { s: [1, 0.9, 0.9], t: [MX(168), MY(94), 0] } })),
      sp("octoTentacles", "Tentakel Gurita", [Pa("M128 126 C122 148 128 166 142 176 C146 158 150 144 148 130 L162 134 C160 150 164 166 174 176 C180 158 182 144 180 130 L194 130 C192 146 196 164 206 174 C216 158 218 142 212 126 C186 134 150 134 128 126 Z")], prismAt("wotent", "Tentakel Gurita", "octoTentacles", [[-0.28, 0.08], [-0.1, -0.14], [0, 0.1], [0.1, -0.14], [0.28, 0.08], [0.24, -0.12], [-0.24, -0.12]], 168, 150, 0.05)),
      sp("octoSpots", "Bintik Gurita", [Ci(150, 84, 7), Ci(184, 76, 6)], ballAt("wospot", "Bintik Gurita", "octoSpots", 150, 84, 7, 0.3))),
    [miniFish(240, 208, 0.95, { merges: { fin: "body", tail: "body" } }), prefixArt(miniFish(392, 196, 0.55, { merges: { fin: "body", tail: "body" } }), "small")],
    [{ el: Ci(262, 200, 5.5), fill: INK }, { el: Ci(160, 92, 6), fill: INK }, { el: Ci(178, 92, 6), fill: INK }, { el: Ci(380, 136, 3.4), fill: INK }]),
  scene({ id: "ss-stasiun-antariksa", name: "Stasiun Antariksa", collection: "space-explorers", blurb: "Astronot yang melayang di stasiun antariksa dekat Bumi.", band: "4-5th", who: "stasiun antariksamu" },
    mergePieces(
      sp("earth", "Bumi", [Ci(84, 268, 56)], ballPart({ id: "aearth", label: "Bumi", assembly: "Buat bola Bumi besar di sudut adegan.", r: 0.36, region: "earth", transform: { t: [MX(84), MY(268), -0.2] } })),
      sp("moon", "Bulan", [Ci(416, 66, 22)], ballAt("amoon", "Bulan", "moon", 416, 66, 21, -0.15)),
      sp("planet", "Planet", [Ci(120, 84, 30)], ballAt("aplanet", "Planet", "planet", 120, 84, 29, -0.15)),
      sp("ring", "Cincin Planet", [Pa("M76 92 C96 74 144 74 164 92 C144 102 96 102 76 92 Z M94 91 C108 99 132 99 146 91 C132 84 108 84 94 91 Z")], prismAt("aring", "Cincin Planet", "ring", [[-0.28, 0], [0, 0.07], [0.28, 0], [0, -0.07]], 120, 90, -0.1)),
      sp("stationBody", "Badan Stasiun", [Rc(196, 96, 88, 40, 12)], boxAt("astbody", "Badan Stasiun", "stationBody", 0.54, 0.25, 0.36, 240, 116)),
      sp("stationPanels", "Panel Surya", [Rc(120, 100, 62, 32, 5), Rc(298, 100, 62, 32, 5)], boxAt("astpanel", "Panel Surya", "stationPanels", 0.38, 0.2, 0.06, 151, 116)),
      sp("stationWindow", "Jendela Stasiun", [Ci(240, 116, 13)], discAt("astwin", "Jendela Stasiun", "stationWindow", 240, 116, 12, 0.2)),
      sp("rocketBody", "Badan Roket", [Pa("M316 268 L316 196 C316 168 328 148 340 138 L352 148 C364 168 364 196 364 268 C348 276 332 276 316 268 Z")], cylPart({ id: "arbody", label: "Badan Roket", assembly: "Gulung badan roket menjadi tabung tegak.", r: 0.15, h: 0.75, region: "rocketBody", transform: { t: [MX(340), MY(208), 0.05] } })),
      sp("rocketNose", "Hidung Roket", [Pa("M340 138 C328 148 316 168 316 196 L364 196 C364 168 352 148 340 138 Z")], conePart({ id: "arnose", label: "Hidung Roket", assembly: "Gulung hidung roket menjadi kerucut di puncak badan.", r: 0.15, h: 0.3, region: "rocketNose", transform: { t: [MX(340), MY(160), 0.05] } })),
      sp("rocketWindow", "Jendela Roket", [Ci(340, 216, 11)], discAt("arwin", "Jendela Roket", "rocketWindow", 340, 216, 10, 0.22)),
      sp("rocketFins", "Sirip Roket", [Pa("M316 232 C302 248 296 262 298 272 L316 264 Z"), Pa("M364 232 C378 248 384 262 382 272 L364 264 Z")], prismAt("arfins", "Sirip Roket", "rocketFins", [[-0.26, -0.1], [-0.05, 0.14], [0.05, 0.14], [0.26, -0.1], [0.1, -0.14], [-0.1, -0.14]], 340, 252, 0)),
      sp("rocketFlame", "Api Roket", [Pa("M326 276 C330 292 336 302 340 310 C344 302 350 292 354 276 C346 286 334 286 326 276 Z")], conePart({ id: "arflame", label: "Api Roket", assembly: "Gulung api roket menjadi kerucut ke bawah.", r: 0.09, h: 0.22, region: "rocketFlame", transform: { r: [Math.PI, 0, 0], t: [MX(340), MY(292), 0.05] } })),
      sp("astroSuit", "Baju Astronot", [Rc(148, 196, 44, 56, 14)], boxAt("aasuit", "Baju Astronot", "astroSuit", 0.27, 0.34, 0.24, 170, 224)),
      sp("astroHelmet", "Helm Astronot", [Ci(170, 168, 26)], ballAt("aahelm", "Helm Astronot", "astroHelmet", 170, 168, 25, 0.05)),
      sp("astroVisor", "Kaca Helm", [Pa("M152 160 C160 148 180 148 188 160 C186 174 154 174 152 160 Z")], discAt("aavisor", "Kaca Helm", "astroVisor", 170, 161, 16, 0.24))),
    []),
  scene({ id: "ss-kota-kecil", name: "Kota Kecil", collection: "little-homes", blurb: "Jalan kota kecil dengan toko, mobil, dan bus yang lalu-lalang.", band: "4-5th", who: "kota kecilmu" },
    mergePieces(elSun("sun", 60, 50, 24), elCloud("cloud", 250, 48, 0.85), elGroundBand("road", "Jalan", 268),
      sp("building1", "Gedung Satu", [Rc(48, 108, 66, 128, 6)], boxAt("cb1", "Gedung Satu", "building1", 0.4, 0.78, 0.36, 81, 172)),
      sp("windows1", "Jendela Satu", [Rc(60, 124, 16, 20, 4), Rc(86, 124, 16, 20, 4), Rc(60, 156, 16, 20, 4), Rc(86, 156, 16, 20, 4), Rc(60, 188, 16, 20, 4), Rc(86, 188, 16, 20, 4)], discAt("cw1", "Jendela Satu", "windows1", 81, 166, 24, 0.2)),
      sp("building2", "Gedung Dua", [Rc(366, 128, 58, 108, 6)], boxAt("cb2", "Gedung Dua", "building2", 0.35, 0.66, 0.34, 395, 182)),
      sp("windows2", "Jendela Dua", [Rc(378, 144, 14, 18, 4), Rc(400, 144, 14, 18, 4), Rc(378, 174, 14, 18, 4), Rc(400, 174, 14, 18, 4)], discAt("cw2", "Jendela Dua", "windows2", 395, 168, 20, 0.19)),
      sp("shop", "Toko", [Rc(150, 168, 96, 68, 6)], boxAt("cshop", "Toko", "shop", 0.58, 0.41, 0.4, 198, 202)),
      sp("awning", "Tenda Toko", [Pa("M142 168 L254 168 L242 190 L154 190 Z")], prismAt("cawning", "Tenda Toko", "awning", [[-0.34, 0.08], [0.34, 0.08], [0.26, -0.08], [-0.26, -0.08]], 198, 179, 0.22)),
      sp("carBody", "Badan Mobil", [Pa("M262 236 C262 218 272 208 290 204 L300 190 C306 180 320 174 336 174 L352 174 C366 174 378 182 386 194 L398 200 C408 204 412 216 412 236 C412 244 406 248 396 248 L278 248 C268 248 262 244 262 236 Z")], boxAt("ccar", "Badan Mobil", "carBody", 0.9, 0.42, 0.45, 337, 214)),
      sp("carWheels", "Roda Mobil", [Ci(292, 250, 15), Ci(382, 250, 15)], cylPart({ id: "ccarwheel", label: "Roda Mobil", assembly: "Gulung dua roda mobil dan rekatkan di bawah badannya.", r: 0.1, h: 0.08, region: "carWheels", transform: { r: [Math.PI / 2, 0, 0], t: [MX(292), MY(250), 0.25] } })),
      sp("busBody", "Badan Bus", [Rc(52, 190, 108, 48, 9)], boxAt("cbus", "Badan Bus", "busBody", 0.65, 0.29, 0.42, 106, 214)),
      sp("busWindows", "Jendela Bus", [Rc(64, 200, 22, 18, 4), Rc(94, 200, 22, 18, 4), Rc(124, 200, 22, 18, 4)], discAt("cbuswin", "Jendela Bus", "busWindows", 105, 209, 38, 0.23)),
      sp("busWheels", "Roda Bus", [Ci(78, 242, 13), Ci(134, 242, 13)], cylPart({ id: "cbuswheel", label: "Roda Bus", assembly: "Gulung dua roda bus dan rekatkan di bawah badannya.", r: 0.085, h: 0.08, region: "busWheels", transform: { r: [Math.PI / 2, 0, 0], t: [MX(78), MY(242), 0.23] } })),
      elTreeCanopy("canopy", 300, 128, 26), elTrunk("trunk", 300, 150, 196, 8),
      sp("trafficLight", "Lampu Lalu Lintas", [Rc(446, 150, 15, 40, 5), Rc(451, 190, 5, 46, 2), Ci(453, 160, 4.5), Ci(453, 171, 4.5), Ci(453, 182, 4.5)], boxAt("ctraffic", "Lampu Lalu Lintas", "trafficLight", 0.1, 0.25, 0.1, 453, 170))),
    []),
  scene({ id: "ss-peternakan-besar", name: "Peternakan Besar", collection: "animal-friends", blurb: "Kandang besar dengan sapi, babi, dan ayam yang sibuk.", band: "4-5th", who: "peternakanmu" },
    mergePieces(elSun("sun", 404, 52, 25), elCloud("cloud", 84, 56, 0.9), elFence("fence", 130, 226, 200), elGroundBand("grass", "Rumput"),
      sp("barnWalls", "Dinding Kandang", [Rc(300, 148, 116, 92, 6)], boxAt("fbarn", "Dinding Kandang", "barnWalls", 0.7, 0.56, 0.5, 358, 194)),
      sp("barnRoof", "Atap Kandang", [Pa("M288 150 L358 96 L428 150 Z")], prismAt("froof", "Atap Kandang", "barnRoof", [[-0.44, -0.14], [0, 0.2], [0.44, -0.14]], 358, 124, 0)),
      sp("barnDoor", "Pintu Kandang", [Rc(336, 186, 44, 54, 5)], discAt("fdoor", "Pintu Kandang", "barnDoor", 358, 213, 21, 0.27)),
      sp("silo", "Silo", [Pa("M438 240 L438 130 C438 112 458 112 458 130 L458 240 Z")], cylPart({ id: "fsilo", label: "Silo", assembly: "Gulung silo menjadi tabung tinggi di samping kandang.", r: 0.09, h: 0.75, region: "silo", transform: { t: [MX(448), MY(180), -0.05] } })),
      sp("hay", "Jerami", [Pa("M52 268 C56 246 84 234 112 238 C136 242 148 254 146 268 Z")], ballPart({ id: "fhay", label: "Jerami", assembly: "Buat gumpalan jerami pipih di dekat pagar.", r: 0.3, region: "hay", transform: { s: [1.1, 0.55, 0.9], t: [MX(99), MY(254), 0.15] } })),
      sp("chickenBody", "Badan Ayam", [E(428, 226, 24, 20)], ballPart({ id: "fchick", label: "Badan Ayam", assembly: "Buat bola badan ayam kecil di dekat kandang.", r: 0.15, region: "chickenBody", transform: { s: [1.1, 0.9, 0.85], t: [MX(428), MY(226), 0.2] } })),
      sp("chickenComb", "Jengger Ayam", [Pa("M418 208 C416 198 424 192 430 196 C432 188 442 188 444 196 C450 192 456 198 452 206 C444 212 424 214 418 208 Z")], prismAt("fcomb", "Jengger Ayam", "chickenComb", [[-0.12, -0.04], [0, 0.08], [0.12, -0.04], [0, -0.08]], 434, 200, 0.25))),
    [miniQuad(170, 216, 0.88, { ear: "round", pattern: { id: "spots", label: "Corak" }, merges: { ears: "head", spots: "body", legs: "body" } }),
     prefixArt(miniBuddy(300, 246, 0.62, { ear: "round", muzzle: true, merges: { ears: "body", muzzle: "body" } }), "pig")],
    [{ el: Ci(434, 222, 3.4), fill: INK }, { el: Pa("M446 224 L460 228 L446 233 Z"), fill: "#F4842B", stroke: INK, sw: 2 }]),
  scene({ id: "ss-taman-bermain-besar", name: "Taman Bermain", collection: "magical-garden", blurb: "Taman bermain lengkap dengan komidi putar dan jungkat-jungkit.", band: "4-5th", who: "taman bermainmu" },
    mergePieces(elSun("sun", 62, 52, 25), elCloud("cloud", 300, 50, 0.85), elGroundBand("grass", "Rumput"), elTreeCanopy("canopy", 428, 100, 34), elTrunk("trunk", 428, 130, 240, 9), elBush("bush", 56, 254, 0.9), elFlower("flower", 150, 264, 0.9),
      sp("slide", "Perosotan", [Pa("M60 262 L118 168 L136 168 L90 262 Z"), Rc(114, 122, 9, 140, 4), Rc(114, 122, 40, 8, 4)], prismAt("gslide", "Perosotan", "slide", [[-0.24, -0.3], [0.04, 0.34], [0.3, -0.26], [0, -0.34]], 100, 214, 0)),
      sp("swingFrame", "Tiang Ayunan", [Pa("M196 262 L216 176 L236 262 M216 176 L282 176 M262 262 L282 176"), Rc(202, 168, 86, 8, 4)], prismAt("gframe", "Tiang Ayunan", "swingFrame", [[-0.28, -0.28], [0, 0.3], [0.28, -0.28]], 242, 216, -0.05)),
      sp("swingSeat", "Kursi Ayunan", [Rc(226, 222, 30, 8, 4), Pa("M230 178 L230 222 M252 178 L252 222")], prismAt("gseat", "Kursi Ayunan", "swingSeat", [[-0.1, 0.03], [0.1, 0.03], [0.1, -0.03], [-0.1, -0.03]], 241, 226, 0.1)),
      sp("seesaw", "Jungkat-jungkit", [Rc(306, 218, 108, 9, 4), Pa("M348 262 L360 228 L372 262 Z")], prismAt("gseesaw", "Jungkat-jungkit", "seesaw", [[-0.34, 0.1], [0.34, 0.1], [0.3, -0.02], [-0.3, -0.02]], 360, 224, 0.05)),
      sp("carouselTop", "Atap Komidi Putar", [Pa("M150 108 L196 72 L242 108 Z")], conePart({ id: "gctop", label: "Atap Komidi Putar", assembly: "Gulung atap komidi putar menjadi kerucut lebar.", r: 0.3, h: 0.24, region: "carouselTop", transform: { t: [MX(196), MY(92), -0.1] } })),
      sp("carouselPole", "Tiang Komidi Putar", [Rc(190, 108, 12, 90, 5), Rc(158, 198, 76, 10, 5)], cylPart({ id: "gcpole", label: "Tiang Komidi Putar", assembly: "Gulung tiang komidi putar menjadi tabung tegak.", r: 0.05, h: 0.55, region: "carouselPole", transform: { t: [MX(196), MY(153), -0.1] } })),
      sp("ball", "Bola", [Ci(300, 252, 15)], ballAt("gball", "Bola", "ball", 300, 252, 15, 0.15)),
      sp("bench", "Bangku", [Rc(330, 232, 72, 9, 4), Rc(336, 214, 60, 9, 4), Rc(338, 241, 8, 20, 3), Rc(386, 241, 8, 20, 3)], boxAt("gbench", "Bangku", "bench", 0.44, 0.12, 0.2, 366, 232))),
    []),
  scene({ id: "ss-pantai-ramai", name: "Pantai Ramai", collection: "animal-friends", blurb: "Pantai cerah dengan kastil pasir, perahu, dan payung besar.", band: "4-5th", who: "pantaimu" },
    mergePieces(elSun("sun", 68, 54, 27), elCloud("cloud", 330, 52, 0.9), elGroundBand("sea", "Laut", 196), elGroundBand("sand", "Pasir", 262), umbrellaPiece(110, 190),
      sp("towel", "Handuk", [Rc(140, 262, 64, 20, 5)], discAt("btowel", "Handuk", "towel", 172, 272, 30, 0.06)),
      sp("bucket", "Ember", [Pa("M226 252 L258 252 L252 280 L232 280 Z")], boxAt("bbucket", "Ember", "bucket", 0.2, 0.18, 0.17, 242, 266)),
      sp("sandcastle", "Kastil Pasir", [Rc(300, 238, 62, 34, 6), Rc(296, 218, 16, 24, 4), Rc(352, 218, 16, 24, 4), Rc(322, 210, 18, 30, 4)], boxAt("bcastle", "Kastil Pasir", "sandcastle", 0.38, 0.24, 0.3, 331, 246)),
      sp("castleFlag", "Bendera Kastil", [Pa("M331 210 L331 190 L355 198 L331 208 Z")], prismAt("bcflag", "Bendera Kastil", "castleFlag", [[0, 0.07], [0.15, 0], [0, -0.07]], 342, 199, 0.1)),
      sp("palmTrunk", "Batang Palem", [Pa("M424 262 C428 232 434 208 446 190 L456 194 C446 214 440 238 438 262 Z")], cylPart({ id: "bptrunk", label: "Batang Palem", assembly: "Gulung batang palem menjadi tabung melengkung.", r: 0.06, h: 0.45, region: "palmTrunk", transform: { r: [0, 0, -0.25], t: [MX(436), MY(228), -0.05] } })),
      sp("palmLeaves", "Daun Palem", [Pa("M446 190 C424 168 396 160 372 168 C396 178 422 188 440 198 Z"), Pa("M450 188 C464 162 490 150 512 156 L512 156 C492 174 470 186 454 196 Z"), Pa("M448 192 C444 166 452 142 468 128 C474 156 466 182 452 198 Z")], prismAt("bpleaves", "Daun Palem", "palmLeaves", [[-0.45, 0.1], [0, -0.16], [0.45, 0.1], [0.2, 0.16], [-0.2, 0.16]], 442, 170, 0)),
      sp("crab", "Kepiting", [E(392, 262, 26, 17), Ci(372, 246, 10), Ci(412, 246, 10)], ballPart({ id: "bcrab", label: "Kepiting", assembly: "Buat bola badan kepiting pipih di pasir.", r: 0.17, region: "crab", transform: { s: [1.2, 0.75, 0.9], t: [MX(392), MY(258), 0.15] } })),
      boatPieces({ sail: true, x: 160, y: 218 })),
    [prefixArt(miniFish(330, 176, 0.55, { merges: { fin: "body", tail: "body" } }), "fish")],
    [{ el: Ci(384, 256, 3), fill: INK }, { el: Ci(400, 256, 3), fill: INK }]),
  scene({ id: "ss-hutan-ajaib", name: "Hutan Ajaib", collection: "magical-garden", blurb: "Pohon berumah di hutan ajaib tempat burung hantu dan kelinci tinggal.", band: "4-5th", who: "hutan ajaibmu" },
    mergePieces(elSun("moon", 404, 52, 23), elGroundBand("grass", "Rumput"), elGroundBand("path", "Jalan Setapak", 284), elBush("bush", 52, 250, 0.95), elFlower("flower", 128, 262, 0.95), elFlower("flower2", 356, 268, 0.85),
      sp("treeCanopy", "Daun Pohon Besar", [Ci(150, 92, 56), Ci(92, 122, 40), Ci(208, 122, 40)], ballPart({ id: "hcanopy", label: "Daun Pohon Besar", assembly: "Buat bola daun pohon raksasa di puncak batang.", r: 0.42, region: "treeCanopy", transform: { s: [1.35, 0.9, 0.95], t: [MX(150), MY(108), -0.12] } })),
      sp("treeTrunk", "Batang Pohon Besar", [Pa("M126 268 C130 210 134 160 132 118 L170 118 C168 160 170 210 176 268 Z")], cylPart({ id: "htrunk", label: "Batang Pohon Besar", assembly: "Gulung batang pohon besar menjadi tabung kokoh.", r: 0.15, h: 0.9, region: "treeTrunk", transform: { t: [MX(151), MY(193), -0.08] } })),
      sp("treeDoor", "Pintu Pohon", [Pa("M138 268 L138 224 C138 212 164 212 164 224 L164 268 Z")], discAt("htdoor", "Pintu Pohon", "treeDoor", 151, 242, 14, 0.1)),
      sp("treeWindow", "Jendela Pohon", [Ci(196, 168, 12)], discAt("htwin", "Jendela Pohon", "treeWindow", 196, 168, 11, 0.08)),
      sp("mushCap", "Topi Jamur", [Pa("M286 218 C292 192 314 178 338 178 C362 178 384 192 390 218 C360 208 316 208 286 218 Z")], conePart({ id: "hmcap", label: "Topi Jamur", assembly: "Gulung topi jamur menjadi kerucut lebar.", r: 0.34, h: 0.26, region: "mushCap", transform: { t: [MX(338), MY(200), 0.1] } })),
      sp("mushStem", "Batang Jamur", [Rc(322, 218, 32, 44, 8)], cylPart({ id: "hmstem", label: "Batang Jamur", assembly: "Gulung batang jamur menjadi tabung pendek.", r: 0.11, h: 0.27, region: "mushStem", transform: { t: [MX(338), MY(240), 0.1] } })),
      sp("mushSpots", "Bintik Jamur", [Ci(318, 194, 8), Ci(352, 188, 7)], discAt("hmspot", "Bintik Jamur", "mushSpots", 318, 194, 8, 0.3)),
      sp("owlEyes", "Mata Burung Hantu", [Ci(232, 128, 13), Ci(262, 128, 13)], discAt("hoeyes", "Mata Burung Hantu", "owlEyes", 247, 128, 22, 0.3))),
    [miniBuddy(247, 156, 0.72, { ear: "pointy", belly: true, merges: { ears: "body", belly: "body" } }),
     prefixArt(miniBuddy(300, 240, 0.66, { ear: "round", belly: true, merges: { ears: "body", belly: "body" } }), "bun")],
    [{ el: Pa("M240 142 L254 142 L247 152 Z"), fill: "#F4842B", stroke: INK, sw: 2 }]),
  scene({ id: "ss-pasar-pagi", name: "Pasar Pagi", collection: "magical-garden", blurb: "Dua kios pasar pagi yang menjual buah, sayur, dan bunga segar.", band: "4-5th", who: "pasar pagimu" },
    mergePieces(elSun("sun", 240, 44, 24), elCloud("cloud", 70, 54, 0.8), elGroundBand("ground", "Tanah", 270),
      sp("awning1", "Tenda Kios Satu", [Pa("M56 122 L216 122 L194 156 L78 156 Z")], prismAt("pawning1", "Tenda Kios Satu", "awning1", [[-0.5, 0.08], [0.5, 0.08], [0.38, -0.1], [-0.38, -0.1]], 136, 139, 0.05)),
      sp("stall1", "Meja Kios Satu", [Rc(66, 206, 140, 46, 7)], boxAt("pstall1", "Meja Kios Satu", "stall1", 0.85, 0.28, 0.42, 136, 229)),
      sp("awning2", "Tenda Kios Dua", [Pa("M264 122 L424 122 L402 156 L286 156 Z")], prismAt("pawning2", "Tenda Kios Dua", "awning2", [[-0.5, 0.08], [0.5, 0.08], [0.38, -0.1], [-0.38, -0.1]], 344, 139, 0.05)),
      sp("stall2", "Meja Kios Dua", [Rc(274, 206, 140, 46, 7)], boxAt("pstall2", "Meja Kios Dua", "stall2", 0.85, 0.28, 0.42, 344, 229)),
      sp("apples", "Apel", [Ci(96, 190, 13), Ci(122, 184, 13), Ci(109, 172, 12)], ballAt("papples", "Apel", "apples", 109, 184, 13, 0.25)),
      sp("oranges", "Jeruk", [Ci(152, 190, 13), Ci(178, 184, 13), Ci(165, 172, 12)], ballAt("poranges", "Jeruk", "oranges", 165, 184, 13, 0.25)),
      sp("carrots", "Wortel", [Pa("M298 176 L318 176 L308 204 Z"), Pa("M326 176 L346 176 L336 204 Z"), Pa("M312 174 C306 160 296 152 286 152 C294 142 308 146 312 158 C316 144 330 140 340 148 C328 154 320 164 318 176 Z")], prismAt("pcarrots", "Wortel", "carrots", [[-0.2, 0.16], [0.2, 0.16], [0, -0.18]], 322, 182, 0.25)),
      sp("flowersStall", "Bunga Segar", [...petalEls(376, 182, 5, 10, 7, 7), Ci(376, 182, 5), ...petalEls(402, 190, 5, 9, 6, 6), Ci(402, 190, 4.5)], ballAt("pflowers", "Bunga Segar", "flowersStall", 388, 186, 13, 0.25)),
      sp("sign", "Papan Nama", [Rc(198, 66, 84, 24, 8)], discAt("psign", "Papan Nama", "sign", 240, 78, 38, 0)),
      sp("basket", "Keranjang Belanja", [Pa("M222 240 L262 240 L254 268 L230 268 Z")], boxAt("pbasket", "Keranjang Belanja", "basket", 0.25, 0.17, 0.2, 242, 254)),
      sp("scale", "Timbangan", [Rc(232, 196, 20, 22, 4), Pa("M222 196 L262 196 L252 182 L232 182 Z"), Ci(242, 189, 5)], boxAt("pscale", "Timbangan", "scale", 0.13, 0.14, 0.12, 242, 200))),
    []),
  scene({ id: "ss-sirkus-besar", name: "Sirkus Besar", collection: "magical-garden", blurb: "Tenda sirkus besar dengan gajah penyeimbang bola dan panggung drum.", band: "4-5th", who: "sirkus besarmu" },
    mergePieces(elGroundBand("ground", "Tanah", 266), elSun("sun", 60, 52, 25), elCloud("cloud", 408, 54, 0.85),
      sp("tent", "Tenda", [Pa("M96 266 L226 100 L356 266 Z")], prismAt("btent", "Tenda", "tent", [[-0.8, -0.5], [0, 0.52], [0.8, -0.5]], 226, 184, -0.05)),
      sp("tentStripes", "Garis Tenda", [Pa("M186 152 L226 100 L266 152 L258 266 L194 266 Z")], prismAt("bstripes", "Garis Tenda", "tentStripes", [[-0.26, -0.5], [0, 0.52], [0.26, -0.5], [0.17, -0.5], [-0.17, -0.5]], 226, 184, 0.02)),
      sp("tentRoof", "Atap Tenda", [Pa("M186 104 L226 58 L266 104 Z")], conePart({ id: "broof", label: "Atap Tenda", assembly: "Gulung atap tenda menjadi kerucut di puncak tenda.", r: 0.26, h: 0.3, region: "tentRoof", transform: { t: [MX(226), MY(84), 0] } })),
      sp("tentFlag", "Bendera", [Pa("M226 58 L226 32 L254 41 L226 52 Z")], prismAt("bflag", "Bendera", "tentFlag", [[0, 0.07], [0.17, 0], [0, -0.07]], 239, 42, 0.05)),
      sp("entrance", "Pintu Masuk", [Pa("M226 178 L252 266 L200 266 Z")], prismAt("bdoor", "Pintu Masuk", "entrance", [[-0.16, -0.27], [0, 0.29], [0.16, -0.27]], 226, 222, 0.06)),
      sp("stage", "Panggung Drum", [Rc(356, 240, 62, 26, 8)], cylPart({ id: "bstage", label: "Panggung Drum", assembly: "Gulung panggung drum menjadi tabung pendek.", r: 0.2, h: 0.16, region: "stage", transform: { t: [MX(387), MY(253), 0.15] } })),
      sp("ballBig", "Bola Besar", [Ci(387, 208, 30)], ballAt("bballbig", "Bola Besar", "ballBig", 387, 208, 29, 0.1)),
      sp("ballSmall", "Bola Kecil", [Ci(96, 244, 16)], ballAt("bballsmall", "Bola Kecil", "ballSmall", 96, 244, 16, 0.15)),
      sp("hoop", "Lingkaran Akrobat", [Pa("M52 176 C52 148 76 128 102 128 C128 128 152 148 152 176 C152 204 128 224 102 224 C76 224 52 204 52 176 Z M68 176 C68 158 84 144 102 144 C120 144 136 158 136 176 C136 194 120 208 102 208 C84 208 68 194 68 176 Z")], prismAt("bhoop", "Lingkaran Akrobat", "hoop", [[-0.3, 0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, -0.3], [-0.18, -0.18], [0.18, -0.18], [0.18, 0.18], [-0.18, 0.18]], 102, 176, -0.02)),
      sp("banner1", "Umbul-umbul Satu", [Pa("M60 84 L150 66 L148 82 L62 98 Z"), Pa("M84 82 L92 96 L104 79 Z"), Pa("M112 75 L120 89 L132 72 Z")], prismAt("bbanner1", "Umbul-umbul Satu", "banner1", [[-0.28, 0.06], [0.28, -0.04], [0.28, -0.12], [-0.28, -0.02]], 105, 82, -0.1)),
      sp("banner2", "Umbul-umbul Dua", [Pa("M330 66 L420 84 L418 98 L332 82 Z"), Pa("M352 72 L360 89 L372 75 Z"), Pa("M384 79 L392 96 L404 82 Z")], prismAt("bbanner2", "Umbul-umbul Dua", "banner2", [[-0.28, -0.04], [0.28, 0.06], [0.28, -0.02], [-0.28, -0.12]], 375, 82, -0.1)),
      sp("eleBody", "Badan Gajah", [E(387, 158, 34, 28)], ballPart({ id: "belebody", label: "Badan Gajah", assembly: "Buat bola badan gajah yang berdiri di atas bola besar.", r: 0.22, region: "eleBody", transform: { s: [1.15, 0.95, 0.9], t: [MX(387), MY(158), 0.1] } })),
      sp("eleEars", "Telinga Gajah", [Ci(360, 142, 13), Ci(414, 142, 13)], ballAt("beleears", "Telinga Gajah", "eleEars", 360, 142, 12, 0.1)),
      sp("eleTrunk", "Belalai Gajah", [Pa("M380 168 C376 182 380 194 390 200 L398 192 C390 186 388 176 390 168 Z")], prismAt("beletrunk", "Belalai Gajah", "eleTrunk", [[-0.05, 0.11], [0.05, 0.11], [0.04, -0.11], [-0.04, -0.11]], 387, 184, 0.28))),
    [], [{ el: Ci(394, 152, 4), fill: INK }]),
  scene({ id: "ss-pelabuhan-besar", name: "Pelabuhan Besar", collection: "little-vehicles", blurb: "Kapal besar dan perahu kecil berlabuh di dermaga yang sibuk.", band: "4-5th", who: "pelabuhanmu" },
    mergePieces(elGroundBand("sea", "Laut", 240), elSun("sun", 66, 52, 25), elCloud("cloud", 250, 50, 0.85),
      sp("dock", "Dermaga", [Rc(40, 262, 400, 16, 5)], boxAt("pdock", "Dermaga", "dock", 2.4, 0.1, 0.5, 240, 270)),
      sp("tower", "Menara Mercusuar", [Pa("M52 262 L60 140 L84 140 L92 262 Z")], prismAt("ptower", "Menara Mercusuar", "tower", [[-0.12, 0.38], [0.12, 0.38], [0.09, -0.38], [-0.09, -0.38]], 72, 201, -0.05)),
      sp("lamp", "Lampu Mercusuar", [Rc(58, 108, 28, 32, 6), Pa("M56 110 L72 90 L88 110 Z")], boxAt("plamp", "Lampu Mercusuar", "lamp", 0.17, 0.2, 0.17, 72, 124)),
      sp("shipHull", "Lambung Kapal", [Pa("M140 226 L330 226 L306 262 L164 262 Z")], boxAt("pshiphull", "Lambung Kapal", "shipHull", 1.15, 0.24, 0.5, 235, 244)),
      sp("shipDeck", "Dek Kapal", [Rc(156, 204, 158, 22, 7)], boxAt("pshipdeck", "Dek Kapal", "shipDeck", 0.95, 0.14, 0.48, 235, 215)),
      sp("shipCabin", "Kabin Kapal", [Rc(176, 158, 96, 48, 7)], boxAt("pshipcabin", "Kabin Kapal", "shipCabin", 0.58, 0.29, 0.44, 224, 182)),
      sp("shipWindows", "Jendela Kapal", [Ci(194, 180, 8), Ci(220, 180, 8), Ci(246, 180, 8)], discAt("pshipwin", "Jendela Kapal", "shipWindows", 220, 180, 28, 0.24)),
      sp("shipFunnel", "Cerobong Kapal", [Rc(286, 132, 24, 46, 5)], cylPart({ id: "pfunnel", label: "Cerobong Kapal", assembly: "Gulung cerobong kapal menjadi tabung tegak.", r: 0.08, h: 0.29, region: "shipFunnel", transform: { t: [MX(298), MY(155), 0] } })),
      sp("boatHull", "Lambung Perahu", [Pa("M356 240 L436 240 L420 262 L372 262 Z")], boxAt("pboathull", "Lambung Perahu", "boatHull", 0.48, 0.15, 0.34, 396, 251)),
      sp("boatSail", "Layar Perahu", [Pa("M394 238 L394 178 L356 238 Z"), Pa("M404 196 L404 238 L430 238 Z")], prismAt("pboatsail", "Layar Perahu", "boatSail", [[-0.24, -0.2], [0, 0.22], [0.24, -0.2]], 396, 210, 0)),
      sp("crane", "Derek", [Rc(112, 108, 10, 120, 4), Rc(112, 108, 74, 10, 4), Pa("M176 118 L176 148"), Rc(164, 148, 24, 18, 4)], prismAt("pcrane", "Derek", "crane", [[-0.24, 0.38], [-0.14, 0.38], [-0.14, -0.3], [0.24, -0.3], [0.24, -0.38], [-0.24, -0.38]], 148, 168, -0.1))),
    []),
  scene({ id: "ss-gunung-danau", name: "Gunung & Danau", collection: "magical-garden", blurb: "Kabin kayu di tepi danau dengan perahu layar kecil.", band: "4-5th", who: "danau gunungmu" },
    mergePieces(elMountain("mountain1", 96, 246, 190, 175), elSnowcap("snowcap1", 96, 71, 68), elMountain("mountain2", 398, 246, 150, 120), elPond("lake", 245, 282, 150, "Danau"), elSun("sun", 250, 48, 24), elCloud("cloud", 356, 56, 0.8), elFlower("flowers", 130, 268, 0.9),
      sp("pine1", "Pinus Satu", [Pa("M52 246 L72 176 L92 246 Z"), Rc(67, 246, 10, 16, 3)], prismAt("gpine1", "Pinus Satu", "pine1", [[-0.13, -0.24], [0, 0.26], [0.13, -0.24]], 72, 214, 0)),
      sp("pine2", "Pinus Dua", [Pa("M330 250 L348 188 L366 250 Z"), Rc(343, 250, 10, 14, 3)], prismAt("gpine2", "Pinus Dua", "pine2", [[-0.11, -0.2], [0, 0.22], [0.11, -0.2]], 348, 222, 0)),
      elHouseMini("cabinWalls", "cabinRoof", 168, 258, 0.8),
      boatPieces({ sail: true, x: 300, y: 262 })),
    []),
  scene({ id: "ss-kutub", name: "Dunia Kutub", collection: "animal-friends", blurb: "Penguin, beruang kutub, dan anjing laut bermain di es.", band: "4-5th", who: "dunia kutubmu" },
    mergePieces(elSun("moon", 70, 54, 24), elPine("pine", 420, 258, 0.85), elGroundBand("snow", "Salju", 258), elPond("ice", 130, 282, 80, "Es"),
      sp("aurora", "Aurora", [Pa("M120 44 C180 20 260 30 320 16 C300 44 240 52 180 44 C150 52 128 52 120 44 Z"), Pa("M150 66 C210 46 280 54 330 44 C306 66 240 74 190 66 C168 72 156 72 150 66 Z")], prismAt("iaurora", "Aurora", "aurora", [[-0.65, 0.05], [0, 0.16], [0.65, 0.05], [0.4, -0.1], [-0.4, -0.1]], 226, 40, -0.25)),
      sp("igloo", "Iglo", [Pa("M316 258 C320 214 352 188 388 188 C424 188 456 214 460 258 Z")], ballPart({ id: "iigloo", label: "Iglo", assembly: "Buat setengah bola iglo besar.", r: 0.45, region: "igloo", transform: { s: [1.15, 0.75, 0.9], t: [MX(388), MY(228), -0.12] } })),
      sp("iglooDoor", "Pintu Iglo", [Pa("M372 258 L372 230 C372 218 404 218 404 230 L404 258 Z")], prismAt("iidoor", "Pintu Iglo", "iglooDoor", [[-0.1, -0.13], [0.1, -0.13], [0.1, 0.07], [0, 0.13], [-0.1, 0.07]], 388, 240, 0.05)),
      sp("scarf", "Syal Penguin", [Pa("M138 176 C150 168 174 168 186 176 L182 190 C172 182 152 182 142 190 Z"), Rc(172, 184, 11, 24, 5)], prismAt("iscarf", "Syal Penguin", "scarf", [[-0.16, 0.05], [0.16, 0.05], [0.12, -0.07], [-0.12, -0.07]], 162, 178, 0.32)),
      sp("sealBody", "Badan Anjing Laut", [Pa("M52 258 C60 232 92 218 128 222 C160 226 180 240 178 254 C150 264 76 266 52 258 Z")], ballPart({ id: "isealbody", label: "Badan Anjing Laut", assembly: "Buat bola badan anjing laut yang pipih memanjang.", r: 0.3, region: "sealBody", transform: { s: [1.5, 0.62, 0.9], t: [MX(115), MY(244), 0.1] } })),
      sp("sealHead", "Kepala Anjing Laut", [Ci(178, 226, 17)], ballAt("isealhead", "Kepala Anjing Laut", "sealHead", 178, 226, 16, 0.12))),
    [miniBuddy(162, 214, 0.85, { ear: "none", belly: true, merges: { belly: "body" } }),
     prefixArt(miniBuddy(268, 222, 0.8, { ear: "round", muzzle: true, merges: { ears: "body", muzzle: "body" } }), "bear")],
    [{ el: Ci(182, 222, 3.4), fill: INK }, { el: Ci(156, 202, 4), fill: INK }]),
  scene({ id: "ss-dapur-kue", name: "Dapur Kue", collection: "magical-garden", blurb: "Dapur hangat tempat kue, cupcake, dan teh disiapkan.", band: "4-5th", who: "dapur kuemu" },
    mergePieces(
      sp("window", "Jendela", [Rc(56, 66, 84, 84, 8), Pa("M98 66 L98 150 M56 108 L140 108")], boxAt("dwin", "Jendela", "window", 0.5, 0.5, 0.1, 98, 108)),
      sp("curtain", "Tirai", [Pa("M56 66 L140 66 L140 88 C120 78 76 78 56 88 Z")], prismAt("dcurtain", "Tirai", "curtain", [[-0.26, 0.08], [0.26, 0.08], [0.2, -0.06], [-0.2, -0.06]], 98, 76, 0.08)),
      sp("shelf", "Rak", [Rc(300, 84, 130, 10, 4), Rc(312, 58, 20, 26, 4), Rc(344, 52, 24, 32, 4), Rc(380, 60, 20, 24, 4)], boxAt("dshelf", "Rak", "shelf", 0.78, 0.08, 0.2, 365, 89)),
      sp("table", "Meja", [Rc(90, 236, 300, 14, 6), Rc(104, 250, 12, 44, 5), Rc(364, 250, 12, 44, 5)], boxAt("dtable", "Meja", "table", 1.8, 0.1, 0.6, 240, 243)),
      sp("plate", "Piring Kue", [E(170, 234, 62, 9)], discAt("dplate", "Piring Kue", "plate", 170, 234, 56, 0.05)),
      sp("layer1", "Lapis Bawah", [Rc(122, 196, 96, 36, 8)], boxAt("dlayer1", "Lapis Bawah", "layer1", 0.58, 0.22, 0.42, 170, 214)),
      sp("layer2", "Lapis Atas", [Rc(136, 164, 68, 34, 8)], boxAt("dlayer2", "Lapis Atas", "layer2", 0.41, 0.2, 0.38, 170, 181)),
      sp("frosting", "Krim Kue", [Pa("M136 164 L204 164 L204 174 C194 166 184 178 172 168 C160 178 148 166 140 174 C136 172 136 168 136 164 Z")], prismAt("dfrost", "Krim Kue", "frosting", [[-0.22, 0.04], [0.22, 0.04], [0.18, -0.05], [-0.18, -0.05]], 170, 169, 0.22)),
      sp("candles", "Lilin", [Rc(152, 132, 8, 26, 3), Rc(176, 128, 8, 30, 3)], cylPart({ id: "dcandle", label: "Lilin", assembly: "Gulung lilin-lilin kecil dan berdirikan di atas kue.", r: 0.03, h: 0.17, region: "candles", transform: { t: [MX(156), MY(145), 0.1] } })),
      sp("cherry", "Ceri", [Ci(170, 158, 8)], ballAt("dcherry", "Ceri", "cherry", 170, 158, 8, 0.15)),
      sp("cupcake", "Cupcake", [Pa("M252 236 L292 236 L284 204 L260 204 Z"), Pa("M248 206 C240 186 254 172 264 180 C268 166 286 164 292 178 C304 172 316 186 308 206 C290 198 266 198 248 206 Z"), Ci(278, 168, 8)], ballPart({ id: "dcupcake", label: "Cupcake", assembly: "Buat cupcake kecil lengkap dengan krim dan cerinya.", r: 0.2, region: "cupcake", transform: { s: [1, 1.1, 0.9], t: [MX(278), MY(204), 0.1] } })),
      sp("teapotBody", "Badan Teko", [Pa("M330 236 C324 206 340 184 366 184 C392 184 408 206 402 236 C384 246 348 246 330 236 Z"), Pa("M402 202 C420 196 434 204 434 218 C434 230 422 238 408 234")], ballPart({ id: "dteapot", label: "Badan Teko", assembly: "Buat bola badan teko yang gemuk.", r: 0.26, region: "teapotBody", transform: { s: [1.05, 0.9, 0.9], t: [MX(366), MY(212), 0.1] } })),
      sp("teapotLid", "Tutup Teko", [Pa("M344 186 C350 172 382 172 388 186 C374 192 358 192 344 186 Z")], ballPart({ id: "dlid", label: "Tutup Teko", assembly: "Buat tutup teko pipih di atas badannya.", r: 0.15, region: "teapotLid", transform: { s: [1.1, 0.5, 1], t: [MX(366), MY(182), 0.1] } })),
      sp("cup", "Cangkir", [Pa("M96 282 L144 282 L138 306 L102 306 Z"), Pa("M144 288 C156 284 164 290 162 298 C160 306 150 308 142 304")], boxAt("dcup", "Cangkir", "cup", 0.3, 0.15, 0.24, 120, 294)),
      sp("cookies", "Kue Kering", [Ci(196, 282, 15), Ci(228, 288, 13)], ballPart({ id: "dcookies", label: "Kue Kering", assembly: "Buat kue kering bundar di atas meja.", r: 0.1, region: "cookies", transform: { s: [1, 0.5, 1], t: [MX(196), MY(282), 0.2] } })),
      sp("jar", "Toples", [Rc(316, 262, 30, 40, 6), Rc(312, 254, 38, 10, 4)], boxAt("djar", "Toples", "jar", 0.19, 0.25, 0.17, 331, 282))),
    []),
  scene({ id: "ss-perpustakaan", name: "Perpustakaan Kecil", collection: "little-homes", blurb: "Perpustakaan kecil dengan jam besar dan tumpukan buku cerita.", band: "4-5th", who: "perpustakaanmu" },
    mergePieces(elSun("sun", 404, 52, 24), elCloud("cloud", 80, 54, 0.85), elGroundBand("grass", "Rumput"), elGroundBand("path", "Jalan Setapak", 282),
      sp("libWalls", "Dinding Perpustakaan", [Rc(150, 148, 180, 104, 7)], boxAt("lwalls", "Dinding Perpustakaan", "libWalls", 1.1, 0.63, 0.55, 240, 200)),
      sp("libRoof", "Atap Perpustakaan", [Pa("M134 150 L240 84 L346 150 Z")], prismAt("lroof", "Atap Perpustakaan", "libRoof", [[-0.66, -0.18], [0, 0.24], [0.66, -0.18]], 240, 118, 0)),
      sp("libSign", "Papan Nama", [Rc(196, 158, 88, 24, 8)], discAt("lsign", "Papan Nama", "libSign", 240, 170, 40, 0.3)),
      sp("libDoor", "Pintu", [Pa("M222 252 L222 206 C222 194 258 194 258 206 L258 252 Z")], discAt("ldoor", "Pintu", "libDoor", 240, 224, 17, 0.3)),
      sp("libWindows", "Jendela", [Rc(168, 196, 30, 36, 6), Rc(282, 196, 30, 36, 6)], discAt("lwin", "Jendela", "libWindows", 240, 214, 66, 0.3)),
      sp("clock", "Jam Besar", [Ci(240, 116, 17)], discAt("lclock", "Jam Besar", "clock", 240, 116, 16, 0.15)),
      elTreeCanopy("canopy", 74, 130, 32), elTrunk("trunk", 74, 158, 250, 9),
      sp("bench", "Bangku Baca", [Rc(356, 232, 70, 9, 4), Rc(362, 214, 58, 9, 4), Rc(362, 241, 8, 20, 3), Rc(412, 241, 8, 20, 3)], boxAt("lbench", "Bangku Baca", "bench", 0.42, 0.12, 0.2, 391, 232)),
      sp("lamp", "Lampu Taman", [Rc(118, 196, 7, 56, 3), Ci(121, 186, 11)], prismAt("llamp", "Lampu Taman", "lamp", [[-0.04, 0.2], [0.04, 0.2], [0.04, -0.2], [-0.04, -0.2]], 121, 220, 0.1)),
      sp("books", "Tumpukan Buku", [Rc(352, 262, 52, 12, 3), Rc(358, 250, 44, 12, 3), Rc(364, 238, 36, 12, 3)], boxAt("lbooks", "Tumpukan Buku", "books", 0.32, 0.1, 0.24, 378, 268))),
    [], [{ el: Pa("M240 116 L240 104 M240 116 L250 122"), stroke: INK, sw: 3.5 }, { el: Ci(240, 116, 2.6), fill: INK }]),
  scene({ id: "ss-kebun-raya", name: "Kebun Raya", collection: "magical-garden", blurb: "Rumah kaca besar dengan bunga raksasa dan bebek di kolam.", band: "4-5th", who: "kebun rayamu" },
    mergePieces(elSun("sun", 66, 52, 25), elGroundBand("path", "Jalan Setapak", 276), elPond("pond", 356, 282, 74), elTreeCanopy("canopy", 430, 108, 30), elTrunk("trunk", 430, 134, 246, 8), elBush("bush", 52, 252, 0.9),
      sp("glass", "Rumah Kaca", [Pa("M120 236 L120 130 C120 92 168 62 226 62 C284 62 332 92 332 130 L332 236 Z")], boxPart({ id: "ggglass", label: "Rumah Kaca", assembly: "Lipat rumah kaca menjadi bangunan melengkung.", w: 1.3, h: 1.05, d: 0.6, regions: { front: "glass", back: "glass", left: "glass", right: "glass", top: "glass", bottom: "glass" }, transform: { t: [MX(226), MY(149), -0.1] }, splitWalls: true })),
      sp("glassFrame", "Rangka Kaca", [Pa("M226 62 L226 236 M120 150 L332 150 M120 196 L332 196"), Rc(116, 232, 220, 8, 3)], prismAt("gframe", "Rangka Kaca", "glassFrame", [[-0.68, 0.5], [0.68, 0.5], [0.68, -0.52], [-0.68, -0.52], [-0.6, -0.52], [0.6, -0.52], [0.6, 0.42], [-0.6, 0.42]], 226, 149, 0.32)),
      sp("glassDoor", "Pintu Kaca", [Rc(206, 182, 40, 54, 6)], discAt("gdoor", "Pintu Kaca", "glassDoor", 226, 209, 19, 0.34)),
      sp("bigPetals", "Kelopak Raksasa", [...petalEls(96, 168, 6, 26, 16, 16)], ballPart({ id: "gbigpet", label: "Kelopak Raksasa", assembly: "Buat bola kelopak raksasa yang pipih.", r: 0.26, region: "bigPetals", transform: { s: [1.2, 1.2, 0.45], t: [MX(96), MY(168), 0.1] } })),
      sp("bigCenter", "Tengah Bunga Raksasa", [Ci(96, 168, 15)], discAt("gbigcen", "Tengah Bunga Raksasa", "bigCenter", 96, 168, 14, 0.24)),
      sp("sunPetals", "Kelopak Matahari", [...petalEls(368, 120, 8, 22, 11, 11)], ballPart({ id: "gsunpet", label: "Kelopak Matahari", assembly: "Buat bola kelopak bunga matahari.", r: 0.22, region: "sunPetals", transform: { s: [1.2, 1.2, 0.45], t: [MX(368), MY(120), 0.05] } })),
      sp("sunCenter", "Tengah Bunga Matahari", [Ci(368, 120, 13)], discAt("gsuncen", "Tengah Bunga Matahari", "sunCenter", 368, 120, 12, 0.2)),
      sp("tulips", "Tulip", [Pa("M140 262 C134 244 138 228 148 220 L152 232 L158 218 L164 232 L168 220 C178 228 182 244 176 262 Z"), Pa("M196 266 C190 248 194 232 204 224 L208 236 L214 222 L220 236 L224 224 C234 232 238 248 232 266 Z")], prismAt("gtulips", "Tulip", "tulips", [[-0.3, -0.12], [-0.05, 0.14], [0.05, -0.14], [0.3, -0.12], [0.24, 0.14], [-0.24, 0.14]], 186, 244, 0.15)),
      sp("duckBody", "Badan Bebek", [Pa("M316 268 C320 250 338 238 358 238 C378 238 392 250 394 266 C384 278 326 280 316 268 Z")], ballPart({ id: "gduck", label: "Badan Bebek", assembly: "Buat bola badan bebek yang pipih di kolam.", r: 0.25, region: "duckBody", transform: { s: [1.2, 0.8, 0.85], t: [MX(355), MY(258), 0.2] } })),
      sp("duckHead", "Kepala Bebek", [Ci(388, 232, 15)], ballAt("gduckhead", "Kepala Bebek", "duckHead", 388, 232, 14, 0.2))),
    [], [{ el: Ci(392, 228, 3.4), fill: INK }, { el: Pa("M400 234 L416 239 L400 245 Z"), fill: "#F4842B", stroke: INK, sw: 2 }, { el: Pa("M186 236 L186 262 M214 240 L214 266"), stroke: INK, sw: 3.5 }]),
  scene({ id: "ss-dunia-permen", name: "Negeri Permen", collection: "magical-garden", blurb: "Rumah permen dengan lolipop raksasa dan sungai cokelat.", band: "4-5th", who: "negeri permenmu" },
    mergePieces(elSun("sun", 70, 52, 25), elCloud("cloud", 380, 54, 0.85), elGroundBand("path", "Jalan Gula", 276), elPond("river", 110, 288, 76, "Sungai Cokelat"),
      sp("candyWalls", "Dinding Rumah Permen", [Rc(196, 168, 110, 78, 7)], boxAt("nwalls", "Dinding Rumah Permen", "candyWalls", 0.67, 0.47, 0.5, 251, 207)),
      sp("candyRoof", "Atap Krim", [Pa("M184 170 L251 112 L318 170 C296 158 206 158 184 170 Z")], prismAt("nroof", "Atap Krim", "candyRoof", [[-0.42, -0.1], [0, 0.2], [0.42, -0.1], [0.3, -0.16], [-0.3, -0.16]], 251, 142, 0)),
      sp("candyDoor", "Pintu Permen", [Pa("M236 246 L236 208 C236 196 266 196 266 208 L266 246 Z")], discAt("ndoor", "Pintu Permen", "candyDoor", 251, 222, 14, 0.27)),
      sp("candyWindows", "Jendela Permen", [Ci(218, 196, 11), Ci(284, 196, 11)], discAt("nwin", "Jendela Permen", "candyWindows", 251, 196, 34, 0.27)),
      sp("lollipop1", "Lolipop Raksasa", [Ci(140, 128, 34), Rc(135, 160, 10, 66, 5)], ballPart({ id: "nlol1", label: "Lolipop Raksasa", assembly: "Buat bola lolipop raksasa pipih di batang tinggi.", r: 0.22, region: "lollipop1", transform: { s: [1, 1, 0.45], t: [MX(140), MY(128), 0.05] } })),
      sp("lollipop2", "Lolipop Kecil", [Ci(368, 148, 24), Rc(364, 170, 8, 50, 4)], ballPart({ id: "nlol2", label: "Lolipop Kecil", assembly: "Buat bola lolipop kecil pipih di batang pendek.", r: 0.16, region: "lollipop2", transform: { s: [1, 1, 0.45], t: [MX(368), MY(148), 0.05] } })),
      sp("candyCanes", "Tongkat Permen", [Pa("M330 246 C322 220 326 196 342 188 L350 200 C340 206 336 222 340 244 Z"), Pa("M392 250 C386 226 392 206 406 198 L412 210 C402 216 398 230 402 248 Z")], prismAt("ncanes", "Tongkat Permen", "candyCanes", [[-0.26, -0.18], [-0.08, 0.2], [0.08, -0.2], [0.26, -0.16], [0.2, 0.18], [-0.2, 0.18]], 371, 224, 0.05)),
      sp("cupcakeHouse", "Rumah Cupcake", [Pa("M52 246 L96 246 L88 208 L60 208 Z"), Pa("M46 210 C38 190 52 176 64 182 C68 168 86 166 92 178 C104 172 116 188 108 210 C90 202 64 202 46 210 Z"), Ci(74, 170, 8)], ballPart({ id: "ncuphouse", label: "Rumah Cupcake", assembly: "Buat rumah cupcake kecil dengan ceri di atapnya.", r: 0.2, region: "cupcakeHouse", transform: { s: [1, 1.05, 0.9], t: [MX(74), MY(208), 0.1] } })),
      sp("gumdrops", "Semak Permen Karet", [Pa("M150 262 C152 244 166 232 182 234 C196 232 208 244 210 262 Z"), Pa("M300 266 C302 250 314 240 328 242 C342 240 352 252 354 266 Z")], ballPart({ id: "ngum", label: "Semak Permen Karet", assembly: "Buat gumpalan semak permen karet yang pipih.", r: 0.19, region: "gumdrops", transform: { s: [1.15, 0.7, 0.9], t: [MX(180), MY(250), 0.15] } })),
      sp("candyFence", "Pagar Permen", [Rc(120, 252, 56, 8, 3), Rc(326, 252, 56, 8, 3), Rc(126, 240, 8, 24, 3), Rc(152, 240, 8, 24, 3), Rc(332, 240, 8, 24, 3), Rc(358, 240, 8, 24, 3)], prismAt("nfence", "Pagar Permen", "candyFence", [[-0.8, 0.06], [0.8, 0.06], [0.8, -0.06], [-0.8, -0.06]], 251, 252, 0.1))),
    [], [{ el: Pa("M140 128 m-20 0 C142 112 160 114 161 128 C162 143 146 150 139 138"), stroke: INK, sw: 3.5 }]),
  scene({ id: "ss-pesta-taman", name: "Pesta di Taman", collection: "magical-garden", blurb: "Meja pesta dengan kue, balon, dan bendera umbul-umbul.", band: "4-5th", who: "pesta tamanmu" },
    mergePieces(elSun("sun", 404, 52, 25), elCloud("cloud", 84, 56, 0.85), elGroundBand("grass", "Rumput"), elTreeCanopy("canopy", 60, 120, 32), elTrunk("trunk", 60, 148, 252, 9), elBush("bush", 424, 252, 0.9), elFlower("flower", 140, 266, 0.9), elFlower("flower2", 352, 268, 0.85),
      sp("bunting", "Umbul-umbul", [Pa("M96 84 C180 108 300 108 384 84 L384 96 C300 120 180 120 96 96 Z"), Pa("M150 96 L162 114 L174 100 Z"), Pa("M226 106 L238 124 L250 107 Z"), Pa("M302 100 L314 117 L326 96 Z")], prismAt("tbunting", "Umbul-umbul", "bunting", [[-0.9, 0.08], [0, -0.04], [0.9, 0.08], [0.85, -0.04], [-0.85, -0.04]], 240, 100, -0.15)),
      sp("balloons", "Balon Pesta", [E(120, 140, 20, 25), E(152, 124, 17, 22), E(356, 132, 19, 24)], ballPart({ id: "tballoons", label: "Balon Pesta", assembly: "Buat bola-bola balon pesta yang pipih.", r: 0.14, region: "balloons", transform: { s: [0.9, 1.1, 0.6], t: [MX(136), MY(132), 0.1] } })),
      sp("table", "Meja Pesta", [Rc(160, 216, 160, 12, 5), Rc(172, 228, 10, 40, 4), Rc(298, 228, 10, 40, 4)], boxAt("ttable", "Meja Pesta", "table", 0.97, 0.09, 0.5, 240, 222)),
      sp("cakePlate", "Piring Kue", [E(216, 214, 44, 7)], discAt("tcakeplate", "Piring Kue", "cakePlate", 216, 214, 40, 0.1)),
      sp("cake", "Kue Pesta", [Rc(184, 178, 64, 34, 7)], boxAt("tcake", "Kue Pesta", "cake", 0.39, 0.21, 0.34, 216, 195)),
      sp("cakeCandles", "Lilin Kue", [Rc(200, 152, 7, 22, 3), Rc(214, 148, 7, 26, 3), Rc(228, 152, 7, 22, 3)], cylPart({ id: "tcandles", label: "Lilin Kue", assembly: "Gulung lilin-lilin kue dan berdirikan di atas kue.", r: 0.028, h: 0.15, region: "cakeCandles", transform: { t: [MX(207), MY(163), 0.1] } })),
      sp("gifts", "Kotak Hadiah", [Rc(268, 192, 30, 24, 4), Rc(266, 184, 34, 9, 3), Rc(306, 200, 24, 18, 4), Rc(304, 193, 28, 8, 3)], boxAt("tgifts", "Kotak Hadiah", "gifts", 0.2, 0.16, 0.18, 283, 200)),
      sp("chair", "Kursi", [Rc(128, 216, 9, 44, 4), Rc(128, 216, 30, 9, 4), Rc(128, 238, 30, 8, 4)], boxAt("tchair", "Kursi", "chair", 0.19, 0.28, 0.16, 143, 238)),
      sp("jug", "Teko Jus", [Pa("M330 216 L362 216 L358 192 L334 192 Z"), Pa("M358 198 C368 194 376 200 374 208 C372 216 364 218 357 214")], boxAt("tjug", "Teko Jus", "jug", 0.19, 0.15, 0.16, 346, 204))),
    [], [{ el: E(203, 146, 4.5, 7), fill: "#FFC93C", stroke: INK, sw: 2 }, { el: E(217, 141, 4.5, 7), fill: "#FFC93C", stroke: INK, sw: 2 }, { el: E(231, 146, 4.5, 7), fill: "#FFC93C", stroke: INK, sw: 2 }]),
];

const L5B: TemplateDef[] = [
  scene({ id: "ss-stasiun-kereta", name: "Stasiun Kereta Api", collection: "little-vehicles", blurb: "Kereta panjang berhenti di peron stasiun yang ramai.", band: "4-5th", who: "stasiun keretamu" },
    mergePieces(elSun("sun", 66, 52, 24), elCloud("cloud", 380, 50, 0.85), elGroundBand("platform", "Peron", 268),
      sp("stationWalls", "Dinding Stasiun", [Rc(56, 128, 128, 96, 7)], boxAt("swalls", "Dinding Stasiun", "stationWalls", 0.78, 0.58, 0.5, 120, 176)),
      sp("stationRoof", "Atap Stasiun", [Pa("M44 130 L120 76 L196 130 Z")], prismAt("sroof", "Atap Stasiun", "stationRoof", [[-0.48, -0.16], [0, 0.2], [0.48, -0.16]], 120, 104, 0)),
      sp("stationClock", "Jam Stasiun", [Ci(120, 148, 15)], discAt("sclock", "Jam Stasiun", "stationClock", 120, 148, 14, 0.3)),
      sp("stationSign", "Papan Nama Stasiun", [Rc(84, 182, 72, 20, 7)], discAt("ssign", "Papan Nama Stasiun", "stationSign", 120, 192, 33, 0.3)),
      elTreeCanopy("canopy", 420, 116, 30), elTrunk("trunk", 420, 142, 224, 8),
      sp("lamp", "Lampu Peron", [Rc(458, 176, 7, 66, 3), Ci(461, 166, 11)], prismAt("slamp", "Lampu Peron", "lamp", [[-0.04, 0.22], [0.04, 0.22], [0.04, -0.22], [-0.04, -0.22]], 461, 206, 0.1)),
      sp("bench", "Bangku Peron", [Rc(60, 232, 66, 9, 4), Rc(66, 214, 54, 9, 4), Rc(66, 241, 8, 20, 3), Rc(112, 241, 8, 20, 3)], boxAt("sbench", "Bangku Peron", "bench", 0.4, 0.12, 0.2, 93, 232)),
      trainPieces(292, 240, true)),
    [], []),
  scene({ id: "ss-bandara", name: "Bandara Kecil", collection: "space-explorers", blurb: "Pesawat siap lepas landas dari bandara kecil yang cerah.", band: "4-5th", who: "bandaramu" },
    mergePieces(elSun("sun", 404, 52, 25), elCloud("cloud", 90, 54, 0.85), elGroundBand("runway", "Landasan", 268),
      sp("towerTop", "Menara Pengawas", [Rc(64, 96, 52, 30, 6)], boxAt("atower", "Menara Pengawas", "towerTop", 0.32, 0.19, 0.3, 90, 111)),
      sp("towerWindow", "Kaca Menara", [Rc(72, 104, 36, 14, 4)], discAt("atwin", "Kaca Menara", "towerWindow", 90, 111, 16, 0.18)),
      sp("towerPole", "Tiang Menara", [Rc(80, 126, 20, 96, 5)], boxAt("atpole", "Tiang Menara", "towerPole", 0.13, 0.58, 0.14, 90, 174)),
      sp("terminal", "Terminal", [Rc(150, 168, 120, 58, 7)], boxAt("aterm", "Terminal", "terminal", 0.73, 0.35, 0.46, 210, 197)),
      sp("terminalWindows", "Jendela Terminal", [Rc(162, 182, 20, 24, 4), Rc(190, 182, 20, 24, 4), Rc(218, 182, 20, 24, 4)], discAt("atermwin", "Jendela Terminal", "terminalWindows", 200, 194, 36, 0.25)),
      sp("planeBody", "Badan Pesawat", [Pa("M300 236 C296 210 306 192 330 186 L420 172 C440 170 452 182 450 198 C448 216 434 228 412 232 L330 244 C314 246 302 244 300 236 Z")], cylPart({ id: "aplbody", label: "Badan Pesawat", assembly: "Gulung badan pesawat menjadi tabung mendatar.", r: 0.17, h: 0.95, region: "planeBody", transform: { r: [0, 0, Math.PI / 2 - 0.12], t: [MX(376), MY(208), 0.05] } })),
      sp("planeWing", "Sayap Pesawat", [Pa("M352 226 L392 226 L420 258 L366 258 Z")], prismAt("apwing", "Sayap Pesawat", "planeWing", [[-0.22, 0.1], [0.1, 0.1], [0.24, -0.1], [-0.08, -0.1]], 390, 242, 0.1)),
      sp("planeTail", "Ekor Pesawat", [Pa("M306 190 L282 158 L306 154 L322 182 Z")], prismAt("aptail", "Ekor Pesawat", "planeTail", [[-0.08, 0.12], [0.06, -0.12], [0.12, 0.1], [-0.02, 0.12]], 302, 172, 0.05)),
      sp("planeWindows", "Jendela Pesawat", [Ci(352, 202, 6), Ci(374, 198, 6), Ci(396, 194, 6), Ci(418, 190, 6)], discAt("apwin", "Jendela Pesawat", "planeWindows", 385, 196, 34, 0.2)),
      sp("planeStripe", "Garis Pesawat", [Pa("M312 224 C340 216 400 204 440 198 L442 208 C402 216 344 228 314 234 Z")], prismAt("apstripe", "Garis Pesawat", "planeStripe", [[-0.4, 0.06], [0.4, -0.04], [0.4, -0.12], [-0.4, -0.02]], 377, 216, 0.2)),
      sp("cones", "Kerucut Landasan", [Pa("M180 262 L196 262 L188 238 Z"), Pa("M240 264 L256 264 L248 240 Z"), Pa("M300 262 L316 262 L308 238 Z")], prismAt("acones", "Kerucut Landasan", "cones", [[-0.3, 0.08], [0.3, 0.08], [0, -0.1]], 248, 252, 0.15)),
      sp("busBody", "Badan Bus Bandara", [Rc(150, 226, 84, 32, 7)], boxAt("abus", "Badan Bus Bandara", "busBody", 0.51, 0.2, 0.36, 192, 242)),
      sp("busWheels", "Roda Bus", [Ci(168, 260, 10), Ci(216, 260, 10)], cylPart({ id: "abuswheel", label: "Roda Bus", assembly: "Gulung dua roda bus bandara.", r: 0.07, h: 0.07, region: "busWheels", transform: { r: [Math.PI / 2, 0, 0], t: [MX(168), MY(260), 0.2] } })),
      sp("flag", "Bendera Bandara", [Rc(430, 120, 5, 60, 2), Pa("M435 120 L466 130 L435 142 Z")], prismAt("aflag", "Bendera Bandara", "flag", [[-0.02, 0.2], [0.2, 0.1], [-0.02, -0.02]], 440, 150, -0.05))),
    []),
  scene({ id: "ss-akuarium", name: "Akuarium Raksasa", collection: "animal-friends", blurb: "Paus, hiu, dan penyu berenang di balik kaca akuarium raksasa.", band: "4-5th", who: "akuariummu" },
    mergePieces(elGroundBand("sand", "Pasir Dasar", 276),
      sp("frame", "Bingkai Kaca", [Rc(36, 36, 408, 8, 4), Rc(36, 268, 408, 8, 4), Rc(36, 36, 8, 240, 4), Rc(436, 36, 8, 240, 4)], boxAt("qframe", "Bingkai Kaca", "frame", 2.45, 0.06, 0.2, 240, 40)),
      sp("water", "Air Akuarium", [Rc(44, 44, 392, 224, 6)], discAt("qwater", "Air Akuarium", "water", 240, 156, 180, -0.3)),
      sp("seaweed", "Rumput Laut", [Pa("M76 268 C68 234 76 202 68 168 C84 172 92 200 86 232 C94 200 106 178 120 168 C126 200 120 236 128 268 Z")], prismAt("qseaweed", "Rumput Laut", "seaweed", [[-0.2, -0.32], [-0.05, 0.34], [0.1, -0.1], [0.22, 0.32], [0.24, -0.32], [-0.02, -0.34]], 98, 218, -0.05)),
      sp("coral", "Karang", [Pa("M356 268 C352 244 344 228 330 218 L342 206 C352 218 358 230 360 244 C364 224 374 208 388 200 L394 214 C382 226 376 242 376 258 L388 246 L396 258 C400 264 398 268 392 268 Z")], prismAt("qcoral", "Karang", "coral", [[-0.22, -0.2], [-0.05, 0.22], [0.08, -0.05], [0.2, 0.18], [0.24, -0.2], [0, -0.24]], 364, 236, 0.05)),
      sp("fishSchool", "Kawanan Ikan", [Pa("M150 92 C160 82 176 82 186 92 C176 102 160 102 150 92 Z"), Pa("M196 74 C204 66 218 66 226 74 C218 82 204 82 196 74 Z"), Pa("M158 122 C166 114 180 114 188 122 C180 130 166 130 158 122 Z")], ballPart({ id: "qschool", label: "Kawanan Ikan", assembly: "Buat bola-bola ikan kecil pipih berkelompok.", r: 0.12, region: "fishSchool", transform: { s: [1.3, 0.7, 0.5], t: [MX(188), MY(98), 0.1] } })),
      sp("turtleShell", "Cangkang Penyu", [Pa("M120 226 C126 200 150 186 176 186 C202 186 226 200 232 226 C200 234 152 234 120 226 Z")], ballPart({ id: "qtshell", label: "Cangkang Penyu", assembly: "Buat setengah bola cangkang penyu.", r: 0.36, region: "turtleShell", transform: { s: [1.1, 0.7, 0.95], t: [MX(176), MY(212), 0.1] } })),
      sp("turtleHead", "Kepala Penyu", [Ci(240, 218, 13)], ballAt("qthead", "Kepala Penyu", "turtleHead", 240, 218, 12, 0.12)),
      sp("bubbles", "Gelembung", [Ci(300, 96, 8), Ci(318, 118, 6), Ci(292, 134, 5), Ci(120, 60, 7)], ballAt("qbub", "Gelembung", "bubbles", 300, 96, 8, 0)),
      sp("sharkDorsal", "Sirip Punggung Hiu", [Pa("M322 92 C328 78 340 70 352 70 C350 82 346 92 342 100 Z")], prismAt("qdorsal", "Sirip Punggung Hiu", "sharkDorsal", [[-0.1, -0.1], [0.02, 0.11], [0.1, -0.08]], 337, 85, 0.05))),
    [prefixArt(miniFish(180, 156, 1.0, { merges: { fin: "body", tail: "body" } }), "whale"),
     prefixArt(miniFish(330, 120, 0.8, { merges: { fin: "body", tail: "body" } }), "shark")],
    [{ el: Ci(196, 148, 5), fill: INK }, { el: Ci(342, 114, 4.4), fill: INK }, { el: Ci(244, 214, 3), fill: INK }]),
  scene({ id: "ss-pulau-harta", name: "Pulau Harta Karun", collection: "magical-garden", blurb: "Peti harta karun menunggu di pulau kecil di tengah laut.", band: "4-5th", who: "pulau hartamu" },
    mergePieces(elSun("sun", 66, 52, 26), elCloud("cloud", 380, 54, 0.85), elGroundBand("sea", "Laut", 226),
      sp("island", "Pulau Pasir", [Pa("M110 268 C120 240 180 224 240 224 C300 224 360 240 370 268 C300 282 180 282 110 268 Z")], ballPart({ id: "hisland", label: "Pulau Pasir", assembly: "Buat gumpalan pulau pasir yang pipih memanjang.", r: 0.5, region: "island", transform: { s: [1.6, 0.5, 1], t: [MX(240), MY(254), 0] } })),
      sp("palmTrunk", "Batang Palem", [Pa("M316 236 C320 210 326 188 338 172 L348 176 C338 194 332 214 330 236 Z")], cylPart({ id: "hptrunk", label: "Batang Palem", assembly: "Gulung batang palem menjadi tabung melengkung.", r: 0.055, h: 0.4, region: "palmTrunk", transform: { r: [0, 0, -0.25], t: [MX(328), MY(206), 0.05] } })),
      sp("palmLeaves", "Daun Palem", [Pa("M338 172 C316 150 288 142 264 150 C288 160 314 170 332 180 Z"), Pa("M342 170 C356 144 382 132 404 138 C384 156 362 168 346 178 Z"), Pa("M340 174 C336 148 344 124 360 110 C366 138 358 164 344 180 Z")], prismAt("hpleaves", "Daun Palem", "palmLeaves", [[-0.45, 0.1], [0, -0.16], [0.45, 0.1], [0.2, 0.16], [-0.2, 0.16]], 334, 148, 0.05)),
      sp("chest", "Peti Harta", [Rc(150, 224, 84, 40, 6)], boxAt("hchest", "Peti Harta", "chest", 0.51, 0.25, 0.36, 192, 244)),
      sp("chestLid", "Tutup Peti", [Pa("M150 224 C152 202 168 190 192 190 C216 190 232 202 234 224 Z")], ballPart({ id: "hlid", label: "Tutup Peti", assembly: "Buat tutup peti melengkung di atas peti.", r: 0.28, region: "chestLid", transform: { s: [1, 0.55, 0.85], t: [MX(192), MY(210), 0.05] } })),
      sp("gold", "Emas", [Ci(170, 196, 9), Ci(192, 190, 10), Ci(214, 196, 9)], ballAt("hgold", "Emas", "gold", 192, 193, 10, 0.2)),
      sp("waves", "Ombak", [Pa("M52 250 C66 238 82 238 96 250 C110 238 126 238 140 250"), Pa("M340 254 C354 242 370 242 384 254 C398 242 414 242 428 254")], prismAt("hwaves", "Ombak", "waves", [[-1.1, 0.04], [0, -0.05], [1.1, 0.04], [1.1, -0.02], [-1.1, -0.02]], 240, 248, 0.05)),
      sp("parrotBody", "Badan Burung Beo", [Pa("M96 190 C92 168 102 150 118 146 C134 150 144 168 140 190 C132 202 104 202 96 190 Z")], ballPart({ id: "hparrot", label: "Badan Burung Beo", assembly: "Buat bola badan burung beo di dahan palem.", r: 0.16, region: "parrotBody", transform: { s: [0.9, 1.15, 0.8], t: [MX(118), MY(172), 0.15] } })),
      sp("parrotWing", "Sayap Beo", [Pa("M104 168 C96 178 96 192 104 200 C112 190 112 176 104 168 Z")], prismAt("hpwing", "Sayap Beo", "parrotWing", [[-0.04, 0.1], [0.05, 0], [-0.04, -0.1]], 104, 184, 0.3)),
      sp("map", "Peta Harta Karun", [Rc(238, 246, 52, 34, 5), Pa("M248 262 C256 254 264 268 272 260 C276 256 280 258 284 262")], discAt("hmap", "Peta Harta Karun", "map", 264, 263, 24, 0.06)),
      sp("shovel", "Sekop", [Rc(300, 240, 7, 30, 3), Pa("M296 270 L311 270 L303 288 Z")], prismAt("hshovel", "Sekop", "shovel", [[-0.03, 0.16], [0.03, 0.16], [0, -0.16]], 303, 264, 0.1)),
      sp("coconuts", "Kelapa", [Ci(322, 240, 9), Ci(340, 244, 8)], ballAt("hcoco", "Kelapa", "coconuts", 331, 242, 9, 0.15))),
    [], [{ el: Ci(122, 162, 3.6), fill: INK }, { el: Pa("M130 166 L146 171 L130 177 Z"), fill: "#F4842B", stroke: INK, sw: 2 }]),
  scene({ id: "ss-kebun-sayur", name: "Kebun Sayur Raksasa", collection: "magical-garden", blurb: "Labu raksasa, jagung tinggi, dan orang-orangan sawah yang ramah.", band: "4-5th", who: "kebun sayurmu" },
    mergePieces(elSun("sun", 404, 52, 25), elCloud("cloud", 84, 56, 0.85), elFence("fence", 240, 208, 380), elGroundBand("soil", "Tanah Kebun", 252),
      sp("carrots", "Wortel", [Pa("M84 252 L104 252 L94 282 Z"), Pa("M116 252 L136 252 L126 282 Z"), Pa("M100 250 C94 236 84 228 74 228 C82 218 96 222 100 234 C104 220 118 216 128 224 C116 230 108 240 106 252 Z")], prismAt("vcarrots", "Wortel", "carrots", [[-0.2, 0.16], [0.2, 0.16], [0, -0.18]], 105, 256, 0.15)),
      sp("tomatoPlant", "Tanaman Tomat", [Pa("M196 252 C192 224 182 206 164 196 C186 192 200 200 206 216 C214 198 232 190 250 196 C232 206 222 226 222 252 Z"), Rc(208, 252, 8, 34, 3)], prismAt("vtplant", "Tanaman Tomat", "tomatoPlant", [[-0.28, -0.18], [0, 0.2], [0.28, -0.18], [0.2, 0.18], [-0.2, 0.18]], 207, 224, 0)),
      sp("tomatoes", "Tomat", [Ci(180, 216, 12), Ci(228, 210, 12), Ci(204, 232, 11)], ballAt("vtomatoes", "Tomat", "tomatoes", 204, 219, 12, 0.2)),
      sp("pumpkin", "Labu Raksasa", [E(330, 252, 52, 36), Pa("M330 218 C326 206 334 196 344 194 L348 206 C340 210 334 214 330 218 Z")], ballPart({ id: "vpumpkin", label: "Labu Raksasa", assembly: "Buat bola labu raksasa yang pipih.", r: 0.33, region: "pumpkin", transform: { s: [1.15, 0.8, 0.95], t: [MX(330), MY(252), 0.1] } })),
      sp("pumpkinLeaves", "Daun Labu", [Pa("M282 236 C272 224 274 210 286 204 C296 216 296 230 288 240 Z"), Pa("M378 236 C388 224 386 210 374 204 C364 216 364 230 372 240 Z")], prismAt("vpleaves", "Daun Labu", "pumpkinLeaves", [[-0.32, 0.1], [-0.1, -0.12], [0.1, -0.12], [0.32, 0.1], [0.2, 0.12], [-0.2, 0.12]], 330, 222, 0.1)),
      sp("corn", "Jagung", [Pa("M424 252 C418 216 420 178 428 146 C436 178 438 216 432 252 Z")], prismAt("vcorn", "Jagung", "corn", [[-0.05, 0.32], [0.05, 0.32], [0.03, -0.32], [-0.03, -0.32]], 428, 199, 0.05)),
      sp("cornLeaves", "Daun Jagung", [Pa("M428 252 C410 240 400 222 402 202 C418 210 428 228 430 246 Z"), Pa("M430 252 C446 242 454 226 452 208 C438 214 430 230 428 246 Z")], prismAt("vcleaves", "Daun Jagung", "cornLeaves", [[-0.14, 0.14], [0, -0.14], [0.14, 0.14], [0, 0.02]], 427, 230, 0.05)),
      sp("wateringCan", "Gembor", [Pa("M52 262 L92 262 L92 238 L52 238 Z"), Pa("M92 244 C104 240 112 246 110 254 C108 262 98 264 90 258"), Pa("M52 244 C42 240 36 244 38 250 C40 256 48 256 54 252")], boxAt("vcan", "Gembor", "wateringCan", 0.26, 0.15, 0.2, 74, 250)),
      sp("scareBody", "Badan Orang-orangan", [Rc(140, 128, 34, 56, 7), Pa("M112 142 L202 142 L202 154 L112 154 Z")], boxAt("vscare", "Badan Orang-orangan", "scareBody", 0.21, 0.34, 0.16, 157, 156)),
      sp("scareHat", "Topi Orang-orangan", [Pa("M128 112 L186 112 L172 92 L142 92 Z"), Rc(120, 110, 74, 8, 4)], prismAt("vshat", "Topi Orang-orangan", "scareHat", [[-0.2, -0.06], [0.2, -0.06], [0.12, 0.08], [-0.12, 0.08]], 157, 102, 0.05))),
    [], [{ el: Ci(150, 122, 3.2), fill: INK }, { el: Ci(164, 122, 3.2), fill: INK }, { el: Pa("M148 132 C152 136 162 136 166 132"), stroke: INK, sw: 3 }]),
  scene({ id: "ss-karnaval", name: "Karnaval Ceria", collection: "magical-garden", blurb: "Bianglala, tenda, dan komidi putar di karnaval malam yang ceria.", band: "4-5th", who: "karnavalmu" },
    mergePieces(elSun("moon", 66, 52, 23), elGroundBand("ground", "Tanah", 268),
      sp("ferrisWheel", "Roda Bianglala", [Ci(150, 140, 62)], prismAt("kfwheel", "Roda Bianglala", "ferrisWheel", [[0, -0.38], [0.27, -0.27], [0.38, 0], [0.27, 0.27], [0, 0.38], [-0.27, 0.27], [-0.38, 0], [-0.27, -0.27]], 150, 140, -0.15)),
      sp("ferrisCabins", "Kabin Bianglala", [Rc(140, 70, 20, 16, 5), Rc(198, 118, 20, 16, 5), Rc(140, 196, 20, 16, 5), Rc(82, 118, 20, 16, 5), Rc(186, 176, 20, 16, 5), Rc(94, 176, 20, 16, 5)], boxAt("kfcabins", "Kabin Bianglala", "ferrisCabins", 0.13, 0.11, 0.12, 150, 78)),
      sp("ferrisStand", "Tiang Bianglala", [Pa("M118 268 L150 148 L182 268 Z")], prismAt("kfstand", "Tiang Bianglala", "ferrisStand", [[-0.2, -0.36], [0, 0.38], [0.2, -0.36]], 150, 208, -0.1)),
      sp("tent", "Tenda Karnaval", [Pa("M268 268 L330 168 L392 268 Z")], prismAt("ktent", "Tenda Karnaval", "tent", [[-0.38, -0.3], [0, 0.32], [0.38, -0.3]], 330, 218, -0.05)),
      sp("tentStripes", "Garis Tenda", [Pa("M312 196 L330 168 L348 196 L344 268 L316 268 Z")], prismAt("kstripes", "Garis Tenda", "tentStripes", [[-0.12, -0.3], [0, 0.32], [0.12, -0.3], [0.09, -0.3], [-0.09, -0.3]], 330, 218, 0.02)),
      sp("booth", "Kios Permainan", [Rc(398, 208, 66, 60, 6)], boxAt("kbooth", "Kios Permainan", "booth", 0.4, 0.36, 0.34, 431, 238)),
      sp("boothAwning", "Tenda Kios", [Pa("M390 208 L472 208 L460 230 L402 230 Z")], prismAt("kawning", "Tenda Kios", "boothAwning", [[-0.26, 0.07], [0.26, 0.07], [0.19, -0.07], [-0.19, -0.07]], 431, 219, 0.2)),
      sp("balloons", "Balon", [E(60, 196, 17, 21), E(88, 182, 15, 19), E(252, 190, 16, 20)], ballPart({ id: "kballoons", label: "Balon", assembly: "Buat bola-bola balon karnaval yang pipih.", r: 0.12, region: "balloons", transform: { s: [0.9, 1.1, 0.6], t: [MX(74), MY(189), 0.1] } })),
      sp("banner", "Spanduk", [Pa("M226 76 L330 64 L328 80 L228 92 Z"), Pa("M252 80 L260 94 L270 78 Z"), Pa("M288 74 L296 88 L306 72 Z")], prismAt("kbanner", "Spanduk", "banner", [[-0.32, 0.02], [0.32, -0.04], [0.32, -0.12], [-0.32, -0.06]], 278, 78, -0.1)),
      sp("carouselTop", "Atap Komidi Putar", [Pa("M226 268 L226 226 L196 226 C200 206 214 194 230 194 C246 194 260 206 264 226 L234 226 L234 268 Z")], conePart({ id: "kctop", label: "Atap Komidi Putar", assembly: "Gulung atap komidi putar menjadi kerucut lebar.", r: 0.24, h: 0.2, region: "carouselTop", transform: { t: [MX(230), MY(211), 0.05] } })),
      sp("carouselBase", "Lantai Komidi Putar", [Rc(192, 262, 76, 10, 4)], cylPart({ id: "kcbase", label: "Lantai Komidi Putar", assembly: "Gulung lantai komidi putar menjadi tabung pipih.", r: 0.24, h: 0.07, region: "carouselBase", transform: { t: [MX(230), MY(267), 0.05] } })),
      sp("flags", "Bendera Kecil", [Pa("M36 120 L36 84 L64 92 L36 102 Z"), Pa("M444 108 L444 74 L472 82 L444 92 Z")], prismAt("kflags", "Bendera Kecil", "flags", [[0, 0.11], [0.17, 0.05], [0, -0.05]], 50, 93, -0.05))),
    []),
  scene({ id: "ss-kota-robot", name: "Kota Robot", collection: "space-explorers", blurb: "Dua robot ramah tinggal di kota masa depan yang cerah.", band: "4-5th", who: "kota robotmu" },
    mergePieces(elSun("sun", 240, 46, 24), elCloud("cloud", 70, 54, 0.8), elGroundBand("road", "Jalan", 268),
      sp("building1", "Gedung Satu", [Rc(52, 118, 58, 122, 6)], boxAt("rb1", "Gedung Satu", "building1", 0.35, 0.74, 0.34, 81, 179)),
      sp("building2", "Gedung Dua", [Rc(376, 104, 62, 136, 6)], boxAt("rb2", "Gedung Dua", "building2", 0.38, 0.82, 0.35, 407, 172)),
      sp("windows", "Jendela Gedung", [Rc(62, 132, 14, 16, 3), Rc(86, 132, 14, 16, 3), Rc(62, 160, 14, 16, 3), Rc(86, 160, 14, 16, 3), Rc(388, 120, 14, 16, 3), Rc(412, 120, 14, 16, 3), Rc(388, 148, 14, 16, 3), Rc(412, 148, 14, 16, 3)], discAt("rwin", "Jendela Gedung", "windows", 244, 148, 110, 0.2)),
      sp("robotBody", "Badan Robot Besar", [Rc(168, 168, 76, 72, 10)], boxAt("rrbody", "Badan Robot Besar", "robotBody", 0.46, 0.44, 0.4, 206, 204)),
      sp("robotHead", "Kepala Robot Besar", [Rc(176, 106, 60, 56, 10)], boxAt("rrhead", "Kepala Robot Besar", "robotHead", 0.37, 0.34, 0.34, 206, 134)),
      sp("robotAntenna", "Antena Robot", [Rc(202, 78, 8, 28, 3), Ci(206, 72, 9)], prismAt("rrant", "Antena Robot", "robotAntenna", [[-0.03, 0.12], [0.03, 0.12], [0.03, -0.12], [-0.03, -0.12]], 206, 90, 0.05)),
      sp("robotPanel", "Panel Robot", [Rc(186, 188, 40, 30, 6), Ci(196, 203, 4.5), Ci(216, 203, 4.5)], discAt("rrpanel", "Panel Robot", "robotPanel", 206, 203, 19, 0.22)),
      sp("robot2Body", "Badan Robot Kecil", [Rc(286, 196, 52, 46, 8)], boxAt("rr2body", "Badan Robot Kecil", "robot2Body", 0.32, 0.28, 0.28, 312, 219)),
      sp("robot2Head", "Kepala Robot Kecil", [Rc(292, 152, 40, 38, 8)], boxAt("rr2head", "Kepala Robot Kecil", "robot2Head", 0.25, 0.23, 0.23, 312, 171)),
      sp("carBody", "Badan Mobil", [Pa("M128 250 C128 236 136 228 152 225 L160 214 C165 206 176 202 190 202 L202 202 C212 202 220 208 226 216 L234 220 C242 223 246 232 246 250 C246 256 241 259 232 259 L142 259 C134 259 128 256 128 250 Z")], boxAt("rcar", "Badan Mobil", "carBody", 0.71, 0.34, 0.4, 187, 232)),
      sp("carWheels", "Roda Mobil", [Ci(152, 261, 12), Ci(222, 261, 12)], cylPart({ id: "rcarwheel", label: "Roda Mobil", assembly: "Gulung dua roda mobil masa depan.", r: 0.08, h: 0.07, region: "carWheels", transform: { r: [Math.PI / 2, 0, 0], t: [MX(152), MY(261), 0.22] } })),
      elTreeCanopy("canopy", 330, 128, 24), elTrunk("trunk", 330, 148, 196, 7),
      sp("sign", "Papan Kota", [Rc(120, 84, 64, 20, 7)], discAt("rsign", "Papan Kota", "sign", 152, 94, 29, 0)),
      sp("lamp", "Lampu Jalan", [Rc(262, 190, 6, 52, 3), Ci(265, 180, 10)], prismAt("rlamp", "Lampu Jalan", "lamp", [[-0.03, 0.19], [0.03, 0.19], [0.03, -0.19], [-0.03, -0.19]], 265, 216, 0.1))),
    [], [{ el: Ci(194, 130, 5), fill: INK }, { el: Ci(218, 130, 5), fill: INK }, { el: Ci(303, 168, 4), fill: INK }, { el: Ci(321, 168, 4), fill: INK }]),
  scene({ id: "ss-taman-dino", name: "Taman Dino Raksasa", collection: "dino-world", blurb: "Dino raksasa dan bayi dino bermain di dekat gunung berapi.", band: "4-5th", who: "taman dinomu" },
    mergePieces(elSun("sun", 404, 52, 25), elCloud("cloud", 84, 54, 0.85), elGroundBand("grass", "Rumput"), elTreeCanopy("canopy", 436, 118, 28), elTrunk("trunk", 436, 142, 246, 8), elBush("bush", 60, 254, 0.9), elFlower("flowers", 150, 266, 0.9),
      sp("volcano", "Gunung Berapi", [Pa("M52 246 L104 130 L156 246 Z")], prismAt("dvolcano", "Gunung Berapi", "volcano", [[-0.32, -0.36], [0, 0.38], [0.32, -0.36]], 104, 188, -0.1)),
      sp("lava", "Lava", [Pa("M88 158 L104 130 L120 158 C114 168 110 176 112 186 L100 186 C102 176 96 168 88 158 Z")], prismAt("dlava", "Lava", "lava", [[-0.1, 0.18], [0, -0.2], [0.1, 0.18], [0.03, 0.05], [-0.03, 0.05]], 104, 158, 0.02)),
      sp("bigSpikes", "Duri Dino Besar", [Pa("M196 148 L208 128 L220 150 L234 130 L246 152 L260 134 L270 156 L282 140 L290 162")], prismAt("dbigspikes", "Duri Dino Besar", "bigSpikes", [[-0.3, 0.1], [0, -0.12], [0.3, 0.1], [0.24, -0.02], [-0.24, -0.02]], 243, 146, -0.05)),
      sp("palmTrunk", "Batang Palem", [Pa("M356 246 C360 220 366 200 378 184 L388 188 C378 206 372 224 370 246 Z")], cylPart({ id: "dptrunk", label: "Batang Palem", assembly: "Gulung batang palem menjadi tabung melengkung.", r: 0.055, h: 0.38, region: "palmTrunk", transform: { r: [0, 0, -0.25], t: [MX(364), MY(216), 0] } })),
      sp("palmLeaves", "Daun Palem", [Pa("M378 184 C356 162 328 154 304 162 C328 172 354 182 372 192 Z"), Pa("M382 182 C396 156 422 144 444 150 C424 168 402 180 386 190 Z"), Pa("M380 186 C376 160 384 136 400 122 C406 150 398 176 384 192 Z")], prismAt("dpleaves", "Daun Palem", "palmLeaves", [[-0.45, 0.1], [0, -0.16], [0.45, 0.1], [0.2, 0.16], [-0.2, 0.16]], 374, 162, 0))),
    [miniQuad(240, 216, 0.95, { ear: "round", merges: { ears: "head", legs: "body" } }),
     prefixArt(miniQuad(150, 248, 0.5, { ear: "round", merges: { ears: "head", legs: "body" } }), "baby")]),
  scene({ id: "ss-sungai-hutan", name: "Sungai di Hutan", collection: "magical-garden", blurb: "Berang-berang dan bebek bermain di sungai hutan yang jernih.", band: "4-5th", who: "sungai hutanmu" },
    mergePieces(elSun("sun", 66, 52, 25), elCloud("cloud", 380, 54, 0.85), elGroundBand("grass", "Rumput", 190), elPond("river", 240, 262, 190, "Sungai"), elTreeCanopy("canopy", 70, 108, 34), elTrunk("trunk", 70, 136, 196, 9), elPine("pine", 420, 196, 0.9), elBush("bush", 150, 176, 0.9), elFlower("flowers", 330, 182, 0.9),
      sp("bridge", "Jembatan Kayu", [Pa("M150 232 C200 214 280 214 330 232 L330 244 C280 228 200 228 150 244 Z"), Rc(158, 216, 8, 22, 3), Rc(314, 216, 8, 22, 3), Rc(232, 210, 8, 20, 3)], prismAt("ubridge", "Jembatan Kayu", "bridge", [[-0.55, 0.08], [0, -0.04], [0.55, 0.08], [0.55, -0.02], [-0.55, -0.02]], 240, 229, 0.1)),
      sp("rocks", "Batu Sungai", [E(96, 252, 30, 16), E(392, 258, 26, 14)], ballPart({ id: "urocks", label: "Batu Sungai", assembly: "Buat gumpalan batu sungai yang pipih.", r: 0.19, region: "rocks", transform: { s: [1.2, 0.6, 0.9], t: [MX(96), MY(252), 0.15] } })),
      sp("log", "Batang Kayu", [Rc(348, 168, 76, 16, 8), Ci(424, 176, 8)], cylPart({ id: "ulog", label: "Batang Kayu", assembly: "Gulung batang kayu menjadi tabung mendatar.", r: 0.06, h: 0.48, region: "log", transform: { r: [0, 0, Math.PI / 2], t: [MX(386), MY(176), 0.05] } })),
      sp("duckBody", "Badan Bebek", [Pa("M96 282 C100 264 116 252 136 252 C156 252 170 264 172 280 C162 292 106 294 96 282 Z")], ballPart({ id: "uduck", label: "Badan Bebek", assembly: "Buat bola badan bebek yang pipih di sungai.", r: 0.24, region: "duckBody", transform: { s: [1.2, 0.8, 0.85], t: [MX(134), MY(272), 0.2] } })),
      sp("duckHead", "Kepala Bebek", [Ci(164, 246, 14)], ballAt("uduckhead", "Kepala Bebek", "duckHead", 164, 246, 13, 0.2))),
    [prefixArt(miniBuddy(300, 262, 0.7, { ear: "round", belly: true, merges: { ears: "body", belly: "body" } }), "otter")],
    [{ el: Ci(168, 242, 3.2), fill: INK }, { el: Pa("M176 248 L192 253 L176 259 Z"), fill: "#F4842B", stroke: INK, sw: 2 }]),
  scene({ id: "ss-pasar-terapung", name: "Pasar Terapung", collection: "little-vehicles", blurb: "Perahu-perahu penuh buah dan sayur berjualan di sungai.", band: "4-5th", who: "pasar terapungmu" },
    mergePieces(elSun("sun", 240, 44, 24), elCloud("cloud", 70, 54, 0.8), elGroundBand("river", "Sungai", 200), elTreeCanopy("canopy", 436, 120, 28), elTrunk("trunk", 436, 146, 206, 8),
      sp("boat1Hull", "Lambung Perahu Satu", [Pa("M52 236 L196 236 L172 264 L76 264 Z")], boxAt("fhull1", "Lambung Perahu Satu", "boat1Hull", 0.87, 0.18, 0.4, 124, 250)),
      sp("boat1Goods", "Muatan Perahu Satu", [Ci(92, 222, 13), Ci(118, 216, 13), Ci(144, 222, 13), Ci(105, 206, 12), Ci(131, 204, 12)], ballAt("fgoods1", "Muatan Perahu Satu", "boat1Goods", 118, 214, 13, 0.2)),
      sp("boat1Canopy", "Atap Perahu Satu", [Pa("M66 196 L182 196 L160 172 L88 172 Z")], prismAt("fcanopy1", "Atap Perahu Satu", "boat1Canopy", [[-0.36, 0.07], [0.36, 0.07], [0.24, -0.08], [-0.24, -0.08]], 124, 184, 0.05)),
      sp("boat2Hull", "Lambung Perahu Dua", [Pa("M252 244 L396 244 L372 270 L276 270 Z")], boxAt("fhull2", "Lambung Perahu Dua", "boat2Hull", 0.87, 0.17, 0.4, 324, 257)),
      sp("boat2Goods", "Muatan Perahu Dua", [Pa("M292 228 L316 228 L304 202 Z"), Pa("M322 228 L346 228 L334 202 Z"), Pa("M306 226 C300 212 290 204 280 204 C288 194 302 198 306 210 C310 196 324 192 334 200 C322 206 314 216 312 228 Z")], prismAt("fgoods2", "Muatan Perahu Dua", "boat2Goods", [[-0.22, 0.14], [0.22, 0.14], [0, -0.16]], 313, 216, 0.2)),
      sp("boat2Canopy", "Atap Perahu Dua", [Pa("M266 202 L382 202 L360 178 L288 178 Z")], prismAt("fcanopy2", "Atap Perahu Dua", "boat2Canopy", [[-0.36, 0.07], [0.36, 0.07], [0.24, -0.08], [-0.24, -0.08]], 324, 190, 0.05)),
      sp("paddle", "Dayung", [Pa("M206 210 L216 206 L240 252 L230 256 Z"), Pa("M230 256 C224 268 228 280 240 284 C248 274 244 260 230 256 Z")], prismAt("fpaddle", "Dayung", "paddle", [[-0.06, 0.24], [0.02, -0.24], [0.1, 0.2]], 230, 246, 0.15)),
      sp("sellerHat", "Topi Penjual", [Pa("M108 158 L140 158 L128 140 L120 140 Z"), Rc(100, 156, 48, 7, 3)], prismAt("fhat", "Topi Penjual", "sellerHat", [[-0.1, -0.05], [0.1, -0.05], [0.05, 0.07], [-0.05, 0.07]], 124, 149, 0.1)),
      sp("waves", "Ombak Sungai", [Pa("M60 282 C74 270 90 270 104 282 C118 270 134 270 148 282"), Pa("M320 286 C334 274 350 274 364 286 C378 274 394 274 408 286")], prismAt("fwaves", "Ombak Sungai", "waves", [[-1.05, 0.04], [0, -0.05], [1.05, 0.04], [1.05, -0.02], [-1.05, -0.02]], 234, 280, 0.05))),
    [prefixArt(miniBuddy(124, 168, 0.5, { ear: "none", merges: {} }), "seller")],
    [{ el: Ci(128, 160, 2.6), fill: INK }]),
  scene({ id: "ss-ladang-bunga", name: "Ladang Bunga", collection: "magical-garden", blurb: "Ladang penuh bunga matahari, tulip, dan kupu-kupu beterbangan.", band: "4-5th", who: "ladang bungamu" },
    mergePieces(elSun("sun", 240, 46, 26), elCloud("cloud", 70, 54, 0.8), elGroundBand("grass", "Rumput", 236), elGroundBand("path", "Jalan Setapak", 284),
      sp("sunPetals1", "Kelopak Matahari Satu", [...petalEls(110, 130, 8, 24, 12, 12)], ballPart({ id: "gspet1", label: "Kelopak Matahari Satu", assembly: "Buat bola kelopak bunga matahari pertama.", r: 0.24, region: "sunPetals1", transform: { s: [1.2, 1.2, 0.45], t: [MX(110), MY(130), 0.05] } })),
      sp("sunCenter1", "Tengah Matahari Satu", [Ci(110, 130, 14)], discAt("gscen1", "Tengah Matahari Satu", "sunCenter1", 110, 130, 13, 0.2)),
      sp("sunStem1", "Batang Matahari Satu", [Pa("M106 236 C108 200 108 168 110 148 L116 148 C114 184 114 210 116 236 Z")], prismAt("gsstem1", "Batang Matahari Satu", "sunStem1", [[-0.03, 0.28], [0.03, 0.28], [0.03, -0.28], [-0.03, -0.28]], 111, 192, 0)),
      sp("sunPetals2", "Kelopak Matahari Dua", [...petalEls(370, 118, 8, 22, 11, 11)], ballPart({ id: "gspet2", label: "Kelopak Matahari Dua", assembly: "Buat bola kelopak bunga matahari kedua.", r: 0.22, region: "sunPetals2", transform: { s: [1.2, 1.2, 0.45], t: [MX(370), MY(118), 0.05] } })),
      sp("sunCenter2", "Tengah Matahari Dua", [Ci(370, 118, 13)], discAt("gscen2", "Tengah Matahari Dua", "sunCenter2", 370, 118, 12, 0.2)),
      sp("sunStem2", "Batang Matahari Dua", [Pa("M366 236 C368 196 368 160 370 138 L376 138 C374 174 374 204 376 236 Z")], prismAt("gsstem2", "Batang Matahari Dua", "sunStem2", [[-0.03, 0.3], [0.03, 0.3], [0.03, -0.3], [-0.03, -0.3]], 371, 187, 0)),
      sp("tulips", "Tulip Warna-warni", [Pa("M168 268 C162 250 166 234 176 226 L180 238 L186 224 L192 238 L196 226 C206 234 210 250 204 268 Z"), Pa("M236 272 C230 254 234 238 244 230 L248 242 L254 228 L260 242 L264 230 C274 238 278 254 272 272 Z"), Pa("M304 268 C298 250 302 234 312 226 L316 238 L322 224 L328 238 L332 226 C342 234 346 250 340 268 Z")], prismAt("gstulips", "Tulip Warna-warni", "tulips", [[-0.55, -0.12], [-0.05, 0.14], [0.05, -0.14], [0.55, -0.12], [0.45, 0.14], [-0.45, 0.14]], 254, 248, 0.15)),
      sp("daisies", "Bunga Aster", [...petalEls(196, 262, 6, 11, 7, 7), Ci(196, 262, 6), ...petalEls(316, 266, 6, 10, 6.5, 6.5), Ci(316, 266, 5.5)], ballPart({ id: "gsdaisies", label: "Bunga Aster", assembly: "Buat bola-bola bunga aster pipih di rumput.", r: 0.11, region: "daisies", transform: { s: [1.2, 1.2, 0.45], t: [MX(196), MY(262), 0.2] } })),
      sp("butterfly1", "Kupu-kupu Satu", [E(196, 168, 17, 22), E(228, 168, 17, 22), E(212, 178, 7, 24)], ballPart({ id: "gsbf1", label: "Kupu-kupu Satu", assembly: "Buat kupu-kupu pertama yang pipih beterbangan.", r: 0.13, region: "butterfly1", transform: { s: [1.4, 0.9, 0.4], t: [MX(212), MY(172), 0.15] } })),
      sp("butterfly2", "Kupu-kupu Dua", [E(292, 150, 14, 18), E(318, 150, 14, 18), E(305, 158, 6, 20)], ballPart({ id: "gsbf2", label: "Kupu-kupu Dua", assembly: "Buat kupu-kupu kedua yang pipih beterbangan.", r: 0.11, region: "butterfly2", transform: { s: [1.4, 0.9, 0.4], t: [MX(305), MY(154), 0.15] } })),
      sp("fence", "Pagar Ladang", [Rc(52, 216, 120, 8, 3), Rc(308, 216, 120, 8, 3), Rc(62, 204, 9, 30, 3), Rc(104, 204, 9, 30, 3), Rc(146, 204, 9, 30, 3), Rc(318, 204, 9, 30, 3), Rc(360, 204, 9, 30, 3), Rc(402, 204, 9, 30, 3)], prismAt("gsfence", "Pagar Ladang", "fence", [[-1.15, 0.05], [1.15, 0.05], [1.15, -0.05], [-1.15, -0.05]], 240, 219, -0.05))),
    [], [{ el: Ci(106, 126, 2.6), fill: INK }, { el: Ci(114, 126, 2.6), fill: INK }, { el: Ci(366, 114, 2.4), fill: INK }, { el: Ci(374, 114, 2.4), fill: INK }]),
  scene({ id: "ss-kerajaan-mini", name: "Kerajaan Mini", collection: "magical-garden", blurb: "Kastil mini dengan menara, gerbang, dan bendera berkibar.", band: "4-5th", who: "kerajaan minimu" },
    mergePieces(elSun("sun", 66, 52, 25), elCloud("cloud", 380, 54, 0.85), elGroundBand("grass", "Rumput", 262), elTreeCanopy("canopy", 52, 150, 26), elTrunk("trunk", 52, 174, 262, 8), elTreeCanopy("canopy2", 428, 150, 26), elTrunk("trunk2", 428, 174, 262, 8), elBush("bush", 120, 256, 0.9), elFlower("flowers", 360, 264, 0.9),
      sp("castleWalls", "Dinding Kastil", [Rc(176, 168, 128, 82, 6)], boxAt("kwalls", "Dinding Kastil", "castleWalls", 0.78, 0.5, 0.52, 240, 209)),
      sp("towerLeft", "Menara Kiri", [Rc(140, 128, 44, 122, 6)], boxAt("ktleft", "Menara Kiri", "towerLeft", 0.27, 0.74, 0.3, 162, 189)),
      sp("towerRight", "Menara Kanan", [Rc(296, 128, 44, 122, 6)], boxAt("ktright", "Menara Kanan", "towerRight", 0.27, 0.74, 0.3, 318, 189)),
      sp("roofLeft", "Atap Menara Kiri", [Pa("M134 130 L162 88 L190 130 Z")], conePart({ id: "krleft", label: "Atap Menara Kiri", assembly: "Gulung atap menara kiri menjadi kerucut.", r: 0.18, h: 0.28, region: "roofLeft", transform: { t: [MX(162), MY(110), 0] } })),
      sp("roofRight", "Atap Menara Kanan", [Pa("M290 130 L318 88 L346 130 Z")], conePart({ id: "krright", label: "Atap Menara Kanan", assembly: "Gulung atap menara kanan menjadi kerucut.", r: 0.18, h: 0.28, region: "roofRight", transform: { t: [MX(318), MY(110), 0] } })),
      sp("roofCenter", "Atap Tengah", [Pa("M196 168 L240 116 L284 168 Z")], conePart({ id: "krcenter", label: "Atap Tengah", assembly: "Gulung atap tengah kastil menjadi kerucut lebar.", r: 0.3, h: 0.34, region: "roofCenter", transform: { t: [MX(240), MY(144), 0] } })),
      sp("gate", "Gerbang Kastil", [Pa("M216 250 L216 204 C216 190 264 190 264 204 L264 250 Z")], discAt("kgate", "Gerbang Kastil", "gate", 240, 222, 23, 0.28)),
      sp("castleWindows", "Jendela Kastil", [Rc(154, 152, 16, 24, 6), Rc(310, 152, 16, 24, 6), Ci(240, 150, 10)], discAt("kwin", "Jendela Kastil", "castleWindows", 240, 163, 80, 0.28)),
      sp("flagCenter", "Bendera Tengah", [Rc(237, 84, 6, 34, 3), Pa("M243 84 L274 93 L243 104 Z")], prismAt("kflagc", "Bendera Tengah", "flagCenter", [[-0.03, 0.13], [0.19, 0.06], [-0.03, -0.02]], 252, 101, 0.05)),
      sp("flagLeft", "Bendera Kiri", [Rc(159, 62, 5, 28, 2), Pa("M164 62 L188 69 L164 78 Z")], prismAt("kflagl", "Bendera Kiri", "flagLeft", [[-0.02, 0.1], [0.15, 0.05], [-0.02, -0.02]], 170, 76, 0.05)),
      sp("flagRight", "Bendera Kanan", [Rc(315, 62, 5, 28, 2), Pa("M320 62 L344 69 L320 78 Z")], prismAt("kflagr", "Bendera Kanan", "flagRight", [[-0.02, 0.1], [0.15, 0.05], [-0.02, -0.02]], 326, 76, 0.05)),
      sp("moat", "Parit Kastil", [Pa("M120 268 C180 256 300 256 360 268 L360 282 L120 282 Z")], discAt("kmoat", "Parit Kastil", "moat", 240, 269, 110, 0.02))),
    []),
  scene({ id: "ss-kampung-nelayan", name: "Kampung Nelayan", collection: "little-homes", blurb: "Rumah panggung dan perahu nelayan di tepi pantai kampung.", band: "4-5th", who: "kampung nelayanmu" },
    mergePieces(elSun("sun", 404, 52, 25), elCloud("cloud", 84, 56, 0.85), elGroundBand("sea", "Laut", 232), elGroundBand("sand", "Pasir", 272),
      sp("houseWalls", "Dinding Rumah Panggung", [Rc(64, 148, 104, 66, 6)], boxAt("nwalls2", "Dinding Rumah Panggung", "houseWalls", 0.63, 0.4, 0.48, 116, 181)),
      sp("houseRoof", "Atap Rumah", [Pa("M52 150 L116 104 L180 150 Z")], prismAt("nroof2", "Atap Rumah", "houseRoof", [[-0.4, -0.14], [0, 0.18], [0.4, -0.14]], 116, 128, 0)),
      sp("houseDoor", "Pintu Rumah", [Rc(102, 172, 28, 42, 5)], discAt("ndoor2", "Pintu Rumah", "houseDoor", 116, 193, 13, 0.26)),
      sp("houseWindow", "Jendela Rumah", [Rc(76, 162, 20, 20, 4), Rc(140, 162, 20, 20, 4)], discAt("nwin2", "Jendela Rumah", "houseWindow", 118, 172, 40, 0.26)),
      sp("stilts", "Tiang Panggung", [Rc(72, 214, 10, 42, 3), Rc(150, 214, 10, 42, 3), Rc(106, 214, 10, 42, 3)], prismAt("nstilts", "Tiang Panggung", "stilts", [[-0.28, 0.14], [0.28, 0.14], [0.28, -0.14], [-0.28, -0.14]], 116, 235, 0.05)),
      sp("palmTrunk", "Batang Palem", [Pa("M212 256 C216 228 222 206 234 190 L244 194 C234 212 228 232 226 256 Z")], cylPart({ id: "nptrunk", label: "Batang Palem", assembly: "Gulung batang palem menjadi tabung melengkung.", r: 0.055, h: 0.4, region: "palmTrunk", transform: { r: [0, 0, -0.25], t: [MX(224), MY(224), 0] } })),
      sp("palmLeaves", "Daun Palem", [Pa("M234 190 C212 168 184 160 160 168 C184 178 210 188 228 198 Z"), Pa("M238 188 C252 162 278 150 300 156 C280 174 258 186 242 196 Z"), Pa("M236 192 C232 166 240 142 256 128 C262 156 254 182 240 198 Z")], prismAt("npleaves", "Daun Palem", "palmLeaves", [[-0.45, 0.1], [0, -0.16], [0.45, 0.1], [0.2, 0.16], [-0.2, 0.16]], 230, 168, 0)),
      boatPieces({ sail: true, x: 330, y: 246 }),
      sp("net", "Jaring Ikan", [Pa("M268 262 L268 226 L304 226 L304 262 Z"), Pa("M268 238 L304 238 M280 226 L280 262 M292 226 L292 262")], prismAt("nnet", "Jaring Ikan", "net", [[-0.12, 0.12], [0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]], 286, 244, 0.15)),
      sp("fishCatch", "Ikan Tangkapan", [Pa("M52 282 C62 272 78 272 88 282 C78 292 62 292 52 282 Z"), Pa("M96 286 C104 278 118 278 126 286 C118 294 104 294 96 286 Z")], ballPart({ id: "nfish", label: "Ikan Tangkapan", assembly: "Buat bola-bola ikan tangkapan pipih di pasir.", r: 0.11, region: "fishCatch", transform: { s: [1.3, 0.7, 0.5], t: [MX(89), MY(282), 0.2] } })),
      sp("bucket", "Ember Ikan", [Pa("M392 252 L424 252 L418 278 L398 278 Z")], boxAt("nbucket", "Ember Ikan", "bucket", 0.2, 0.16, 0.17, 408, 265))),
    []),
  scene({ id: "ss-taman-kota", name: "Taman Kota", collection: "magical-garden", blurb: "Air mancur, bangku, dan bebek di kolam taman kota.", band: "4-5th", who: "taman kotamu" },
    mergePieces(elSun("sun", 66, 52, 25), elCloud("cloud", 380, 54, 0.85), elGroundBand("grass", "Rumput", 210), elPond("pond", 130, 282, 84), elTreeCanopy("canopy", 400, 116, 32), elTrunk("trunk", 400, 144, 220, 9), elTreeCanopy("canopy2", 52, 128, 26), elTrunk("trunk2", 52, 152, 220, 8), elBush("bush", 300, 196, 0.9), elFlower("flowers", 210, 196, 0.9),
      sp("fountainBase", "Kolam Air Mancur", [Pa("M196 236 C200 218 220 208 240 208 C260 208 280 218 284 236 C262 246 218 246 196 236 Z")], ballPart({ id: "tfbase", label: "Kolam Air Mancur", assembly: "Buat kolam air mancur pipih di tengah taman.", r: 0.3, region: "fountainBase", transform: { s: [1.05, 0.5, 0.9], t: [MX(240), MY(228), 0.1] } })),
      sp("fountainPole", "Tiang Air Mancur", [Rc(234, 168, 12, 44, 5)], cylPart({ id: "tfpole", label: "Tiang Air Mancur", assembly: "Gulung tiang air mancur menjadi tabung tegak.", r: 0.045, h: 0.27, region: "fountainPole", transform: { t: [MX(240), MY(190), 0.1] } })),
      sp("fountainTop", "Puncak Air Mancur", [Pa("M216 170 C220 154 230 146 240 146 C250 146 260 154 264 170 C254 176 226 176 216 170 Z")], ballPart({ id: "tftop", label: "Puncak Air Mancur", assembly: "Buat puncak air mancur pipih di atas tiangnya.", r: 0.17, region: "fountainTop", transform: { s: [1.1, 0.6, 0.9], t: [MX(240), MY(162), 0.1] } })),
      sp("waterDrops", "Percikan Air", [Pa("M240 146 C236 132 232 122 226 112"), Pa("M240 146 C244 132 248 122 254 112"), Ci(226, 106, 4), Ci(254, 106, 4), Ci(240, 96, 4.5)], ballAt("tdrops", "Percikan Air", "waterDrops", 240, 100, 5, 0.15)),
      sp("bench1", "Bangku Satu", [Rc(316, 226, 64, 9, 4), Rc(322, 208, 52, 9, 4), Rc(322, 235, 8, 20, 3), Rc(366, 235, 8, 20, 3)], boxAt("tbench1", "Bangku Satu", "bench1", 0.39, 0.12, 0.19, 348, 226)),
      sp("bench2", "Bangku Dua", [Rc(96, 226, 64, 9, 4), Rc(102, 208, 52, 9, 4), Rc(102, 235, 8, 20, 3), Rc(146, 235, 8, 20, 3)], boxAt("tbench2", "Bangku Dua", "bench2", 0.39, 0.12, 0.19, 128, 226)),
      sp("lamp1", "Lampu Taman Satu", [Rc(190, 168, 6, 44, 3), Ci(193, 158, 10)], prismAt("tlamp1", "Lampu Taman Satu", "lamp1", [[-0.03, 0.17], [0.03, 0.17], [0.03, -0.17], [-0.03, -0.17]], 193, 190, 0.05)),
      sp("lamp2", "Lampu Taman Dua", [Rc(284, 168, 6, 44, 3), Ci(287, 158, 10)], prismAt("tlamp2", "Lampu Taman Dua", "lamp2", [[-0.03, 0.17], [0.03, 0.17], [0.03, -0.17], [-0.03, -0.17]], 287, 190, 0.05)),
      sp("duckBody", "Badan Bebek", [Pa("M92 268 C96 252 110 242 128 242 C146 242 158 252 160 266 C150 278 102 280 92 268 Z")], ballPart({ id: "tduck", label: "Badan Bebek", assembly: "Buat bola badan bebek yang pipih di kolam.", r: 0.22, region: "duckBody", transform: { s: [1.2, 0.8, 0.85], t: [MX(126), MY(260), 0.2] } })),
      sp("duckHead", "Kepala Bebek", [Ci(152, 236, 13)], ballAt("tduckhead", "Kepala Bebek", "duckHead", 152, 236, 12, 0.2))),
    [], [{ el: Ci(156, 232, 3), fill: INK }, { el: Pa("M164 238 L178 243 L164 249 Z"), fill: "#F4842B", stroke: INK, sw: 2 }]),
  scene({ id: "ss-pangkalan-roket", name: "Pangkalan Roket", collection: "space-explorers", blurb: "Roket besar siap meluncur dari pangkalan dengan menara kontrol.", band: "4-5th", who: "pangkalan roketmu" },
    mergePieces(elSun("moon", 404, 54, 22), elGroundBand("ground", "Tanah Pangkalan", 268),
      sp("earth", "Bumi di Kejauhan", [Ci(70, 84, 30)], ballAt("pearth", "Bumi di Kejauhan", "earth", 70, 84, 29, -0.2)),
      sp("rocketBody", "Badan Roket", [Rc(196, 150, 64, 118, 10)], cylPart({ id: "prbody", label: "Badan Roket", assembly: "Gulung badan roket menjadi tabung tegak besar.", r: 0.2, h: 0.72, region: "rocketBody", transform: { t: [MX(228), MY(209), 0] } })),
      sp("rocketNose", "Hidung Roket", [Pa("M196 150 C198 116 212 92 228 80 C244 92 258 116 260 150 Z")], conePart({ id: "prnose", label: "Hidung Roket", assembly: "Gulung hidung roket menjadi kerucut di puncak badan.", r: 0.2, h: 0.42, region: "rocketNose", transform: { t: [MX(228), MY(116), 0] } })),
      sp("rocketWindow", "Jendela Roket", [Ci(228, 176, 13)], discAt("prwin", "Jendela Roket", "rocketWindow", 228, 176, 12, 0.22)),
      sp("rocketStripe", "Garis Roket", [Rc(196, 224, 64, 14, 4)], prismAt("prstripe", "Garis Roket", "rocketStripe", [[-0.2, 0.045], [0.2, 0.045], [0.2, -0.045], [-0.2, -0.045]], 228, 231, 0.21)),
      sp("rocketFins", "Sirip Roket", [Pa("M196 226 C180 244 172 258 174 270 L196 262 Z"), Pa("M260 226 C276 244 284 258 282 270 L260 262 Z")], prismAt("prfins", "Sirip Roket", "rocketFins", [[-0.34, -0.08], [-0.05, 0.15], [0.05, 0.15], [0.34, -0.08], [0.12, -0.15], [-0.12, -0.15]], 228, 248, 0)),
      sp("rocketFlame", "Api Roket", [Pa("M210 270 C214 288 222 300 228 308 C234 300 242 288 246 270 C236 280 220 280 210 270 Z")], conePart({ id: "prflame", label: "Api Roket", assembly: "Gulung api roket menjadi kerucut ke bawah.", r: 0.11, h: 0.24, region: "rocketFlame", transform: { r: [Math.PI, 0, 0], t: [MX(228), MY(288), 0] } })),
      sp("tower", "Menara Luncur", [Rc(292, 120, 14, 148, 5), Rc(292, 120, 52, 10, 4), Rc(292, 176, 44, 9, 4), Rc(292, 228, 44, 9, 4), Rc(262, 160, 32, 8, 3)], prismAt("ptower", "Menara Luncur", "tower", [[-0.16, 0.46], [-0.06, 0.46], [-0.06, -0.46], [0.16, -0.46], [0.16, -0.36], [-0.16, -0.36]], 318, 194, -0.05)),
      sp("controlWalls", "Gedung Kontrol", [Rc(368, 200, 84, 56, 6)], boxAt("pcwalls", "Gedung Kontrol", "controlWalls", 0.51, 0.34, 0.42, 410, 228)),
      sp("controlWindow", "Jendela Kontrol", [Rc(380, 214, 60, 20, 5)], discAt("pcwin", "Jendela Kontrol", "controlWindow", 410, 224, 28, 0.23)),
      sp("antenna", "Antena Kontrol", [Rc(406, 158, 7, 42, 3), Ci(409, 150, 10)], prismAt("pant", "Antena Kontrol", "antenna", [[-0.03, 0.16], [0.03, 0.16], [0.03, -0.16], [-0.03, -0.16]], 409, 179, 0.05)),
      sp("smallRocket", "Roket Kecil", [Pa("M96 268 L96 224 C96 206 104 194 112 188 L120 194 C128 206 128 224 128 268 C118 274 106 274 96 268 Z"), Ci(112, 226, 7)], cylPart({ id: "psrocket", label: "Roket Kecil", assembly: "Gulung roket kecil menjadi tabung tegak.", r: 0.1, h: 0.45, region: "smallRocket", transform: { t: [MX(112), MY(230), 0.05] } })),
      sp("flag", "Bendera Pangkalan", [Rc(150, 196, 5, 56, 2), Pa("M155 196 L184 205 L155 216 Z")], prismAt("pflag", "Bendera Pangkalan", "flag", [[-0.02, 0.18], [0.17, 0.1], [-0.02, 0.02]], 162, 224, 0.05)),
      sp("crater", "Kawah Kecil", [E(340, 272, 34, 9), E(70, 276, 26, 8)], discAt("pcrater", "Kawah Kecil", "crater", 340, 272, 30, 0.03))),
    []),
  scene({ id: "ss-sawah", name: "Sawah Hijau", collection: "magical-garden", blurb: "Petak sawah berundak dengan gubuk dan kerbau yang membajak.", band: "4-5th", who: "sawahmu" },
    mergePieces(elSun("sun", 66, 52, 26), elCloud("cloud", 300, 50, 0.85), elMountain("mountain", 420, 190, 130, 100),
      sp("terrace1", "Petak Atas", [Pa("M36 196 L300 196 L284 226 L52 226 Z")], prismAt("ster1", "Petak Atas", "terrace1", [[-0.82, 0.09], [0.82, 0.09], [0.7, -0.1], [-0.7, -0.1]], 168, 211, -0.05)),
      sp("terrace2", "Petak Tengah", [Pa("M52 232 L330 232 L312 262 L70 262 Z")], prismAt("ster2", "Petak Tengah", "terrace2", [[-0.86, 0.09], [0.86, 0.09], [0.74, -0.1], [-0.74, -0.1]], 191, 247, 0)),
      sp("terrace3", "Petak Bawah", [Pa("M70 268 L360 268 L344 296 L86 296 Z")], prismAt("ster3", "Petak Bawah", "terrace3", [[-0.9, 0.08], [0.9, 0.08], [0.78, -0.09], [-0.78, -0.09]], 215, 282, 0.05)),
      sp("rice1", "Padi Atas", [Pa("M90 196 C86 178 80 164 70 154 C84 154 94 166 98 182 C102 164 112 152 126 150 C118 164 112 180 112 196 Z"), Pa("M170 196 C166 178 160 164 150 154 C164 154 174 166 178 182 C182 164 192 152 206 150 C198 164 192 180 192 196 Z"), Pa("M250 196 C246 178 240 164 230 154 C244 154 254 166 258 182 C262 164 272 152 286 150 C278 164 272 180 272 196 Z")], prismAt("srice1", "Padi Atas", "rice1", [[-0.66, 0.14], [0, -0.14], [0.66, 0.14], [0.5, -0.02], [-0.5, -0.02]], 178, 174, 0)),
      sp("rice2", "Padi Bawah", [Pa("M120 268 C116 250 110 236 100 226 C114 226 124 238 128 254 C132 236 142 224 156 222 C148 236 142 252 142 268 Z"), Pa("M230 268 C226 250 220 236 210 226 C224 226 234 238 238 254 C242 236 252 224 266 222 C258 236 252 252 252 268 Z")], prismAt("srice2", "Padi Bawah", "rice2", [[-0.52, 0.14], [0, -0.14], [0.52, 0.14], [0.38, -0.02], [-0.38, -0.02]], 183, 246, 0.1)),
      sp("hutWalls", "Dinding Gubuk", [Rc(330, 130, 62, 44, 5)], boxAt("shut", "Dinding Gubuk", "hutWalls", 0.38, 0.27, 0.34, 361, 152)),
      sp("hutRoof", "Atap Gubuk", [Pa("M318 132 L361 96 L404 132 Z")], prismAt("shroof", "Atap Gubuk", "hutRoof", [[-0.27, -0.11], [0, 0.14], [0.27, -0.11]], 361, 115, 0)),
      sp("hutDoor", "Pintu Gubuk", [Rc(350, 142, 22, 32, 4)], discAt("shdoor", "Pintu Gubuk", "hutDoor", 361, 158, 10, 0.19)),
      elTreeCanopy("canopy", 66, 128, 28), elTrunk("trunk", 66, 152, 196, 8),
      sp("buffaloBody", "Badan Kerbau", [Pa("M368 268 C372 246 392 234 416 236 C440 238 454 252 452 268 C428 276 392 276 368 268 Z")], ballPart({ id: "sbufbody", label: "Badan Kerbau", assembly: "Buat bola badan kerbau yang pipih memanjang.", r: 0.27, region: "buffaloBody", transform: { s: [1.25, 0.68, 0.9], t: [MX(410), MY(256), 0.15] } })),
      sp("buffaloHead", "Kepala Kerbau", [Pa("M452 244 C462 236 476 238 482 248 C486 258 480 268 468 270 C458 264 450 254 452 244 Z")], ballAt("sbufhead", "Kepala Kerbau", "buffaloHead", 466, 254, 15, 0.15)),
      sp("buffaloHorns", "Tanduk Kerbau", [Pa("M456 240 C448 228 448 216 456 208 C458 220 462 230 468 236 Z"), Pa("M478 240 C486 228 486 216 478 208 C476 220 472 230 466 236 Z")], prismAt("sbufhorns", "Tanduk Kerbau", "buffaloHorns", [[-0.12, 0.1], [-0.04, -0.11], [0.04, -0.11], [0.12, 0.1], [0.04, 0.02], [-0.04, 0.02]], 467, 224, 0.1))),
    [], [{ el: Ci(472, 250, 3.2), fill: INK }]),
  scene({ id: "ss-rumah-pohon", name: "Rumah Pohon Raksasa", collection: "magical-garden", blurb: "Rumah pohon bertingkat dengan tangga tali dan ayunan ban.", band: "4-5th", who: "rumah pohonmu" },
    mergePieces(elSun("sun", 404, 52, 25), elCloud("cloud", 84, 56, 0.85), elGroundBand("grass", "Rumput"), elBush("bush", 60, 254, 0.95), elFlower("flowers", 400, 266, 0.9),
      sp("canopy", "Daun Pohon Raksasa", [Ci(240, 84, 62), Ci(172, 112, 44), Ci(308, 112, 44)], ballPart({ id: "tcanopy", label: "Daun Pohon Raksasa", assembly: "Buat bola daun pohon raksasa di puncak batang.", r: 0.44, region: "canopy", transform: { s: [1.4, 0.9, 0.95], t: [MX(240), MY(100), -0.12] } })),
      sp("trunk", "Batang Pohon Raksasa", [Pa("M206 268 C212 210 216 160 214 118 L266 118 C264 160 268 210 274 268 Z")], cylPart({ id: "ttrunk", label: "Batang Pohon Raksasa", assembly: "Gulung batang pohon raksasa menjadi tabung kokoh.", r: 0.2, h: 0.9, region: "trunk", transform: { t: [MX(240), MY(193), -0.08] } })),
      sp("houseWalls", "Dinding Rumah Pohon", [Rc(160, 150, 84, 62, 6)], boxAt("thwalls", "Dinding Rumah Pohon", "houseWalls", 0.51, 0.38, 0.44, 202, 181)),
      sp("houseRoof", "Atap Rumah Pohon", [Pa("M150 152 L202 112 L254 152 Z")], prismAt("throof", "Atap Rumah Pohon", "houseRoof", [[-0.33, -0.12], [0, 0.15], [0.33, -0.12]], 202, 133, 0)),
      sp("houseWindow", "Jendela Rumah Pohon", [Ci(202, 172, 12)], discAt("thwin", "Jendela Rumah Pohon", "houseWindow", 202, 172, 11, 0.24)),
      sp("houseDoor", "Pintu Rumah Pohon", [Rc(226, 178, 24, 34, 5)], discAt("thdoor", "Pintu Rumah Pohon", "houseDoor", 238, 195, 11, 0.24)),
      sp("balcony", "Balkon", [Rc(150, 210, 130, 9, 4), Rc(156, 196, 6, 14, 3), Rc(196, 196, 6, 14, 3), Rc(236, 196, 6, 14, 3), Rc(272, 196, 6, 14, 3)], prismAt("tbalcony", "Balkon", "balcony", [[-0.4, 0.05], [0.4, 0.05], [0.4, -0.05], [-0.4, -0.05]], 215, 208, 0.26)),
      sp("ladder", "Tangga Tali", [Pa("M292 168 L292 262 M306 168 L306 262"), Rc(290, 186, 18, 6, 3), Rc(290, 208, 18, 6, 3), Rc(290, 230, 18, 6, 3), Rc(290, 252, 18, 6, 3)], prismAt("tladder", "Tangga Tali", "ladder", [[-0.06, 0.3], [0.06, 0.3], [0.06, -0.3], [-0.06, -0.3]], 299, 215, 0.15)),
      sp("branch", "Dahan Ayunan", [Pa("M268 130 C310 122 348 124 380 138 L376 152 C344 140 308 138 270 142 Z")], prismAt("tbranch", "Dahan Ayunan", "branch", [[-0.34, 0.05], [0.34, -0.03], [0.34, -0.1], [-0.34, -0.03]], 324, 136, -0.05)),
      sp("tireSwing", "Ayunan Ban", [Pa("M330 152 L330 196 M352 152 L352 196"), Pa("M316 214 C316 200 328 192 341 192 C354 192 366 200 366 214 C366 228 354 236 341 236 C328 236 316 228 316 214 Z M328 214 C328 222 334 226 341 226 C348 226 354 222 354 214 C354 206 348 202 341 202 C334 202 328 206 328 214 Z")], prismAt("ttire", "Ayunan Ban", "tireSwing", [[-0.16, 0.14], [0.16, 0.14], [0.16, -0.14], [-0.16, -0.14], [-0.08, -0.07], [0.08, -0.07], [0.08, 0.07], [-0.08, 0.07]], 341, 214, 0.1)),
      sp("birdhouse", "Sangkar Burung", [Rc(96, 150, 34, 30, 4), Pa("M92 152 L113 132 L134 152 Z"), Ci(113, 164, 7)], boxAt("tbirdhouse", "Sangkar Burung", "birdhouse", 0.21, 0.19, 0.18, 113, 165)),
      sp("sign", "Papan Nama Pohon", [Rc(196, 236, 60, 18, 6)], discAt("tsign", "Papan Nama Pohon", "sign", 226, 245, 27, 0.12))),
    [], [{ el: Ci(226, 168, 2.8), fill: INK }]),
  scene({ id: "ss-festival-lampion", name: "Festival Lampion", collection: "magical-garden", blurb: "Lampion-lampion beterbangan di atas pasar malam yang hangat.", band: "4-5th", who: "festival lampionmu" },
    mergePieces(elSun("moon", 70, 54, 22), elGroundBand("ground", "Tanah", 268),
      sp("lantern1", "Lampion Besar", [E(150, 110, 34, 40), Rc(136, 66, 28, 10, 4), Rc(138, 148, 24, 9, 4)], ballPart({ id: "flan1", label: "Lampion Besar", assembly: "Buat bola lampion besar yang pipih beterbangan.", r: 0.24, region: "lantern1", transform: { s: [0.9, 1.05, 0.55], t: [MX(150), MY(110), 0.05] } })),
      sp("lantern2", "Lampion Sedang", [E(268, 84, 26, 31), Rc(256, 50, 24, 9, 4), Rc(258, 113, 20, 8, 4)], ballPart({ id: "flan2", label: "Lampion Sedang", assembly: "Buat bola lampion sedang yang pipih beterbangan.", r: 0.19, region: "lantern2", transform: { s: [0.9, 1.05, 0.55], t: [MX(268), MY(84), 0] } })),
      sp("lantern3", "Lampion Kecil", [E(360, 122, 21, 25), Rc(350, 94, 20, 8, 4), Rc(352, 145, 16, 7, 3)], ballPart({ id: "flan3", label: "Lampion Kecil", assembly: "Buat bola lampion kecil yang pipih beterbangan.", r: 0.15, region: "lantern3", transform: { s: [0.9, 1.05, 0.55], t: [MX(360), MY(122), 0.05] } })),
      sp("lantern4", "Lampion Jauh", [E(90, 190, 15, 18), E(420, 196, 13, 16)], ballPart({ id: "flan4", label: "Lampion Jauh", assembly: "Buat bola-bola lampion jauh yang kecil.", r: 0.1, region: "lantern4", transform: { s: [0.9, 1.05, 0.55], t: [MX(90), MY(190), -0.05] } })),
      sp("stall1", "Kios Satu", [Rc(56, 216, 92, 52, 6), Pa("M48 216 L156 216 L140 192 L64 192 Z")], boxAt("fstall1", "Kios Satu", "stall1", 0.56, 0.32, 0.4, 102, 242)),
      sp("stall2", "Kios Dua", [Rc(196, 222, 88, 46, 6), Pa("M188 222 L292 222 L276 198 L204 198 Z")], boxAt("fstall2", "Kios Dua", "stall2", 0.53, 0.28, 0.38, 240, 245)),
      sp("stall3", "Kios Tiga", [Rc(332, 216, 92, 52, 6), Pa("M324 216 L432 216 L416 192 L340 192 Z")], boxAt("fstall3", "Kios Tiga", "stall3", 0.56, 0.32, 0.4, 378, 242)),
      sp("stringLights", "Lampu Gantung", [Pa("M56 176 C150 196 330 196 424 176 L424 184 C330 204 150 204 56 184 Z")], prismAt("fstring", "Lampu Gantung", "stringLights", [[-1.12, 0.05], [0, -0.05], [1.12, 0.05], [1.12, -0.02], [-1.12, -0.02]], 240, 190, -0.1)),
      sp("goods1", "Jajanan Kios Satu", [Ci(80, 204, 9), Ci(102, 200, 9), Ci(124, 204, 9)], ballAt("fgoods1", "Jajanan Kios Satu", "goods1", 102, 202, 9, 0.25)),
      sp("goods2", "Jajanan Kios Dua", [Rc(216, 236, 20, 16, 4), Rc(244, 236, 20, 16, 4)], boxAt("fgoods2", "Jajanan Kios Dua", "goods2", 0.13, 0.1, 0.11, 229, 244)),
      sp("goods3", "Jajanan Kios Tiga", [E(356, 204, 12, 14), E(382, 200, 12, 14), E(406, 204, 12, 14)], ballAt("fgoods3", "Jajanan Kios Tiga", "goods3", 381, 202, 12, 0.25)),
      sp("path", "Jalan Festival", [Pa("M170 296 L196 268 L284 268 L310 296 Z")], discAt("fpath", "Jalan Festival", "path", 240, 282, 66, 0.02))),
    [], [{ el: Ci(150, 104, 4), fill: "#FFC93C", stroke: INK, sw: 2 }, { el: Ci(268, 79, 3.2), fill: "#FFC93C", stroke: INK, sw: 2 }]),
];

// Human characters share the same region data and paper craft renderer.
function humanArt(kind:string,level:number):BuiltArt {
 const baby=kind.startsWith("baby"), longHair=["girl","mother","baby-girl","girl-buns"].includes(kind);
 const hair=kind==="boy-curly"?[E(240,111,78,81),E(199,49,29,23),E(240,37,30,24),E(281,49,29,23)]:kind==="girl-buns"?[E(240,111,78,81),E(174,61,28,29),E(306,61,28,29)]:[E(240,111,78,81),...(longHair?[E(178,155,25,55),E(302,155,25,55)]:[])];
 const regions:RegionDef[]=[
  {id:"hair",label:"Rambut",els:hair},
  {id:"clothes",label:"Baju",els:[Rc(181,175,118,83,24)]},
  {id:"skin",label:"Wajah dan tangan",els:[E(240,125,65,64),E(174,211,19,26),E(306,211,19,26)]},
  {id:"pants",label:baby?"Popok":"Celana",els:[Rc(193,244,42,44,13),Rc(245,244,42,44,13)]},
 ];
 const parts:CraftPart[]=[
  ballPart({id:"head",label:"Kepala",assembly:"Rakit kepala.",r:.46,region:"skin",transform:{t:[0,.57,0]}}),
  ballPart({id:"hair",label:"Rambut",assembly:"Rakit rambut.",r:.48,region:"hair",transform:{s:[1,.55,1],t:[0,.83,-.04]}}),
  boxPart({id:"body",label:"Baju",assembly:"Lipat badan.",w:.69,h:.5,d:.35,regions:{front:"clothes",back:"clothes",left:"clothes",right:"clothes",top:"clothes",bottom:"clothes"},transform:{t:[0,-.22,0]}}),
  ...[-1,1].map(i=>boxPart({id:"leg"+i,label:"Kaki",assembly:"Lipat kaki.",w:.22,h:.29,d:.25,regions:{front:"pants",back:"pants",left:"pants",right:"pants",top:"pants",bottom:"pants"},transform:{t:[i*.16,-.61,0]}})),
 ];
 const details:DetailEl[]=[...eyesAt(240,120,24,6),smileAt(240,145,24)];
 if(level>=2){regions.push({id:"shoes",label:"Sepatu",els:[E(211,286,24,12),E(269,286,24,12)]});parts.push(...[-1,1].map(i=>boxPart({id:"shoe"+i,label:"Sepatu",assembly:"Lipat sepatu.",w:.27,h:.12,d:.32,regions:{front:"shoes",back:"shoes",left:"shoes",right:"shoes",top:"shoes",bottom:"shoes"},transform:{t:[i*.16,-.82,.04]}})));}
 if(level>=3){regions.push({id:"badge",label:"Lencana",els:[Ci(240,208,16)]});parts.push(flatPart({id:"badge",label:"Lencana",assembly:"Tempel lencana.",poly:discPoly(.10),region:"badge",transform:{t:[0,-.16,.19]}}));}
 if(level>=4||["chef","doctor","pilot","police","astronaut"].includes(kind)){regions.push({id:"accessory",label:"Aksesori",els:kind==="chef"?[E(210,48,24,25),E(240,40,28,30),E(270,48,24,25),Rc(183,60,114,25,5)]:kind==="doctor"?[Rc(195,52,90,30,8)]:kind==="astronaut"?[E(240,125,79,78)]:[E(240,57,54,21)]});if(kind==="astronaut"){const a=regions.pop()!;regions.unshift(a);}parts.push(boxPart({id:"accessory",label:"Aksesori",assembly:"Lipat aksesori.",w:.54,h:.16,d:.22,regions:{front:"accessory",back:"accessory",left:"accessory",right:"accessory",top:"accessory",bottom:"accessory"},transform:{t:[0,1.02,0]}}));}
 if(level>=5){regions.push({id:"pocket",label:"Saku",els:[Rc(252,224,24,18,4)]},{id:"ball",label:"Bola",els:[Ci(351,270,27)]});parts.push(flatPart({id:"pocket",label:"Saku",assembly:"Tempel saku.",poly:[[-.08,-.06],[.08,-.06],[.08,.06],[-.08,.06]],region:"pocket",transform:{t:[.16,-.31,.19]}}),ballPart({id:"ball",label:"Bola",assembly:"Rakit bola.",r:.16,region:"ball",transform:{t:[.7,-.75,0]}}));}
 return {regions,details,parts};
}
const humanKinds=[["baby-boy","Bayi Laki-laki"],["baby-girl","Bayi Perempuan"],["boy","Anak Laki-laki"],["girl","Anak Perempuan"],["mother","Mama"],["father","Papa"],["doctor","Dokter"],["chef","Koki"],["teacher","Guru"],["pilot","Pilot"],["astronaut","Astronaut"],["police","Polisi"]];
const humanBands:Meta["band"][]=["9-18bln","1-2th","2-3th","3-4th","4-5th"];
const humanNames=[["Arka","Nara","Bima","Luna","Rafi","Mila"],["Hugo","Lila","Kai","Sofia","Reza","Kirana"],["Niko","Naya","Adam","Aisha","Damar","Alya"],["Leo","Maya","Raka","Hana","Faris","Zara"],["Ethan","Emma","Sam","Ella","Dimas","Amara"]];
const HUMAN_TEMPLATES=humanBands.flatMap((band,i)=>[...humanKinds,["boy-curly","Anak Laki-laki"],["girl-buns","Anak Perempuan"]].map(([kind,name],j)=>{
 const personal=j<4?humanNames[i]![j]:j>=humanKinds.length?humanNames[i]![j-humanKinds.length+4]:undefined;
 const title=personal?personal+" — "+name:name!;
 return finish({id:"human-"+kind+"-"+(i+1),name:title,collection:"little-people",blurb:"Warnai tokoh kecil dengan warna pilihanmu.",band,who:personal??name!},humanArt(kind!,i+1));
}));
export const KOLEKSI_TEMPLATES: TemplateDef[] = [...L1, ...L2, ...L3, ...L4, ...L5, ...L5B,...HUMAN_TEMPLATES];
