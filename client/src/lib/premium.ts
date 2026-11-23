// Koleksi Premium Bun & Fleur Kids — 20 ilustrasi gambar-tangan baru,
// empat per kategori umur, digambar dengan satu bahasa desain yang sama:
// siluet organik bulat, wajah ramah, garis bersih, tanpa dekorasi acak,
// tanpa bintang/sparkles, tanpa bayangan abu di dalam bidang warna.
// Setiap ilustrasi adalah template mewarnai SUNGGUHAN: region SVG
// tertutup dengan id stabil, bagian papercraft 3D dari primitif yang
// sama dengan katalog (model 3D dan jaring cetak dibangun dari bagian
// yang sama persis), dan cetakan Bantal Kertas dari gambarnya sendiri.
//
// Tingkat kesulitan mengikuti brief per level:
//   Level 1 (9–18 bln)  : 2–3 bidang sangat besar, satu subjek tunggal.
//   Level 2 (18–24 bln) : 4–5 bidang besar yang mudah dibedakan.
//   Level 3 (2–3 th)    : 6 bidang dengan detail karakter yang jelas.
//   Level 4 (3–4 th)    : 8–9 bidang + elemen lingkungan sederhana.
//   Level 5 (4–5 th)    : 14–15 bidang, adegan bercerita yang lebih kaya.

import type { DetailEl, NetDef, NetOptions, TemplateDef } from "./model";
import { INK } from "./model";
import {
  boxPart,
  buildCraftNet,
  discPoly,
  flatPart,
  lathePart,
  partsToFaces,
  prismPart,
  rectPoly,
  type CraftPart,
  type XfOpts,
} from "./papercraft";

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

/** Badan telur (seperti dino unggulan): tambalan perut adalah faset
 * depan-bawah dari lathe yang sama, jadi warna perut anak mendarat di
 * tempat yang sama di 3D dan di cetakan. */
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

function mkTemplate(
  o: Omit<TemplateDef, "buildModel" | "buildNet"> & { steps: string[] },
): TemplateDef {
  const { steps, buildParts, ...rest } = o;
  if (!buildParts) throw new Error(`Template ${o.id} tidak punya buildParts`);
  return {
    ...rest,
    buildParts,
    buildModel: () => partsToFaces(buildParts()),
    buildNet: (opts?: NetOptions): NetDef =>
      buildCraftNet(buildParts(), opts, { steps, orientation: "portrait" }).net,
  };
}

function stepsFrom(parts: CraftPart[]): string[] {
  return [
    STEP_GUNTING,
    STEP_LIPAT,
    ...parts.filter((p) => p.id !== "nameplate").map((p) => `${p.label}: ${p.assembly}`),
    "Papan nama: lipat papan nama dan berdirikan di depan. Selesai!",
  ];
}

/* ------------------------- detail wajah ------------------------- */

function eyesAt(cx: number, cy: number, dx: number, r = 8): DetailEl[] {
  const one = (x: number): DetailEl[] => [
    { el: { t: "circle", cx: x, cy, r }, fill: INK },
    { el: { t: "circle", cx: x + r * 0.35, cy: cy - r * 0.35, r: r * 0.38 }, fill: "#FFFFFF" },
  ];
  return [...one(cx - dx), ...one(cx + dx)];
}

function smileAt(cx: number, cy: number, w = 26): DetailEl {
  return { el: { t: "path", d: `M${cx - w / 2} ${cy} Q${cx} ${cy + w * 0.55} ${cx + w / 2} ${cy}` }, stroke: INK, sw: 4.5 };
}

function cheeksAt(cx: number, cy: number, dx: number, r = 11): DetailEl[] {
  return [
    { el: { t: "circle", cx: cx - dx, cy, r }, fill: "#F2A0B5" },
    { el: { t: "circle", cx: cx + dx, cy, r }, fill: "#F2A0B5" },
  ];
}

function groundAt(cy = 300, rx = 150): DetailEl {
  return { el: { t: "ellipse", cx: 240, cy, rx, ry: 10 }, fill: "#3B323014" };
}

/* ================================================================== */
/* LEVEL 1 — LITTLE DISCOVERERS (9–18 bulan) · 2–3 bidang raksasa      */
/* ================================================================== */

const beruangParts = memoParts((): CraftPart[] => [
  ballPart({ id: "ears", label: "Telinga", assembly: "Buat dua bola telinga kecil dan rekatkan di atas kepala.", r: 0.17, region: "ears", transform: { t: [-0.52, 0.52, 0] } }),
  ballPart({ id: "ears-2", label: "Telinga", assembly: "Buat dua bola telinga kecil dan rekatkan di atas kepala.", r: 0.17, region: "ears", transform: { t: [0.52, 0.52, 0] } }),
  ballPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan menjadi bola bundar besar.", r: 0.78, region: "body", transform: { s: [1.12, 1, 0.9], t: [0, -0.18, 0] } }),
  flatPart({ id: "belly", label: "Perut", assembly: "Tempelkan perut bundar di bagian depan badan.", poly: discPoly(0.40), region: "belly", transform: { s: [1, 0.85, 1], t: [0, -0.38, 0.66] } }),
  nameplatePart("beruangmu"),
]);

const beruang: TemplateDef = mkTemplate({
  id: "pb-beruang",
  name: "Beruang Bundar",
  collection: "animal-friends",
  blurb: "Beruang bundar super besar — pas untuk warna pertama si kecil.",
  age: "9–18 bulan", ageBand: "9-18bln",
  difficulty: 1,
  viewBox: [480, 360],
  regions: [
    { id: "ears", label: "Telinga", els: [
      { t: "circle", cx: 168, cy: 104, r: 31 },
      { t: "circle", cx: 312, cy: 104, r: 31 },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 240, cy: 202, rx: 106, ry: 90 },
    ] },
    { id: "belly", label: "Perut", els: [
      { t: "ellipse", cx: 240, cy: 238, rx: 52, ry: 42 },
    ] },
  ],
  details: [
    groundAt(298, 130),
    ...eyesAt(240, 182, 36, 9),
    { el: { t: "ellipse", cx: 240, cy: 204, rx: 13, ry: 9 }, fill: INK },
    smileAt(240, 216, 24),
    ...cheeksAt(240, 214, 74),
  ],
  label: LBL,
  buildParts: beruangParts,
  steps: stepsFrom(beruangParts()),
});

const gajahParts = memoParts((): CraftPart[] => [
  ballPart({ id: "ears", label: "Telinga", assembly: "Buat dua telinga lebar dan rekatkan di kedua sisi kepala.", r: 0.34, region: "ears", transform: { s: [0.35, 1, 1], t: [-0.72, 0.05, 0] } }),
  ballPart({ id: "ears-2", label: "Telinga", assembly: "Buat dua telinga lebar dan rekatkan di kedua sisi kepala.", r: 0.34, region: "ears", transform: { s: [0.35, 1, 1], t: [0.72, 0.05, 0] } }),
  ballPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan menjadi bola besar yang lembut.", r: 0.76, region: "body", transform: { s: [1.15, 1, 0.92], t: [0, -0.16, 0] } }),
  cylPart({ id: "trunk", label: "Belalai", assembly: "Gulung belalai menjadi tabung dan rekatkan menggantung di depan wajah.", r: 0.15, h: 0.52, region: "trunk", transform: { r: [0.15, 0, 0], t: [0, -0.42, 0.68] } }),
  nameplatePart("gajahmu"),
]);

const gajah: TemplateDef = mkTemplate({
  id: "pb-gajah",
  name: "Gajah Ramah",
  collection: "animal-friends",
  blurb: "Gajah lembut bertelinga lebar dan belalai yang ramah.",
  age: "9–18 bulan", ageBand: "9-18bln",
  difficulty: 1,
  viewBox: [480, 360],
  regions: [
    { id: "ears", label: "Telinga", els: [
      { t: "ellipse", cx: 148, cy: 172, rx: 38, ry: 54 },
      { t: "ellipse", cx: 332, cy: 172, rx: 38, ry: 54 },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 240, cy: 196, rx: 102, ry: 88 },
    ] },
    { id: "trunk", label: "Belalai", els: [
      { t: "path", d: "M226 196 C222 232 224 254 240 264 C256 254 258 232 254 196 C246 188 234 188 226 196 Z" },
    ] },
  ],
  details: [
    groundAt(292, 135),
    ...eyesAt(240, 168, 42, 9),
    ...cheeksAt(240, 196, 66),
  ],
  label: LBL,
  buildParts: gajahParts,
  steps: stepsFrom(gajahParts()),
});

const ikanBundarParts = memoParts((): CraftPart[] => [
  prismPart({ id: "tail", label: "Ekor", assembly: "Lipat ekor menjadi prisma dan rekatkan di belakang badan.", poly: [[0, 0.30], [0.34, 0.52], [0.34, -0.52]], depth: 0.14, region: "tail", transform: { t: [0.78, -0.05, 0] } }),
  ballPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan menjadi bola pipih seperti ikan.", r: 0.72, region: "body", transform: { s: [1.3, 0.95, 0.5], t: [-0.08, -0.05, 0] } }),
  prismPart({ id: "fin", label: "Sirip", assembly: "Lipat sirip atas dan rekatkan di punggung ikan.", poly: [[-0.30, 0], [0.30, 0], [0.05, 0.24], [-0.15, 0.24]], depth: 0.12, region: "fin", transform: { t: [-0.12, 0.62, 0] } }),
  nameplatePart("ikanmu"),
]);

const ikanBundar: TemplateDef = mkTemplate({
  id: "pb-ikan-bundar",
  name: "Ikan Bundar",
  collection: "animal-friends",
  blurb: "Ikan bundar yang selalu tersenyum, berenang pelan-pelan.",
  age: "9–18 bulan", ageBand: "9-18bln",
  difficulty: 1,
  viewBox: [480, 360],
  regions: [
    { id: "tail", label: "Ekor", els: [
      { t: "path", d: "M316 198 C348 166 368 152 378 158 C388 190 388 208 378 240 C368 246 348 232 316 202 Z" },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 222, cy: 199, rx: 106, ry: 80 },
    ] },
    { id: "fin", label: "Sirip Atas", els: [
      { t: "path", d: "M182 128 C202 98 246 96 264 124 C242 138 204 140 182 128 Z" },
    ] },
  ],
  details: [
    groundAt(292, 140),
    ...eyesAt(168, 184, 0, 10),
    smileAt(150, 214, 22),
    ...cheeksAt(196, 218, 0, 11),
  ],
  label: LBL,
  buildParts: ikanBundarParts,
  steps: stepsFrom(ikanBundarParts()),
});

const kelinciMungilParts = memoParts((): CraftPart[] => [
  conePart({ id: "ears", label: "Telinga", assembly: "Buat dua telinga panjang dan rekatkan tegak di atas kepala.", r: 0.13, h: 0.55, region: "ears", transform: { s: [1, 1, 0.45], t: [-0.28, 0.72, 0] } }),
  conePart({ id: "ears-2", label: "Telinga", assembly: "Buat dua telinga panjang dan rekatkan tegak di atas kepala.", r: 0.13, h: 0.55, region: "ears", transform: { s: [1, 1, 0.45], t: [0.28, 0.72, 0] } }),
  ballPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan menjadi bola bundar yang empuk.", r: 0.76, region: "body", transform: { s: [1.08, 1, 0.9], t: [0, -0.2, 0] } }),
  flatPart({ id: "belly", label: "Perut", assembly: "Tempelkan perut bundar di bagian depan badan.", poly: discPoly(0.36), region: "belly", transform: { s: [1, 0.85, 1], t: [0, -0.42, 0.64] } }),
  nameplatePart("kelincimu"),
]);

const kelinciMungil: TemplateDef = mkTemplate({
  id: "pb-kelinci-mungil",
  name: "Kelinci Mungil",
  collection: "animal-friends",
  blurb: "Kelinci mungil bertelinga panjang yang suka duduk manis.",
  age: "9–18 bulan", ageBand: "9-18bln",
  difficulty: 1,
  viewBox: [480, 360],
  regions: [
    { id: "ears", label: "Telinga", els: [
      { t: "path", d: "M204 120 C190 70 194 32 211 28 C228 32 233 74 224 120 Z" },
      { t: "path", d: "M256 120 C247 74 252 32 269 28 C286 32 290 70 276 120 Z" },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 240, cy: 208, rx: 96, ry: 84 },
    ] },
    { id: "belly", label: "Perut", els: [
      { t: "ellipse", cx: 240, cy: 242, rx: 46, ry: 37 },
    ] },
  ],
  details: [
    groundAt(296, 128),
    { el: { t: "path", d: "M209 108 C202 76 204 50 211 44 C218 50 220 78 215 108 Z" }, fill: "#FFFFFF", stroke: INK, sw: 3 },
    { el: { t: "path", d: "M265 108 C260 78 262 50 269 44 C276 50 278 76 271 108 Z" }, fill: "#FFFFFF", stroke: INK, sw: 3 },
    ...eyesAt(240, 192, 34, 9),
    { el: { t: "path", d: "M232 208 L248 208 L240 218 Z" }, fill: "#D6336C" },
    smileAt(240, 222, 22),
    ...cheeksAt(240, 216, 66),
  ],
  label: LBL,
  buildParts: kelinciMungilParts,
  steps: stepsFrom(kelinciMungilParts()),
});

/* ================================================================== */
/* LEVEL 2 — LITTLE EXPLORERS (18–24 bulan) · 4–5 bidang besar         */
/* ================================================================== */

const bebekKolamParts = memoParts((): CraftPart[] => [
  flatPart({ id: "pond", label: "Kolam", assembly: "Letakkan cakram kolam pipih sebagai alas tempat bebekmu berenang.", poly: discPoly(0.95), region: "pond", transform: { r: [Math.PI / 2, 0, 0], s: [1.25, 1, 0.5], t: [0, -0.88, 0.1] } }),
  ballPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan menjadi bola pipih yang mengapung.", r: 0.62, region: "body", transform: { s: [1.25, 0.9, 0.95], t: [-0.18, -0.42, 0] } }),
  ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di depan atas badan.", r: 0.33, region: "head", transform: { t: [0.52, 0.18, 0] } }),
  conePart({ id: "beak", label: "Paruh", assembly: "Gulung paruh menjadi kerucut kecil dan rekatkan di depan kepala.", r: 0.13, h: 0.3, region: "beak", transform: { r: [0, 0, -Math.PI / 2], t: [0.88, 0.14, 0] } }),
  flatPart({ id: "wing", label: "Sayap", assembly: "Tempelkan sayap pipih di sisi badan.", poly: discPoly(0.30), region: "wing", transform: { s: [1.2, 0.8, 1], t: [-0.2, -0.36, 0.56] } }),
  nameplatePart("bebekmu"),
]);

const bebekKolam: TemplateDef = mkTemplate({
  id: "pb-bebek-kolam",
  name: "Bebek di Kolam",
  collection: "animal-friends",
  blurb: "Bebek ceria yang berenang santai di kolam bundarnya.",
  age: "18–24 bulan", ageBand: "1-2th",
  difficulty: 1,
  viewBox: [480, 360],
  regions: [
    { id: "pond", label: "Kolam", els: [
      { t: "ellipse", cx: 240, cy: 274, rx: 152, ry: 30 },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 222, cy: 206, rx: 90, ry: 63 },
    ] },
    { id: "wing", label: "Sayap", els: [
      { t: "path", d: "M182 192 C212 172 250 182 257 208 C251 234 216 244 190 229 C175 218 173 203 182 192 Z" },
    ] },
    { id: "head", label: "Kepala", els: [
      { t: "circle", cx: 324, cy: 138, r: 45 },
    ] },
    { id: "beak", label: "Paruh", els: [
      { t: "ellipse", cx: 364, cy: 147, rx: 25, ry: 14 },
    ] },
  ],
  details: [
    ...eyesAt(332, 130, 0, 8),
    ...cheeksAt(304, 152, 0, 10),
    { el: { t: "path", d: "M120 276 C150 268 180 284 210 276" }, stroke: INK, sw: 3.5 },
    { el: { t: "path", d: "M262 282 C292 274 322 288 352 281" }, stroke: INK, sw: 3.5 },
  ],
  label: LBL,
  buildParts: bebekKolamParts,
  steps: stepsFrom(bebekKolamParts()),
});

const kuraParts = memoParts((): CraftPart[] => [
  lathePart({ id: "shell", label: "Tempurung", assembly: "Rekatkan strip tempurung menjadi kubah bundar.", profile: [
    { r: 0.78, y: -0.42 }, { r: 0.80, y: -0.30 }, { r: 0.72, y: -0.02 }, { r: 0.52, y: 0.22 }, { r: 0.26, y: 0.38 }, { r: 0, y: 0.44 },
  ], segments: 8, region: "shell", capBottomRegion: "shell", transform: { s: [1.15, 1, 0.95], t: [-0.08, -0.42, 0] } }),
  ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan menjulur di depan tempurung.", r: 0.30, region: "head", transform: { t: [0.78, -0.28, 0] } }),
  flatPart({ id: "pattern", label: "Corak", assembly: "Tempelkan corak bundar di atas tempurung.", poly: discPoly(0.20), region: "pattern", transform: { r: [-0.5, 0, 0], t: [-0.1, 0.06, 0.42] } }),
  cylPart({ id: "feet", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah tempurung.", r: 0.16, h: 0.16, region: "feet", transform: { t: [-0.45, -0.9, 0.2] } }),
  cylPart({ id: "feet-2", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah tempurung.", r: 0.16, h: 0.16, region: "feet", transform: { t: [0.35, -0.9, 0.2] } }),
  nameplatePart("kura-kuramu"),
]);

const kura: TemplateDef = mkTemplate({
  id: "pb-kura",
  name: "Kura-kura Ceria",
  collection: "animal-friends",
  blurb: "Kura-kura santai bercorak bundar yang tidak pernah terburu-buru.",
  age: "18–24 bulan", ageBand: "1-2th",
  difficulty: 1,
  viewBox: [480, 360],
  regions: [
    { id: "feet", label: "Kaki", els: [
      { t: "ellipse", cx: 158, cy: 274, rx: 31, ry: 14 },
      { t: "ellipse", cx: 322, cy: 274, rx: 31, ry: 14 },
    ] },
    { id: "shell", label: "Tempurung", els: [
      { t: "path", d: "M118 252 C118 162 174 104 240 104 C306 104 362 162 362 252 C362 264 350 270 336 270 L144 270 C130 270 118 264 118 252 Z" },
    ] },
    { id: "pattern", label: "Corak Tempurung", els: [
      { t: "circle", cx: 198, cy: 166, r: 24 },
      { t: "circle", cx: 264, cy: 148, r: 20 },
      { t: "circle", cx: 246, cy: 216, r: 26 },
    ] },
    { id: "head", label: "Kepala", els: [
      { t: "circle", cx: 368, cy: 196, r: 41 },
    ] },
  ],
  details: [
    groundAt(294, 140),
    ...eyesAt(378, 188, 0, 8),
    smileAt(382, 208, 20),
    ...cheeksAt(348, 210, 0, 10),
  ],
  label: LBL,
  buildParts: kuraParts,
  steps: stepsFrom(kuraParts()),
});

const mobilKecilParts = memoParts((): CraftPart[] => [
  boxPart({ id: "body", label: "Badan Mobil", assembly: "Lipat badan mobil menjadi kotak bundar yang kokoh.", w: 1.7, h: 0.62, d: 0.85, regions: { front: "body", back: "body", left: "body", right: "body", top: "body", bottom: "body" }, transform: { t: [0, -0.55, 0] } }),
  boxPart({ id: "cabin", label: "Kabin", assembly: "Lipat kabin dan rekatkan di atas badan mobil.", w: 0.95, h: 0.45, d: 0.78, regions: { front: "windows", back: "body", left: "windows", right: "windows", top: "body", bottom: "body" }, transform: { t: [-0.05, -0.02, 0] } }),
  cylPart({ id: "wheel-1", label: "Roda", assembly: "Gulung keempat roda dan rekatkan di sudut-sudut badan.", r: 0.21, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [-0.55, -0.86, 0.44] } }),
  cylPart({ id: "wheel-2", label: "Roda", assembly: "Gulung keempat roda dan rekatkan di sudut-sudut badan.", r: 0.21, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [0.55, -0.86, 0.44] } }),
  cylPart({ id: "wheel-3", label: "Roda", assembly: "Gulung keempat roda dan rekatkan di sudut-sudut badan.", r: 0.21, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [-0.55, -0.86, -0.44] } }),
  cylPart({ id: "wheel-4", label: "Roda", assembly: "Gulung keempat roda dan rekatkan di sudut-sudut badan.", r: 0.21, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [0.55, -0.86, -0.44] } }),
  flatPart({ id: "lights", label: "Lampu", assembly: "Tempelkan dua lampu bundar di depan mobil.", poly: discPoly(0.09), region: "lights", transform: { t: [0.86, -0.5, 0.22] } }),
  flatPart({ id: "lights-2", label: "Lampu", assembly: "Tempelkan dua lampu bundar di depan mobil.", poly: discPoly(0.09), region: "lights", transform: { t: [0.86, -0.5, -0.22] } }),
  nameplatePart("mobilmu"),
]);

const mobilKecil: TemplateDef = mkTemplate({
  id: "pb-mobil-kecil",
  name: "Mobil Kecil",
  collection: "little-vehicles",
  blurb: "Mobil kecil berwajah ramah yang siap berkeliling kota.",
  age: "18–24 bulan", ageBand: "1-2th",
  difficulty: 1,
  viewBox: [480, 360],
  regions: [
    { id: "body", label: "Badan Mobil", els: [
      { t: "path", d: "M108 242 C108 206 126 190 164 184 L186 148 C191 137 203 130 219 130 L283 130 C299 130 311 137 317 148 L336 184 C364 190 376 206 376 242 C376 254 367 260 355 260 L129 260 C117 260 108 254 108 242 Z" },
    ] },
    { id: "windows", label: "Jendela", els: [
      { t: "rect", x: 198, y: 148, w: 54, h: 32, rx: 9 },
      { t: "rect", x: 262, y: 148, w: 50, h: 32, rx: 9 },
    ] },
    { id: "lights", label: "Lampu", els: [
      { t: "circle", cx: 130, cy: 216, r: 11 },
      { t: "circle", cx: 354, cy: 216, r: 11 },
    ] },
    { id: "wheels", label: "Roda", els: [
      { t: "circle", cx: 166, cy: 260, r: 27 },
      { t: "circle", cx: 318, cy: 260, r: 27 },
    ] },
  ],
  details: [
    groundAt(296, 150),
    { el: { t: "circle", cx: 166, cy: 260, r: 10 }, fill: "#FFFFFF", stroke: INK, sw: 3.5 },
    { el: { t: "circle", cx: 318, cy: 260, r: 10 }, fill: "#FFFFFF", stroke: INK, sw: 3.5 },
    ...eyesAt(242, 206, 26, 7),
    smileAt(242, 222, 24),
  ],
  label: LBL,
  buildParts: mobilKecilParts,
  steps: stepsFrom(mobilKecilParts()),
});

const kupuParts = memoParts((): CraftPart[] => [
  prismPart({ id: "wings-l", label: "Sayap", assembly: "Lipat kedua sayap pipih dan rekatkan di belakang badan.", poly: [[0, 0.42], [-0.62, 0.55], [-0.78, 0.05], [-0.45, -0.28], [-0.62, -0.62], [-0.05, -0.5]], depth: 0.08, region: "wings", transform: { t: [-0.05, 0.05, -0.12] } }),
  prismPart({ id: "wings-r", label: "Sayap", assembly: "Lipat kedua sayap pipih dan rekatkan di belakang badan.", poly: [[0, 0.42], [0.62, 0.55], [0.78, 0.05], [0.45, -0.28], [0.62, -0.62], [0.05, -0.5]], depth: 0.08, region: "wings", transform: { t: [0.05, 0.05, -0.12] } }),
  cylPart({ id: "body", label: "Badan", assembly: "Gulung badan menjadi tabung tegak.", r: 0.17, h: 0.95, region: "body", transform: { t: [0, -0.28, 0] } }),
  ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di atas badan.", r: 0.24, region: "head", transform: { t: [0, 0.38, 0] } }),
  flatPart({ id: "spots", label: "Corak Sayap", assembly: "Tempelkan corak bundar di kedua sayap.", poly: discPoly(0.13), region: "spots", transform: { t: [-0.52, 0.22, -0.06] } }),
  flatPart({ id: "spots-2", label: "Corak Sayap", assembly: "Tempelkan corak bundar di kedua sayap.", poly: discPoly(0.13), region: "spots", transform: { t: [0.52, 0.22, -0.06] } }),
  nameplatePart("kupu-kupumu"),
]);

const kupu: TemplateDef = mkTemplate({
  id: "pb-kupu",
  name: "Kupu-kupu Senyum",
  collection: "magical-garden",
  blurb: "Kupu-kupu bersayap lebar yang hinggap dari bunga ke bunga.",
  age: "18–24 bulan", ageBand: "1-2th",
  difficulty: 1,
  viewBox: [480, 360],
  regions: [
    { id: "wings", label: "Sayap", els: [
      { t: "path", d: "M232 152 C172 92 106 94 102 142 C98 184 160 198 230 184 Z" },
      { t: "path", d: "M248 152 C308 92 374 94 378 142 C382 184 320 198 250 184 Z" },
      { t: "path", d: "M230 202 C168 196 126 214 132 246 C138 278 206 264 232 226 Z" },
      { t: "path", d: "M250 202 C312 196 354 214 348 246 C342 278 274 264 248 226 Z" },
    ] },
    { id: "spots", label: "Corak Sayap", els: [
      { t: "circle", cx: 152, cy: 142, r: 16 },
      { t: "circle", cx: 328, cy: 142, r: 16 },
      { t: "circle", cx: 168, cy: 234, r: 12 },
      { t: "circle", cx: 312, cy: 234, r: 12 },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 240, cy: 192, rx: 24, ry: 60 },
    ] },
    { id: "head", label: "Kepala", els: [
      { t: "circle", cx: 240, cy: 106, r: 31 },
    ] },
  ],
  details: [
    { el: { t: "path", d: "M226 80 C218 58 204 46 190 42" }, stroke: INK, sw: 4 },
    { el: { t: "path", d: "M254 80 C262 58 276 46 290 42" }, stroke: INK, sw: 4 },
    { el: { t: "circle", cx: 188, cy: 40, r: 6 }, fill: INK },
    { el: { t: "circle", cx: 292, cy: 40, r: 6 }, fill: INK },
    ...eyesAt(240, 102, 13, 6.5),
    smileAt(240, 114, 16),
    ...cheeksAt(240, 116, 26, 8),
  ],
  label: LBL,
  buildParts: kupuParts,
  steps: stepsFrom(kupuParts()),
});

/* ================================================================== */
/* LEVEL 3 — LITTLE ARTISTS (2–3 tahun) · 6 bidang + detail karakter   */
/* ================================================================== */

/** Bagian dino premium dipakai bersama oleh Baby Dino (Level 3) dan
 * Dino di Taman (Level 4) — geometri yang sama, adegan berbeda. */
function babyDinoParts(who: string): CraftPart[] {
  return [
    eggBodyPart({
      id: "body", label: "Badan",
      assembly: "Rekatkan strip badan satu sambungan setiap kalinya. Tambalan perut menghadap ke depan.",
      body: "body", belly: "belly",
      transform: { s: [1.28, 0.98, 0.86], t: [-0.10, -0.30, 0] },
    }),
    ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di depan atas badan.", r: 0.42, region: "head", transform: { s: [1.05, 0.95, 0.92], t: [0.58, 0.22, 0] } }),
    lathePart({
      id: "tail", label: "Ekor",
      assembly: "Buat ekor menjadi tabung melengkung yang meruncing dan rekatkan ujung lebarnya di belakang badan.",
      profile: [
        { r: 0.25, y: 0, cx: 0 }, { r: 0.235, y: 0.18, cx: 0.01 }, { r: 0.195, y: 0.38, cx: 0.04 },
        { r: 0.135, y: 0.56, cx: 0.09 }, { r: 0.07, y: 0.72, cx: 0.15 }, { r: 0, y: 0.82, cx: 0.20 },
      ],
      segments: 6, region: "tail",
      transform: { r: [0, 0, 1.65], t: [-0.66, -0.44, 0] },
    }),
    prismPart({ id: "spike-1", label: "Duri", assembly: "Lipat setiap duri sampai tertutup dan rekatkan di sepanjang punggung.", poly: [[-0.09, 0], [0.09, 0], [0, 0.30]], depth: 0.10, region: "spikes", transform: { t: [-0.42, 0.14, -0.05], r: [0, 0, -0.3], s: [1, 1, 1] } }),
    prismPart({ id: "spike-2", label: "Duri", assembly: "Lipat setiap duri sampai tertutup dan rekatkan di sepanjang punggung.", poly: [[-0.09, 0], [0.09, 0], [0, 0.30]], depth: 0.10, region: "spikes", transform: { t: [-0.08, 0.24, -0.05], r: [0, 0, -0.18], s: [1.2, 1.2, 1] } }),
    prismPart({ id: "spike-3", label: "Duri", assembly: "Lipat setiap duri sampai tertutup dan rekatkan di sepanjang punggung.", poly: [[-0.09, 0], [0.09, 0], [0, 0.30]], depth: 0.10, region: "spikes", transform: { t: [0.28, 0.22, -0.05], r: [0, 0, -0.08], s: [1.05, 1.05, 1] } }),
    cylPart({ id: "foot-1", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah badan, telapak lebar menghadap ke bawah.", r: 0.17, h: 0.22, region: "feet", transform: { t: [-0.42, -0.92, 0.16] } }),
    cylPart({ id: "foot-2", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah badan, telapak lebar menghadap ke bawah.", r: 0.17, h: 0.22, region: "feet", transform: { t: [0.30, -0.92, 0.16] } }),
    nameplatePart(who),
  ];
}

const babyDinoPartsMemo = memoParts(() => babyDinoParts("dinomu"));

const babyDino: TemplateDef = mkTemplate({
  id: "pb-dino",
  name: "Baby Dino",
  collection: "dino-world",
  blurb: "Dinosaurus kecil yang penuh imajinasi.",
  age: "2–3 tahun", ageBand: "2-3th",
  difficulty: 2,
  viewBox: [480, 360],
  regions: [
    { id: "tail", label: "Ekor", els: [
      { t: "path", d: "M120 232 C72 226 44 200 50 172 C55 150 78 142 100 152 L128 190 C138 210 134 226 120 232 Z" },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "path", d: "M120 130 C122 84 170 52 228 54 C288 56 326 94 330 148 C334 202 312 246 268 260 L170 260 C140 246 118 192 120 130 Z" },
    ] },
    { id: "feet", label: "Kaki", els: [
      { t: "ellipse", cx: 168, cy: 272, rx: 28, ry: 13 },
      { t: "ellipse", cx: 268, cy: 272, rx: 28, ry: 13 },
    ] },
    { id: "spikes", label: "Duri", els: [
      { t: "path", d: "M150 92 L176 48 L202 88 Z" },
      { t: "path", d: "M208 64 L238 24 L262 66 Z" },
      { t: "path", d: "M266 62 L298 30 L314 74 Z" },
    ] },
    { id: "head", label: "Kepala", els: [
      { t: "circle", cx: 348, cy: 106, r: 56 },
    ] },
    { id: "belly", label: "Perut", els: [
      { t: "path", d: "M208 146 C242 146 264 176 262 212 C260 242 238 260 212 258 C187 256 172 232 176 200 C180 170 191 146 208 146 Z" },
    ] },
  ],
  details: [
    groundAt(292, 165),
    ...eyesAt(358, 94, 0, 9),
    { el: { t: "circle", cx: 396, cy: 116, r: 4.5 }, fill: INK },
    { el: { t: "path", d: "M382 138 C390 145 401 145 407 138" }, stroke: INK, sw: 4 },
    ...cheeksAt(330, 128, 0, 11),
  ],
  label: LBL,
  regionFallbacks: { belly: "body" },
  buildParts: babyDinoPartsMemo,
  steps: stepsFrom(babyDinoPartsMemo()),
});

const singaParts = memoParts((): CraftPart[] => [
  conePart({ id: "tail", label: "Ekor", assembly: "Gulung ekor menjadi kerucut melengkung dan rekatkan di sisi badan.", r: 0.10, h: 0.55, region: "tail", transform: { r: [0, 0, -0.9], t: [0.62, -0.55, -0.1] } }),
  ballPart({ id: "body", label: "Badan", assembly: "Buat bola badan duduk dan letakkan di bawah kepala.", r: 0.42, region: "body", transform: { s: [1.25, 0.7, 0.95], t: [0, -0.72, 0] } }),
  cylPart({ id: "mane", label: "Surai", assembly: "Gulung surai menjadi cakram tebal di belakang wajah.", r: 0.62, h: 0.22, region: "mane", transform: { r: [Math.PI / 2, 0, 0], t: [0, 0.18, -0.10] } }),
  ballPart({ id: "ears", label: "Telinga", assembly: "Buat dua bola telinga kecil dan rekatkan di atas surai.", r: 0.14, region: "ears", transform: { t: [-0.5, 0.68, 0] } }),
  ballPart({ id: "ears-2", label: "Telinga", assembly: "Buat dua bola telinga kecil dan rekatkan di atas surai.", r: 0.14, region: "ears", transform: { t: [0.5, 0.68, 0] } }),
  ballPart({ id: "face", label: "Wajah", assembly: "Buat bola wajah dan rekatkan di tengah surai.", r: 0.44, region: "face", transform: { t: [0, 0.16, 0.14] } }),
  flatPart({ id: "muzzle", label: "Moncong", assembly: "Tempelkan moncong bundar di bawah wajah.", poly: discPoly(0.20), region: "muzzle", transform: { s: [1.25, 0.85, 1], t: [0, -0.02, 0.55] } }),
  nameplatePart("singamu"),
]);

const singa: TemplateDef = mkTemplate({
  id: "pb-singa-kecil",
  name: "Singa Kecil",
  collection: "animal-friends",
  blurb: "Singa kecil bersurai lebat yang berani tapi lembut.",
  age: "2–3 tahun", ageBand: "2-3th",
  difficulty: 2,
  viewBox: [480, 360],
  regions: [
    { id: "tail", label: "Ekor", els: [
      { t: "path", d: "M316 244 C352 240 370 216 360 192 C376 216 368 254 330 260 Z" },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 240, cy: 264, rx: 64, ry: 34 },
    ] },
    { id: "mane", label: "Surai", els: [
      { t: "circle", cx: 240, cy: 150, r: 80 },
    ] },
    { id: "ears", label: "Telinga", els: [
      { t: "circle", cx: 172, cy: 90, r: 20 },
      { t: "circle", cx: 308, cy: 90, r: 20 },
    ] },
    { id: "face", label: "Wajah", els: [
      { t: "circle", cx: 240, cy: 152, r: 56 },
    ] },
    { id: "muzzle", label: "Moncong", els: [
      { t: "ellipse", cx: 240, cy: 180, rx: 30, ry: 20 },
    ] },
  ],
  details: [
    groundAt(296, 130),
    ...eyesAt(240, 144, 21, 7.5),
    { el: { t: "path", d: "M229 166 L251 166 L240 178 Z" }, fill: "#D6336C" },
    { el: { t: "path", d: "M240 178 C240 186 232 190 224 188 M240 178 C240 186 248 190 256 188" }, stroke: INK, sw: 3.5 },
    ...cheeksAt(240, 168, 48, 10),
    { el: { t: "circle", cx: 366, cy: 184, r: 10 }, fill: INK },
  ],
  label: LBL,
  buildParts: singaParts,
  steps: stepsFrom(singaParts()),
});

const roketRamahParts = memoParts((): CraftPart[] => [
  lathePart({
    id: "body", label: "Badan Roket",
    assembly: "Rekatkan strip badan menjadi tabung roket yang bulat. Hidung di atas, garis warna di tengah.",
    profile: [
      { r: 0.40, y: -0.62 }, { r: 0.45, y: -0.50 }, { r: 0.46, y: -0.30 }, { r: 0.44, y: 0.02 },
      { r: 0.38, y: 0.30 }, { r: 0.26, y: 0.52 }, { r: 0.10, y: 0.66 }, { r: 0, y: 0.72 },
    ],
    segments: 8,
    region: (band) => (band >= 6 ? "nose" : band === 3 ? "stripe" : "body"),
    capBottomRegion: "body",
    transform: { t: [0, -0.05, 0] },
  }),
  flatPart({ id: "window", label: "Jendela", assembly: "Tempelkan jendela bundar di depan badan roket.", poly: discPoly(0.17), region: "window", transform: { t: [0, 0.12, 0.44] } }),
  prismPart({ id: "fin-l", label: "Sirip", assembly: "Lipat kedua sirip dan rekatkan di sisi bawah roket.", poly: [[0, 0.28], [0, -0.28], [-0.30, -0.30], [-0.26, 0.02]], depth: 0.09, region: "fins", transform: { t: [-0.44, -0.48, 0] } }),
  prismPart({ id: "fin-r", label: "Sirip", assembly: "Lipat kedua sirip dan rekatkan di sisi bawah roket.", poly: [[0, 0.28], [0, -0.28], [0.30, -0.30], [0.26, 0.02]], depth: 0.09, region: "fins", transform: { t: [0.44, -0.48, 0] } }),
  conePart({ id: "flame", label: "Api", assembly: "Gulung api menjadi kerucut dan rekatkan mengarah ke bawah.", r: 0.20, h: 0.42, region: "flame", transform: { r: [Math.PI, 0, 0], t: [0, -0.88, 0] } }),
  nameplatePart("roketmu"),
]);

const roketRamah: TemplateDef = mkTemplate({
  id: "pb-roket-ramah",
  name: "Roket Ramah",
  collection: "space-explorers",
  blurb: "Roket ramah yang siap lepas landas menuju bintang-bintang.",
  age: "2–3 tahun", ageBand: "2-3th",
  difficulty: 2,
  viewBox: [480, 360],
  regions: [
    { id: "flame", label: "Api", els: [
      { t: "path", d: "M214 266 C222 292 231 306 240 320 C249 306 258 292 266 266 C254 282 226 282 214 266 Z" },
    ] },
    { id: "fins", label: "Sirip", els: [
      { t: "path", d: "M198 192 C168 222 156 250 158 274 C176 264 194 248 202 230 Z" },
      { t: "path", d: "M282 192 C312 222 324 250 322 274 C304 264 286 248 278 230 Z" },
    ] },
    { id: "body", label: "Badan Roket", els: [
      { t: "path", d: "M240 42 C284 84 298 142 294 208 C292 240 284 260 274 270 L206 270 C196 260 188 240 186 208 C182 142 196 84 240 42 Z" },
    ] },
    { id: "nose", label: "Hidung Roket", els: [
      { t: "path", d: "M240 42 C264 66 278 94 286 124 C258 108 222 108 194 124 C202 94 216 66 240 42 Z" },
    ] },
    { id: "stripe", label: "Garis Warna", els: [
      { t: "path", d: "M189 214 C220 227 260 227 291 214 C290 232 288 248 284 258 L196 258 C192 248 190 232 189 214 Z" },
    ] },
    { id: "window", label: "Jendela", els: [
      { t: "circle", cx: 240, cy: 162, r: 27 },
    ] },
  ],
  details: [
    { el: { t: "circle", cx: 231, cy: 153, r: 8 }, fill: "#FFFFFF" },
    ...eyesAt(240, 200, 19, 5.5),
    smileAt(240, 208, 18),
  ],
  label: LBL,
  buildParts: roketRamahParts,
  steps: stepsFrom(roketRamahParts()),
});

const anjingParts = memoParts((): CraftPart[] => [
  conePart({ id: "tail", label: "Ekor", assembly: "Gulung ekor menjadi kerucut dan rekatkan bergoyang di sisi badan.", r: 0.11, h: 0.5, region: "tail", transform: { r: [0, 0, -1.1], t: [0.66, -0.42, -0.08] } }),
  ballPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan menjadi bola duduk yang empuk.", r: 0.58, region: "body", transform: { s: [1.25, 0.95, 0.9], t: [0, -0.5, 0] } }),
  ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di atas badan.", r: 0.44, region: "head", transform: { t: [0, 0.28, 0.05] } }),
  prismPart({ id: "ear-l", label: "Telinga", assembly: "Lipat dua telinga terkulai dan rekatkan di sisi kepala.", poly: [[-0.10, 0.22], [0.12, 0.22], [0.16, -0.16], [0.02, -0.28], [-0.12, -0.12]], depth: 0.09, region: "ears", transform: { t: [-0.44, 0.32, 0.02] } }),
  prismPart({ id: "ear-r", label: "Telinga", assembly: "Lipat dua telinga terkulai dan rekatkan di sisi kepala.", poly: [[-0.12, 0.22], [0.10, 0.22], [0.12, -0.12], [-0.02, -0.28], [-0.16, -0.16]], depth: 0.09, region: "ears", transform: { t: [0.44, 0.32, 0.02] } }),
  cylPart({ id: "collar", label: "Kalung", assembly: "Gulung kalung menjadi gelang dan rekatkan melingkari leher.", r: 0.40, h: 0.13, region: "collar", transform: { t: [0, -0.14, 0.03] } }),
  flatPart({ id: "spots", label: "Corak", assembly: "Tempelkan corak di kepala dan badan.", poly: discPoly(0.13), region: "spots", transform: { t: [0.26, 0.36, 0.44] } }),
  flatPart({ id: "spots-2", label: "Corak", assembly: "Tempelkan corak di kepala dan badan.", poly: discPoly(0.15), region: "spots", transform: { s: [1.2, 0.85, 1], t: [-0.34, -0.52, 0.5] } }),
  nameplatePart("anjingmu"),
]);

const anjing: TemplateDef = mkTemplate({
  id: "pb-anjing",
  name: "Anak Anjing",
  collection: "animal-friends",
  blurb: "Anak anjing bertelinga terkulai yang selalu ingin bermain.",
  age: "2–3 tahun", ageBand: "2-3th",
  difficulty: 2,
  viewBox: [480, 360],
  regions: [
    { id: "tail", label: "Ekor", els: [
      { t: "path", d: "M310 238 C342 232 356 208 346 188 C364 210 358 246 324 254 Z" },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 238, cy: 232, rx: 80, ry: 58 },
    ] },
    { id: "head", label: "Kepala", els: [
      { t: "circle", cx: 240, cy: 136, r: 59 },
    ] },
    { id: "ears", label: "Telinga", els: [
      { t: "path", d: "M190 106 C160 114 148 152 160 188 C176 178 192 148 194 120 Z" },
      { t: "path", d: "M290 106 C320 114 332 152 320 188 C304 178 288 148 286 120 Z" },
    ] },
    { id: "collar", label: "Kalung", els: [
      { t: "path", d: "M194 188 C222 201 258 201 286 188 L284 207 C256 218 224 218 196 207 Z" },
    ] },
    { id: "spots", label: "Corak", els: [
      { t: "circle", cx: 274, cy: 126, r: 17 },
      { t: "ellipse", cx: 194, cy: 240, rx: 19, ry: 13 },
    ] },
  ],
  details: [
    groundAt(294, 135),
    ...eyesAt(240, 130, 23, 7.5),
    { el: { t: "ellipse", cx: 240, cy: 150, rx: 12, ry: 8 }, fill: INK },
    smileAt(240, 160, 20),
    { el: { t: "path", d: "M231 166 C231 178 249 178 249 166 C244 172 236 172 231 166 Z" }, fill: "#D6336C" },
    ...cheeksAt(240, 156, 50, 10),
  ],
  label: LBL,
  buildParts: anjingParts,
  steps: stepsFrom(anjingParts()),
});

/* ================================================================== */
/* LEVEL 4 — CREATIVE EXPLORERS (3–4 tahun) · 8–9 bidang + lingkungan  */
/* ================================================================== */

const dinoTamanParts = memoParts((): CraftPart[] => [
  flatPart({ id: "ground", label: "Tanah", assembly: "Letakkan cakram tanah pipih sebagai alas adegan.", poly: discPoly(1.0), region: "ground", transform: { r: [Math.PI / 2, 0, 0], s: [1.3, 1, 0.45], t: [0, -0.98, 0] } }),
  cylPart({ id: "trunk", label: "Batang Pohon", assembly: "Gulung batang pohon menjadi tabung dan berdirikan di belakang dino.", r: 0.09, h: 0.85, region: "trunk", transform: { t: [-0.88, -0.55, -0.35] } }),
  ballPart({ id: "leaves", label: "Daun Pohon", assembly: "Buat bola daun dan rekatkan di atas batang pohon.", r: 0.34, region: "leaves", transform: { t: [-0.88, 0.05, -0.35] } }),
  ...babyDinoParts("dinomu"),
]);

const dinoTaman: TemplateDef = mkTemplate({
  id: "pb-dino-taman",
  name: "Dino di Taman",
  collection: "dino-world",
  blurb: "Baby Dino bermain di bawah pohon besar di taman yang rindang.",
  age: "3–4 tahun", ageBand: "3-4th",
  difficulty: 3,
  viewBox: [480, 360],
  regions: [
    { id: "ground", label: "Tanah", els: [
      { t: "ellipse", cx: 240, cy: 284, rx: 188, ry: 21 },
    ] },
    { id: "leaves", label: "Daun Pohon", els: [
      { t: "circle", cx: 62, cy: 112, r: 38 },
      { t: "circle", cx: 34, cy: 140, r: 27 },
      { t: "circle", cx: 92, cy: 140, r: 27 },
    ] },
    { id: "trunk", label: "Batang Pohon", els: [
      { t: "path", d: "M54 264 L56 172 C56 160 68 160 68 172 L70 264 Z" },
    ] },
    { id: "tail", label: "Ekor", els: [
      { t: "path", d: "M120 232 C72 226 44 200 50 172 C55 150 78 142 100 152 L128 190 C138 210 134 226 120 232 Z" },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "path", d: "M120 130 C122 84 170 52 228 54 C288 56 326 94 330 148 C334 202 312 246 268 260 L170 260 C140 246 118 192 120 130 Z" },
    ] },
    { id: "feet", label: "Kaki", els: [
      { t: "ellipse", cx: 168, cy: 272, rx: 28, ry: 13 },
      { t: "ellipse", cx: 268, cy: 272, rx: 28, ry: 13 },
    ] },
    { id: "spikes", label: "Duri", els: [
      { t: "path", d: "M150 92 L176 48 L202 88 Z" },
      { t: "path", d: "M208 64 L238 24 L262 66 Z" },
      { t: "path", d: "M266 62 L298 30 L314 74 Z" },
    ] },
    { id: "head", label: "Kepala", els: [
      { t: "circle", cx: 348, cy: 106, r: 56 },
    ] },
    { id: "belly", label: "Perut", els: [
      { t: "path", d: "M208 146 C242 146 264 176 262 212 C260 242 238 260 212 258 C187 256 172 232 176 200 C180 170 191 146 208 146 Z" },
    ] },
  ],
  details: [
    ...eyesAt(358, 94, 0, 9),
    { el: { t: "circle", cx: 396, cy: 116, r: 4.5 }, fill: INK },
    { el: { t: "path", d: "M382 138 C390 145 401 145 407 138" }, stroke: INK, sw: 4 },
    ...cheeksAt(330, 128, 0, 11),
    { el: { t: "circle", cx: 150, cy: 282, r: 6 }, fill: "#FFFFFF", stroke: INK, sw: 3 },
    { el: { t: "circle", cx: 330, cy: 288, r: 6 }, fill: "#FFFFFF", stroke: INK, sw: 3 },
    { el: { t: "circle", cx: 415, cy: 280, r: 6 }, fill: "#FFFFFF", stroke: INK, sw: 3 },
  ],
  label: LBL,
  regionFallbacks: { belly: "body" },
  buildParts: dinoTamanParts,
  steps: stepsFrom(dinoTamanParts()),
});

const kelinciTamanParts = memoParts((): CraftPart[] => [
  conePart({ id: "carrot", label: "Wortel", assembly: "Gulung wortel menjadi kerucut dan rekatkan di samping kelinci.", r: 0.13, h: 0.5, region: "carrot", transform: { r: [0, 0, 2.2], t: [-0.72, -0.72, 0.15] } }),
  prismPart({ id: "carrot-top", label: "Daun Wortel", assembly: "Lipat daun wortel dan rekatkan di ujung wortel.", poly: [[-0.12, 0], [0.12, 0], [0.03, 0.22], [-0.03, 0.22]], depth: 0.07, region: "carrotTop", transform: { t: [-0.86, -0.52, 0.15] } }),
  ballPart({ id: "tail", label: "Ekor", assembly: "Buat bola ekor kecil dan rekatkan di sisi badan.", r: 0.16, region: "tail", transform: { t: [0.62, -0.62, -0.05] } }),
  ballPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan menjadi bola duduk.", r: 0.55, region: "body", transform: { s: [1.15, 0.9, 0.9], t: [0, -0.52, 0] } }),
  flatPart({ id: "belly", label: "Perut", assembly: "Tempelkan perut bundar di depan badan.", poly: discPoly(0.30), region: "belly", transform: { s: [1, 0.85, 1], t: [0, -0.58, 0.5] } }),
  ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di atas badan.", r: 0.42, region: "head", transform: { t: [0, 0.22, 0.03] } }),
  conePart({ id: "ear-l", label: "Telinga", assembly: "Buat dua telinga panjang dan rekatkan tegak di atas kepala.", r: 0.11, h: 0.5, region: "ears", transform: { s: [1, 1, 0.45], t: [-0.2, 0.78, 0] } }),
  conePart({ id: "ear-r", label: "Telinga", assembly: "Buat dua telinga panjang dan rekatkan tegak di atas kepala.", r: 0.11, h: 0.5, region: "ears", transform: { s: [1, 1, 0.45], t: [0.2, 0.78, 0] } }),
  cylPart({ id: "flower", label: "Bunga", assembly: "Gulung tangkai bunga pendek, tempelkan kelopaknya, dan berdirikan di samping kelinci.", r: 0.05, h: 0.34, region: "flower", transform: { t: [0.78, -0.8, 0.15] } }),
  flatPart({ id: "grass", label: "Rumput", assembly: "Tempelkan rumpun rumput pipih di sepanjang alas.", poly: [[-0.5, 0], [-0.38, 0.16], [-0.26, 0.02], [-0.14, 0.18], [-0.02, 0.02], [0.1, 0.16], [0.22, 0.02], [0.34, 0.15], [0.46, 0]], region: "grass", transform: { t: [0, -0.98, 0.35] } }),
  nameplatePart("kelincimu"),
]);

const kelinciTaman: TemplateDef = mkTemplate({
  id: "pb-kelinci-taman",
  name: "Kelinci di Taman",
  collection: "magical-garden",
  blurb: "Kelinci yang menemukan wortel segar dan bunga pertama di taman.",
  age: "3–4 tahun", ageBand: "3-4th",
  difficulty: 3,
  viewBox: [480, 360],
  regions: [
    { id: "grass", label: "Rumput", els: [
      { t: "path", d: "M84 292 L92 262 L102 290 L112 258 L122 292 Z" },
      { t: "path", d: "M348 294 L356 266 L366 292 L376 262 L386 294 Z" },
      { t: "path", d: "M196 296 L203 272 L211 294 L219 270 L227 296 Z" },
    ] },
    { id: "carrotTop", label: "Daun Wortel", els: [
      { t: "path", d: "M116 236 C102 220 101 204 112 195 C123 205 125 221 123 234 Z" },
      { t: "path", d: "M124 234 C123 215 131 202 143 199 C146 214 139 227 131 236 Z" },
    ] },
    { id: "carrot", label: "Wortel", els: [
      { t: "path", d: "M118 234 L170 260 C179 264 176 278 165 279 L115 255 C105 251 106 230 118 234 Z" },
    ] },
    { id: "tail", label: "Ekor", els: [
      { t: "circle", cx: 324, cy: 254, r: 21 },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "ellipse", cx: 240, cy: 240, rx: 73, ry: 53 },
    ] },
    { id: "belly", label: "Perut", els: [
      { t: "ellipse", cx: 240, cy: 250, rx: 38, ry: 31 },
    ] },
    { id: "head", label: "Kepala", els: [
      { t: "circle", cx: 240, cy: 148, r: 53 },
    ] },
    { id: "ears", label: "Telinga", els: [
      { t: "path", d: "M212 104 C200 60 204 28 218 24 C232 28 236 64 228 104 Z" },
      { t: "path", d: "M252 104 C244 64 248 28 262 24 C276 28 280 60 268 104 Z" },
    ] },
    { id: "flower", label: "Bunga", els: [
      { t: "circle", cx: 372, cy: 210, r: 11 },
      { t: "circle", cx: 389, cy: 222, r: 11 },
      { t: "circle", cx: 383, cy: 240, r: 11 },
      { t: "circle", cx: 361, cy: 240, r: 11 },
      { t: "circle", cx: 355, cy: 222, r: 11 },
      { t: "rect", x: 369, y: 240, w: 7, h: 34, rx: 3 },
    ] },
  ],
  details: [
    groundAt(296, 140),
    { el: { t: "path", d: "M216 92 C211 62 213 40 218 34 C224 40 226 64 222 92 Z" }, fill: "#FFFFFF", stroke: INK, sw: 3 },
    { el: { t: "path", d: "M258 92 C254 64 256 40 262 34 C267 40 269 62 264 92 Z" }, fill: "#FFFFFF", stroke: INK, sw: 3 },
    ...eyesAt(240, 142, 21, 7.5),
    { el: { t: "path", d: "M233 156 L247 156 L240 165 Z" }, fill: "#D6336C" },
    smileAt(240, 168, 18),
    ...cheeksAt(240, 162, 44, 10),
    { el: { t: "circle", cx: 372, cy: 225, r: 7 }, fill: INK },
  ],
  label: LBL,
  buildParts: kelinciTamanParts,
  steps: stepsFrom(kelinciTamanParts()),
});

const pemadamParts = memoParts((): CraftPart[] => [
  boxPart({ id: "body", label: "Badan Truk", assembly: "Lipat badan truk menjadi kotak panjang yang kokoh.", w: 1.75, h: 0.66, d: 0.85, regions: { front: "body", back: "body", left: "body", right: "body", top: "body", bottom: "body" }, transform: { t: [-0.12, -0.52, 0] } }),
  flatPart({ id: "stripe", label: "Garis Truk", assembly: "Tempelkan garis panjang di sisi badan truk.", poly: rectPoly(1.7, 0.16), region: "stripe", transform: { t: [-0.12, -0.48, 0.44] } }),
  flatPart({ id: "door", label: "Pintu", assembly: "Tempelkan pintu di sisi badan truk.", poly: rectPoly(0.34, 0.44), region: "door", transform: { t: [-0.55, -0.5, 0.44] } }),
  boxPart({ id: "cabin", label: "Kabin", assembly: "Lipat kabin pengemudi dan rekatkan di ujung depan truk.", w: 0.55, h: 0.85, d: 0.85, regions: { front: "cabin", back: "cabin", left: "cabin", right: "window", top: "cabin", bottom: "cabin" }, transform: { t: [0.85, -0.42, 0] } }),
  flatPart({ id: "window-f", label: "Jendela", assembly: "Tempelkan jendela di depan kabin.", poly: rectPoly(0.4, 0.3), region: "window", transform: { r: [0, Math.PI / 2, 0], t: [1.13, -0.28, 0] } }),
  prismPart({ id: "ladder", label: "Tangga", assembly: "Lipat tangga panjang dan rekatkan miring di atas badan truk.", poly: rectPoly(1.15, 0.13), depth: 0.07, region: "ladder", transform: { r: [0, 0, 0.1], t: [-0.3, -0.12, 0.2] } }),
  cylPart({ id: "light", label: "Lampu Sirene", assembly: "Gulung lampu sirene kecil dan rekatkan di atas kabin.", r: 0.09, h: 0.13, region: "light", transform: { t: [0.85, 0.08, 0] } }),
  cylPart({ id: "wheel-1", label: "Roda", assembly: "Gulung keempat roda dan rekatkan di sudut-sudut truk.", r: 0.21, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [-0.62, -0.86, 0.44] } }),
  cylPart({ id: "wheel-2", label: "Roda", assembly: "Gulung keempat roda dan rekatkan di sudut-sudut truk.", r: 0.21, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [0.62, -0.86, 0.44] } }),
  cylPart({ id: "wheel-3", label: "Roda", assembly: "Gulung keempat roda dan rekatkan di sudut-sudut truk.", r: 0.21, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [-0.62, -0.86, -0.44] } }),
  cylPart({ id: "wheel-4", label: "Roda", assembly: "Gulung keempat roda dan rekatkan di sudut-sudut truk.", r: 0.21, h: 0.12, region: "wheels", transform: { r: [Math.PI / 2, 0, 0], t: [0.62, -0.86, -0.44] } }),
  nameplatePart("truk pemadammu"),
]);

const pemadam: TemplateDef = mkTemplate({
  id: "pb-pemadam",
  name: "Mobil Pemadam",
  collection: "little-vehicles",
  blurb: "Truk pemadam gagah dengan tangga panjang dan lampu sirene.",
  age: "3–4 tahun", ageBand: "3-4th",
  difficulty: 3,
  viewBox: [480, 360],
  regions: [
    { id: "body", label: "Badan Truk", els: [
      { t: "path", d: "M82 240 L82 170 C82 157 90 150 103 150 L398 150 C411 150 418 157 418 170 L418 240 C418 250 410 256 399 256 L101 256 C90 256 82 250 82 240 Z" },
    ] },
    { id: "cabin", label: "Kabin", els: [
      { t: "path", d: "M314 256 L314 130 C314 119 320 112 333 111 L365 109 C378 108 387 114 391 125 L403 158 C411 169 416 182 416 197 L416 256 Z" },
    ] },
    { id: "window", label: "Jendela Kabin", els: [
      { t: "path", d: "M329 125 L361 123 C370 123 376 127 380 135 L387 157 L329 157 Z" },
    ] },
    { id: "ladder", label: "Tangga", els: [
      { t: "path", d: "M102 130 L266 108 L271 125 L107 147 Z" },
    ] },
    { id: "light", label: "Lampu Sirene", els: [
      { t: "circle", cx: 352, cy: 96, r: 13 },
    ] },
    { id: "stripe", label: "Garis Truk", els: [
      { t: "path", d: "M82 196 L314 196 L314 217 L82 217 Z" },
    ] },
    { id: "door", label: "Pintu", els: [
      { t: "rect", x: 126, y: 162, w: 54, h: 76, rx: 9 },
    ] },
    { id: "wheels", label: "Roda", els: [
      { t: "circle", cx: 148, cy: 256, r: 28 },
      { t: "circle", cx: 354, cy: 256, r: 28 },
    ] },
  ],
  details: [
    groundAt(296, 165),
    { el: { t: "circle", cx: 148, cy: 256, r: 11 }, fill: "#FFFFFF", stroke: INK, sw: 3.5 },
    { el: { t: "circle", cx: 354, cy: 256, r: 11 }, fill: "#FFFFFF", stroke: INK, sw: 3.5 },
    { el: { t: "path", d: "M130 121 L262 101 M136 136 L268 116" }, stroke: INK, sw: 3 },
    { el: { t: "circle", cx: 168, cy: 196, r: 4 }, fill: INK },
    ...eyesAt(352, 208, 0, 6.5),
    smileAt(352, 222, 16),
  ],
  label: LBL,
  buildParts: pemadamParts,
  steps: stepsFrom(pemadamParts()),
});

const astronotParts = memoParts((): CraftPart[] => [
  flatPart({ id: "moon", label: "Bulan", assembly: "Letakkan cakram bulan besar sebagai alas tempat astronotmu mendarat.", poly: discPoly(0.85), region: "moon", transform: { r: [Math.PI / 2, 0, 0], s: [1.2, 1, 0.8], t: [0.3, -0.98, -0.1] } }),
  boxPart({ id: "backpack", label: "Ransel", assembly: "Lipat ransel oksigen dan rekatkan di belakang baju antariksa.", w: 0.34, h: 0.78, d: 0.2, regions: { front: "backpack", back: "backpack", left: "backpack", right: "backpack", top: "backpack", bottom: "backpack" }, transform: { t: [-0.42, -0.1, -0.28] } }),
  eggBodyPart({ id: "suit", label: "Baju Antariksa", assembly: "Rekatkan strip baju antariksa menjadi badan yang bulat dan kokoh.", body: "suit", transform: { s: [0.95, 1.05, 0.85], t: [0, -0.28, 0] } }),
  ballPart({ id: "helmet", label: "Helm", assembly: "Buat bola helm dan rekatkan di atas baju antariksa.", r: 0.37, region: "helmet", transform: { t: [0, 0.48, 0] } }),
  flatPart({ id: "visor", label: "Kaca Helm", assembly: "Tempelkan kaca helm bundar di depan helm.", poly: discPoly(0.24), region: "visor", transform: { s: [1.15, 0.9, 1], t: [0, 0.48, 0.34] } }),
  ballPart({ id: "glove-l", label: "Sarung Tangan", assembly: "Buat dua bola sarung tangan dan rekatkan di sisi baju.", r: 0.13, region: "gloves", transform: { t: [-0.52, -0.28, 0.1] } }),
  ballPart({ id: "glove-r", label: "Sarung Tangan", assembly: "Buat dua bola sarung tangan dan rekatkan di sisi baju.", r: 0.13, region: "gloves", transform: { t: [0.52, -0.28, 0.1] } }),
  boxPart({ id: "boot-l", label: "Sepatu Bot", assembly: "Lipat dua sepatu bot dan rekatkan di bawah baju.", w: 0.26, h: 0.16, d: 0.34, regions: { front: "boots", back: "boots", left: "boots", right: "boots", top: "boots", bottom: "boots" }, transform: { t: [-0.2, -0.9, 0.05] } }),
  boxPart({ id: "boot-r", label: "Sepatu Bot", assembly: "Lipat dua sepatu bot dan rekatkan di bawah baju.", w: 0.26, h: 0.16, d: 0.34, regions: { front: "boots", back: "boots", left: "boots", right: "boots", top: "boots", bottom: "boots" }, transform: { t: [0.2, -0.9, 0.05] } }),
  prismPart({ id: "flag", label: "Bendera", assembly: "Lipat bendera kecil dan tancapkan di bulan di samping astronot.", poly: [[0, 0], [0.34, 0.07], [0, 0.15]], depth: 0.05, region: "flag", transform: { t: [0.72, -0.55, 0.1] } }),
  nameplatePart("astronotmu"),
]);

const astronot: TemplateDef = mkTemplate({
  id: "pb-astronot",
  name: "Astronot di Bulan",
  collection: "space-explorers",
  blurb: "Astronot kecil yang baru mendarat dan menancapkan benderanya.",
  age: "3–4 tahun", ageBand: "3-4th",
  difficulty: 3,
  viewBox: [480, 360],
  regions: [
    { id: "moon", label: "Bulan", els: [
      { t: "circle", cx: 336, cy: 306, r: 96 },
    ] },
    { id: "backpack", label: "Ransel Oksigen", els: [
      { t: "rect", x: 148, y: 148, w: 36, h: 86, rx: 13 },
    ] },
    { id: "suit", label: "Baju Antariksa", els: [
      { t: "path", d: "M194 150 C194 133 207 124 240 124 C273 124 286 133 286 150 L286 234 C286 248 276 256 261 256 L219 256 C204 256 194 248 194 234 Z" },
    ] },
    { id: "boots", label: "Sepatu Bot", els: [
      { t: "rect", x: 202, y: 256, w: 33, h: 19, rx: 8 },
      { t: "rect", x: 245, y: 256, w: 33, h: 19, rx: 8 },
    ] },
    { id: "gloves", label: "Sarung Tangan", els: [
      { t: "circle", cx: 186, cy: 198, r: 16 },
      { t: "circle", cx: 294, cy: 198, r: 16 },
    ] },
    { id: "helmet", label: "Helm", els: [
      { t: "circle", cx: 240, cy: 88, r: 47 },
    ] },
    { id: "visor", label: "Kaca Helm", els: [
      { t: "ellipse", cx: 240, cy: 90, rx: 31, ry: 25 },
    ] },
    { id: "flag", label: "Bendera", els: [
      { t: "path", d: "M354 172 L392 183 L354 194 Z" },
    ] },
  ],
  details: [
    { el: { t: "path", d: "M354 172 L354 236" }, stroke: INK, sw: 4.5 },
    ...eyesAt(240, 86, 11, 5),
    smileAt(240, 96, 14),
    { el: { t: "circle", cx: 228, cy: 76, r: 5 }, fill: "#FFFFFF" },
    { el: { t: "circle", cx: 222, cy: 196, r: 5 }, fill: INK },
    { el: { t: "circle", cx: 240, cy: 196, r: 5 }, fill: INK },
    { el: { t: "circle", cx: 258, cy: 196, r: 5 }, fill: INK },
    { el: { t: "path", d: "M240 232 L240 254" }, stroke: INK, sw: 3.5 },
    { el: { t: "circle", cx: 300, cy: 282, r: 12 }, fill: "none", stroke: INK, sw: 3 },
    { el: { t: "circle", cx: 382, cy: 300, r: 9 }, fill: "none", stroke: INK, sw: 3 },
  ],
  label: LBL,
  buildParts: astronotParts,
  steps: stepsFrom(astronotParts()),
});

/* ================================================================== */
/* LEVEL 5 — YOUNG CREATORS (4–5 tahun) · 14–15 bidang, adegan cerita  */
/* ================================================================== */

const duniaDinoParts = memoParts((): CraftPart[] => [
  flatPart({ id: "ground", label: "Tanah", assembly: "Letakkan cakram tanah pipih sebagai alas adegan.", poly: discPoly(1.0), region: "ground", transform: { r: [Math.PI / 2, 0, 0], s: [1.35, 1, 0.5], t: [0, -0.98, 0] } }),
  flatPart({ id: "sun", label: "Matahari", assembly: "Tempelkan cakram matahari di latar belakang adegan.", poly: discPoly(0.22), region: "sun", transform: { t: [-0.82, 0.72, -0.4] } }),
  flatPart({ id: "cloud", label: "Awan", assembly: "Tempelkan awan pipih di langit adegan.", poly: [[-0.3, 0], [-0.28, 0.12], [-0.12, 0.2], [0.05, 0.22], [0.2, 0.16], [0.3, 0.05], [0.28, 0]], region: "cloud", transform: { t: [0.62, 0.78, -0.4] } }),
  conePart({ id: "volcano", label: "Gunung Berapi", assembly: "Gulung gunung berapi menjadi kerucut besar dan berdirikan di belakang dino.", r: 0.42, h: 0.95, region: "volcano", transform: { t: [0.72, -0.5, -0.3] } }),
  flatPart({ id: "lava", label: "Lava", assembly: "Tempelkan aliran lava di puncak gunung berapi.", poly: [[-0.1, 0.14], [0.1, 0.14], [0.05, -0.05], [0.0, 0.04], [-0.05, -0.08]], region: "lava", transform: { t: [0.72, 0.05, 0.02] } }),
  cylPart({ id: "trunk", label: "Batang Pohon", assembly: "Gulung batang pohon dan berdirikan di samping dino.", r: 0.07, h: 0.7, region: "trunk", transform: { t: [0.38, -0.62, -0.25] } }),
  ballPart({ id: "leaves", label: "Daun Pohon", assembly: "Buat bola daun dan rekatkan di atas batang.", r: 0.27, region: "leaves", transform: { t: [0.38, -0.05, -0.25] } }),
  eggBodyPart({ id: "body", label: "Badan", assembly: "Rekatkan strip badan satu sambungan setiap kalinya. Tambalan perut menghadap ke depan.", body: "body", belly: "belly", transform: { s: [1.05, 0.82, 0.72], t: [-0.42, -0.42, 0] } }),
  ballPart({ id: "head", label: "Kepala", assembly: "Buat bola kepala dan rekatkan di depan atas badan.", r: 0.35, region: "head", transform: { t: [0.05, 0.05, 0] } }),
  conePart({ id: "tail", label: "Ekor", assembly: "Gulung ekor menjadi kerucut melengkung dan rekatkan di belakang badan.", r: 0.16, h: 0.55, region: "tail", transform: { r: [0, 0, 1.9], t: [-0.95, -0.5, -0.05] } }),
  prismPart({ id: "spike-1", label: "Duri", assembly: "Lipat duri dan rekatkan di sepanjang punggung.", poly: [[-0.08, 0], [0.08, 0], [0, 0.26]], depth: 0.09, region: "spikes", transform: { t: [-0.62, -0.02, -0.04], r: [0, 0, -0.25] } }),
  prismPart({ id: "spike-2", label: "Duri", assembly: "Lipat duri dan rekatkan di sepanjang punggung.", poly: [[-0.08, 0], [0.08, 0], [0, 0.26]], depth: 0.09, region: "spikes", transform: { t: [-0.34, 0.05, -0.04], r: [0, 0, -0.12], s: [1.15, 1.15, 1] } }),
  cylPart({ id: "foot-1", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah badan.", r: 0.14, h: 0.18, region: "feet", transform: { t: [-0.68, -0.92, 0.14] } }),
  cylPart({ id: "foot-2", label: "Kaki", assembly: "Buat dua kaki pendek dan rekatkan di bawah badan.", r: 0.14, h: 0.18, region: "feet", transform: { t: [-0.18, -0.92, 0.14] } }),
  ballPart({ id: "egg", label: "Telur Dino", assembly: "Buat bola telur kecil dan letakkan di tanah dekat dino.", r: 0.15, region: "egg", transform: { s: [0.85, 1.05, 0.85], t: [0.3, -0.85, 0.25] } }),
  nameplatePart("dinomu"),
]);

const duniaDino: TemplateDef = mkTemplate({
  id: "pb-dunia-dino",
  name: "Petualangan Dino",
  collection: "dino-world",
  blurb: "Dunia dino lengkap: gunung berapi, pohon, telur, dan matahari pagi.",
  age: "4–5 tahun", ageBand: "4-5th",
  difficulty: 3,
  viewBox: [480, 360],
  regions: [
    { id: "sun", label: "Matahari", els: [
      { t: "circle", cx: 62, cy: 54, r: 24 },
    ] },
    { id: "cloud", label: "Awan", els: [
      { t: "path", d: "M366 54 C378 36 406 34 417 49 C434 49 444 61 440 74 C426 83 384 83 371 75 C360 68 358 61 366 54 Z" },
    ] },
    { id: "ground", label: "Tanah", els: [
      { t: "ellipse", cx: 240, cy: 274, rx: 192, ry: 20 },
    ] },
    { id: "volcano", label: "Gunung Berapi", els: [
      { t: "path", d: "M328 264 L370 166 C376 154 392 154 398 166 L442 264 Z" },
    ] },
    { id: "lava", label: "Lava", els: [
      { t: "path", d: "M370 166 C376 154 392 154 398 166 L394 198 C388 187 382 198 385 212 L378 198 C374 187 369 181 370 166 Z" },
    ] },
    { id: "leaves", label: "Daun Pohon", els: [
      { t: "circle", cx: 316, cy: 114, r: 27 },
      { t: "circle", cx: 291, cy: 136, r: 19 },
      { t: "circle", cx: 341, cy: 136, r: 19 },
    ] },
    { id: "trunk", label: "Batang Pohon", els: [
      { t: "path", d: "M310 264 L312 158 L324 158 L327 264 Z" },
    ] },
    { id: "tail", label: "Ekor", els: [
      { t: "path", d: "M78 226 C44 220 26 200 30 178 C34 160 52 152 70 160 L92 192 C100 208 96 222 78 226 Z" },
    ] },
    { id: "body", label: "Badan", els: [
      { t: "path", d: "M84 140 C86 104 122 78 168 80 C216 82 246 112 249 156 C252 198 234 232 198 244 L116 244 C94 232 82 188 84 140 Z" },
    ] },
    { id: "feet", label: "Kaki", els: [
      { t: "ellipse", cx: 122, cy: 252, rx: 23, ry: 11 },
      { t: "ellipse", cx: 208, cy: 252, rx: 23, ry: 11 },
    ] },
    { id: "spikes", label: "Duri", els: [
      { t: "path", d: "M110 106 L131 71 L153 102 Z" },
      { t: "path", d: "M158 86 L183 55 L201 88 Z" },
    ] },
    { id: "head", label: "Kepala", els: [
      { t: "circle", cx: 264, cy: 116, r: 43 },
    ] },
    { id: "belly", label: "Perut", els: [
      { t: "ellipse", cx: 168, cy: 190, rx: 30, ry: 42 },
    ] },
    { id: "egg", label: "Telur Dino", els: [
      { t: "ellipse", cx: 292, cy: 246, rx: 16, ry: 21 },
    ] },
  ],
  details: [
    ...eyesAt(272, 106, 0, 7.5),
    { el: { t: "circle", cx: 298, cy: 124, r: 3.5 }, fill: INK },
    smileAt(292, 134, 14),
    ...cheeksAt(248, 130, 0, 9),
    ...eyesAt(62, 50, 8, 3.5),
    smileAt(62, 58, 12),
    { el: { t: "path", d: "M279 238 L286 244 L293 237 L300 244 L305 238" }, stroke: INK, sw: 3 },
  ],
  label: LBL,
  regionFallbacks: { belly: "body" },
  buildParts: duniaDinoParts,
  steps: stepsFrom(duniaDinoParts()),
});

const lautParts = memoParts((): CraftPart[] => [
  flatPart({ id: "waves", label: "Ombak", assembly: "Tempelkan pita ombak di bagian atas latar adegan.", poly: [[-1.1, 0.1], [1.1, 0.1], [1.1, -0.06], [0.6, 0.02], [0.1, -0.06], [-0.5, 0.02], [-1.1, -0.05]], region: "waves", transform: { t: [0, 0.92, -0.45] } }),
  flatPart({ id: "sand", label: "Pasir", assembly: "Letakkan pita pasir pipih sebagai dasar laut.", poly: [[-1.15, 0.14], [1.15, 0.14], [1.15, -0.14], [-1.15, -0.14]], region: "sand", transform: { r: [Math.PI / 2, 0, 0], t: [0, -0.98, 0] } }),
  ballPart({ id: "fish-body", label: "Badan Ikan", assembly: "Rekatkan strip badan ikan menjadi bola pipih.", r: 0.5, region: "fishBody", transform: { s: [1.3, 0.9, 0.5], t: [-0.45, 0.3, 0] } }),
  prismPart({ id: "fish-tail", label: "Ekor Ikan", assembly: "Lipat ekor ikan dan rekatkan di belakang badannya.", poly: [[0, 0.2], [0.26, 0.36], [0.26, -0.36]], depth: 0.1, region: "fishTail", transform: { t: [0.22, 0.3, 0] } }),
  prismPart({ id: "fish-fin", label: "Sirip Ikan", assembly: "Lipat sirip dan rekatkan di punggung ikan.", poly: [[-0.2, 0], [0.2, 0], [0, 0.16]], depth: 0.08, region: "fishFin", transform: { t: [-0.45, 0.78, 0] } }),
  ballPart({ id: "octo-head", label: "Kepala Gurita", assembly: "Buat bola kepala gurita dan letakkan di atas tentakelnya.", r: 0.4, region: "octoHead", transform: { s: [1.05, 0.95, 0.9], t: [0.45, 0.35, -0.05] } }),
  conePart({ id: "tent-1", label: "Tentakel", assembly: "Gulung empat tentakel menjadi kerucut bergelombang dan rekatkan di bawah kepala gurita.", r: 0.09, h: 0.42, region: "octoTentacles", transform: { r: [0.25, 0, 0.15], t: [0.22, -0.12, 0] } }),
  conePart({ id: "tent-2", label: "Tentakel", assembly: "Gulung empat tentakel menjadi kerucut bergelombang dan rekatkan di bawah kepala gurita.", r: 0.09, h: 0.42, region: "octoTentacles", transform: { r: [-0.2, 0, -0.1], t: [0.38, -0.14, 0.05] } }),
  conePart({ id: "tent-3", label: "Tentakel", assembly: "Gulung empat tentakel menjadi kerucut bergelombang dan rekatkan di bawah kepala gurita.", r: 0.09, h: 0.42, region: "octoTentacles", transform: { r: [0.2, 0, -0.15], t: [0.54, -0.14, 0.05] } }),
  conePart({ id: "tent-4", label: "Tentakel", assembly: "Gulung empat tentakel menjadi kerucut bergelombang dan rekatkan di bawah kepala gurita.", r: 0.09, h: 0.42, region: "octoTentacles", transform: { r: [-0.25, 0, -0.15], t: [0.68, -0.12, 0] } }),
  ballPart({ id: "small-fish", label: "Ikan Kecil", assembly: "Buat bola ikan kecil dan letakkan berenang di sudut adegan.", r: 0.2, region: "smallFish", transform: { s: [1.3, 0.85, 0.5], t: [0.82, 0.62, -0.1] } }),
  prismPart({ id: "starfish", label: "Bintang Laut", assembly: "Lipat bintang laut dan letakkan di atas pasir.", poly: [[0, 0.22], [0.06, 0.07], [0.21, 0.07], [0.09, -0.03], [0.13, -0.18], [0, -0.09], [-0.13, -0.18], [-0.09, -0.03], [-0.21, 0.07], [-0.06, 0.07]], depth: 0.07, region: "starfish", transform: { t: [-0.78, -0.72, 0.2] } }),
  flatPart({ id: "shell", label: "Kerang", assembly: "Tempelkan kerang pipih di atas pasir.", poly: [[-0.22, -0.1], [-0.18, 0.08], [0, 0.16], [0.18, 0.08], [0.22, -0.1]], region: "shell", transform: { t: [-0.05, -0.82, 0.25] } }),
  prismPart({ id: "coral", label: "Karang", assembly: "Lipat karang bercabang dan berdirikan di atas pasir.", poly: [[-0.06, -0.3], [-0.02, -0.05], [-0.14, 0.08], [-0.05, 0.12], [0.0, 0.02], [0.02, 0.3], [0.08, 0.3], [0.1, 0.05], [0.18, 0.14], [0.2, -0.02], [0.1, -0.08], [0.08, -0.3]], depth: 0.08, region: "coral", transform: { t: [0.85, -0.62, 0] } }),
  prismPart({ id: "seaweed", label: "Rumput Laut", assembly: "Lipat rumput laut dan berdirikan di atas pasir.", poly: [[-0.07, -0.32], [0.05, -0.1], [-0.04, 0.12], [0.04, 0.32], [0.1, 0.32], [0.12, -0.05], [0.05, -0.32]], depth: 0.07, region: "seaweed", transform: { t: [-0.95, -0.6, 0] } }),
  flatPart({ id: "bubbles", label: "Gelembung", assembly: "Tempelkan gelembung-gelembung bundar di air.", poly: discPoly(0.09), region: "bubbles", transform: { t: [-0.55, 0.72, -0.2] } }),
  flatPart({ id: "snail", label: "Siput Laut", assembly: "Tempelkan siput laut pipih di atas pasir.", poly: discPoly(0.14), region: "snail", transform: { t: [-0.5, -0.78, 0.25] } }),
  nameplatePart("kerajaan lautmu"),
]);

const laut: TemplateDef = mkTemplate({
  id: "pb-laut",
  name: "Kerajaan Bawah Laut",
  collection: "animal-friends",
  blurb: "Ikan, gurita, bintang laut, dan kerang — semua penghuni laut berkumpul.",
  age: "4–5 tahun", ageBand: "4-5th",
  difficulty: 3,
  viewBox: [480, 360],
  regions: [
    { id: "waves", label: "Ombak", els: [
      { t: "path", d: "M0 0 L480 0 L480 20 C420 33 380 11 320 21 C260 31 220 11 160 21 C100 31 60 13 0 23 Z" },
    ] },
    { id: "sand", label: "Pasir", els: [
      { t: "path", d: "M0 270 C80 258 160 278 240 270 C320 262 400 276 480 266 L480 360 L0 360 Z" },
    ] },
    { id: "bubbles", label: "Gelembung", els: [
      { t: "circle", cx: 118, cy: 86, r: 10 },
      { t: "circle", cx: 145, cy: 58, r: 7 },
      { t: "circle", cx: 332, cy: 62, r: 9 },
    ] },
    { id: "smallFish", label: "Ikan Kecil", els: [
      { t: "ellipse", cx: 402, cy: 98, rx: 27, ry: 17 },
      { t: "path", d: "M426 98 L445 83 C449 93 449 103 445 113 Z" },
    ] },
    { id: "fishTail", label: "Ekor Ikan", els: [
      { t: "path", d: "M226 150 L261 121 C268 140 268 160 261 179 Z" },
    ] },
    { id: "fishBody", label: "Badan Ikan", els: [
      { t: "ellipse", cx: 168, cy: 150, rx: 63, ry: 45 },
    ] },
    { id: "fishFin", label: "Sirip Ikan", els: [
      { t: "path", d: "M148 114 C160 95 186 95 197 112 C183 121 161 121 148 114 Z" },
    ] },
    { id: "octoHead", label: "Kepala Gurita", els: [
      { t: "path", d: "M270 164 C270 122 290 98 314 98 C338 98 358 122 358 164 Z" },
    ] },
    { id: "octoTentacles", label: "Tentakel Gurita", els: [
      { t: "path", d: "M278 164 C273 184 282 194 277 210 C290 213 295 197 293 182 L294 164 Z" },
      { t: "path", d: "M298 164 C296 186 304 196 300 212 C313 212 316 196 314 182 L313 164 Z" },
      { t: "path", d: "M317 164 C316 186 324 196 320 212 C333 212 336 196 334 182 L333 164 Z" },
      { t: "path", d: "M336 164 C335 184 342 194 339 208 C351 208 354 194 352 180 L350 164 Z" },
    ] },
    { id: "seaweed", label: "Rumput Laut", els: [
      { t: "path", d: "M50 270 C44 232 57 212 49 178 C66 207 63 240 67 270 Z" },
      { t: "path", d: "M76 270 C72 240 82 224 76 198 C90 222 88 246 91 270 Z" },
    ] },
    { id: "starfish", label: "Bintang Laut", els: [
      { t: "path", d: "M96 224 L105 244 L126 245 L110 258 L115 279 L96 267 L77 279 L82 258 L66 245 L87 244 Z" },
    ] },
    { id: "snail", label: "Siput Laut", els: [
      { t: "circle", cx: 152, cy: 240, r: 19 },
      { t: "path", d: "M136 258 C150 250 172 250 184 258 C172 264 148 264 136 258 Z" },
    ] },
    { id: "shell", label: "Kerang", els: [
      { t: "path", d: "M196 264 C196 241 214 228 233 228 C252 228 270 241 270 264 C252 274 214 274 196 264 Z" },
    ] },
    { id: "coral", label: "Karang", els: [
      { t: "path", d: "M394 270 C390 242 381 229 389 210 C397 224 401 233 403 242 C407 227 415 214 426 209 C431 228 426 249 422 270 Z" },
    ] },
  ],
  details: [
    ...eyesAt(148, 142, 0, 8),
    smileAt(134, 162, 18),
    ...cheeksAt(172, 164, 0, 9),
    ...eyesAt(314, 132, 16, 6.5),
    smileAt(314, 146, 16),
    ...eyesAt(392, 94, 0, 5),
    { el: { t: "circle", cx: 96, cy: 250, r: 3.5 }, fill: INK },
    { el: { t: "path", d: "M214 262 C222 246 226 240 233 234 M233 234 C240 240 244 246 252 262 M224 266 C227 254 229 248 233 242" }, stroke: INK, sw: 3 },
    { el: { t: "path", d: "M146 240 C146 232 152 228 157 231" }, stroke: INK, sw: 3 },
  ],
  label: LBL,
  buildParts: lautParts,
  steps: stepsFrom(lautParts()),
});

const antariksaParts = memoParts((): CraftPart[] => [
  ballPart({ id: "earth", label: "Bumi", assembly: "Buat bola Bumi kecil dan letakkan di sudut adegan.", r: 0.3, region: "earth", transform: { t: [-0.78, -0.62, -0.15] } }),
  ballPart({ id: "planet", label: "Planet", assembly: "Buat bola planet dan letakkan di tengah cincinnya.", r: 0.42, region: "planet", transform: { t: [0.42, 0.3, -0.15] } }),
  flatPart({ id: "ring", label: "Cincin Planet", assembly: "Letakkan cakram cincin pipih melingkari planet.", poly: discPoly(0.62), region: "ring", transform: { r: [1.2, 0, -0.25], t: [0.42, 0.3, -0.18] } }),
  flatPart({ id: "spots", label: "Bercak Planet", assembly: "Tempelkan bercak bundar di permukaan planet.", poly: discPoly(0.1), region: "spots", transform: { t: [0.3, 0.42, 0.24] } }),
  ballPart({ id: "moon", label: "Bulan", assembly: "Buat bola bulan kecil dan letakkan di sudut adegan.", r: 0.26, region: "moon", transform: { t: [0.82, -0.5, -0.15] } }),
  lathePart({
    id: "rocket", label: "Roket",
    assembly: "Rekatkan strip roket menjadi tabung. Hidung di atas, garis warna di tengah.",
    profile: [
      { r: 0.34, y: -0.52 }, { r: 0.38, y: -0.40 }, { r: 0.39, y: -0.22 }, { r: 0.37, y: 0.05 },
      { r: 0.31, y: 0.28 }, { r: 0.20, y: 0.46 }, { r: 0.07, y: 0.58 }, { r: 0, y: 0.63 },
    ],
    segments: 8,
    region: (band) => (band >= 6 ? "rocketNose" : band === 3 ? "rocketStripe" : "rocketBody"),
    capBottomRegion: "rocketBody",
    transform: { t: [-0.48, 0.05, 0] },
  }),
  flatPart({ id: "rocket-window", label: "Jendela Roket", assembly: "Tempelkan jendela bundar di depan roket.", poly: discPoly(0.14), region: "rocketWindow", transform: { t: [-0.48, 0.18, 0.36] } }),
  prismPart({ id: "fin-l", label: "Sirip Roket", assembly: "Lipat dua sirip roket dan rekatkan di sisinya.", poly: [[0, 0.22], [0, -0.22], [-0.24, -0.24], [-0.2, 0.02]], depth: 0.08, region: "rocketFins", transform: { t: [-0.86, -0.28, 0] } }),
  prismPart({ id: "fin-r", label: "Sirip Roket", assembly: "Lipat dua sirip roket dan rekatkan di sisinya.", poly: [[0, 0.22], [0, -0.22], [0.24, -0.24], [0.2, 0.02]], depth: 0.08, region: "rocketFins", transform: { t: [-0.10, -0.28, 0] } }),
  conePart({ id: "rocket-flame", label: "Api Roket", assembly: "Gulung api roket menjadi kerucut mengarah ke bawah.", r: 0.16, h: 0.36, region: "rocketFlame", transform: { r: [Math.PI, 0, 0], t: [-0.48, -0.62, 0] } }),
  cylPart({ id: "astro-suit", label: "Baju Astronot", assembly: "Gulung baju astronot mini menjadi tabung.", r: 0.17, h: 0.42, region: "astroSuit", transform: { t: [0.38, -0.62, 0.15] } }),
  ballPart({ id: "astro-helmet", label: "Helm Astronot", assembly: "Buat bola helm mini dan rekatkan di atas bajunya.", r: 0.16, region: "astroHelmet", transform: { t: [0.38, -0.3, 0.15] } }),
  flatPart({ id: "astro-visor", label: "Kaca Helm", assembly: "Tempelkan kaca helm mini di depan helm.", poly: discPoly(0.09), region: "astroVisor", transform: { s: [1.15, 0.9, 1], t: [0.38, -0.3, 0.3] } }),
  nameplatePart("petualangan antariksamu"),
]);

const antariksa: TemplateDef = mkTemplate({
  id: "pb-antariksa",
  name: "Penjelajahan Antariksa",
  collection: "space-explorers",
  blurb: "Roket, planet bercincin, bulan, dan astronot mini dalam satu misi.",
  age: "4–5 tahun", ageBand: "4-5th",
  difficulty: 3,
  viewBox: [480, 360],
  regions: [
    { id: "earth", label: "Bumi", els: [
      { t: "circle", cx: 68, cy: 264, r: 35 },
    ] },
    { id: "rocketFlame", label: "Api Roket", els: [
      { t: "path", d: "M127 198 C133 218 141 232 150 243 C159 232 167 218 173 198 C161 210 139 210 127 198 Z" },
    ] },
    { id: "rocketFins", label: "Sirip Roket", els: [
      { t: "path", d: "M116 158 C95 179 86 204 88 224 C101 215 112 202 118 185 Z" },
      { t: "path", d: "M184 158 C205 179 214 204 212 224 C199 215 188 202 182 185 Z" },
    ] },
    { id: "rocketBody", label: "Badan Roket", els: [
      { t: "path", d: "M150 58 C183 95 193 142 189 198 L111 198 C107 142 117 95 150 58 Z" },
    ] },
    { id: "rocketNose", label: "Hidung Roket", els: [
      { t: "path", d: "M150 58 C167 77 177 98 183 123 C163 110 137 110 117 123 C123 98 133 77 150 58 Z" },
    ] },
    { id: "rocketStripe", label: "Garis Roket", els: [
      { t: "path", d: "M110 166 C136 177 164 177 190 166 L189 183 C162 192 138 192 111 183 Z" },
    ] },
    { id: "rocketWindow", label: "Jendela Roket", els: [
      { t: "circle", cx: 150, cy: 140, r: 18 },
    ] },
    { id: "ring", label: "Cincin Planet", els: [
      { t: "path", d: "M258 140 C298 110 384 110 420 133 C427 138 422 148 409 152 C366 133 298 135 269 152 C256 148 251 145 258 140 Z" },
    ] },
    { id: "planet", label: "Planet", els: [
      { t: "circle", cx: 332, cy: 118, r: 49 },
    ] },
    { id: "spots", label: "Bercak Planet", els: [
      { t: "circle", cx: 313, cy: 102, r: 11 },
      { t: "circle", cx: 350, cy: 133, r: 8 },
    ] },
    { id: "moon", label: "Bulan", els: [
      { t: "circle", cx: 424, cy: 234, r: 31 },
    ] },
    { id: "astroSuit", label: "Baju Astronot", els: [
      { t: "rect", x: 298, y: 198, w: 46, h: 56, rx: 17 },
    ] },
    { id: "astroHelmet", label: "Helm Astronot", els: [
      { t: "circle", cx: 321, cy: 179, r: 21 },
    ] },
    { id: "astroVisor", label: "Kaca Helm", els: [
      { t: "ellipse", cx: 321, cy: 179, rx: 13, ry: 10 },
    ] },
  ],
  details: [
    { el: { t: "circle", cx: 143, cy: 133, r: 6 }, fill: "#FFFFFF" },
    { el: { t: "path", d: "M48 248 C58 240 70 244 68 254 C76 250 84 256 80 264 C70 262 60 264 54 260 C46 258 44 252 48 248 Z" }, fill: "#FFFFFF", stroke: INK, sw: 3 },
    { el: { t: "circle", cx: 414, cy: 226, r: 6 }, fill: "none", stroke: INK, sw: 3 },
    { el: { t: "circle", cx: 434, cy: 246, r: 4.5 }, fill: "none", stroke: INK, sw: 3 },
    ...eyesAt(321, 177, 5, 3),
    smileAt(321, 183, 8),
  ],
  label: LBL,
  buildParts: antariksaParts,
  steps: stepsFrom(antariksaParts()),
});

const desaParts = memoParts((): CraftPart[] => [
  flatPart({ id: "grass", label: "Rumput", assembly: "Letakkan pita rumput pipih sebagai alas desa.", poly: rectPoly(2.3, 0.5), region: "grass", transform: { r: [Math.PI / 2, 0, 0], t: [0, -0.98, 0] } }),
  flatPart({ id: "path", label: "Jalan Setapak", assembly: "Letakkan jalan setapak pipih dari pintu rumah ke depan.", poly: [[-0.12, 0.3], [0.12, 0.3], [0.2, -0.3], [-0.2, -0.3]], region: "path", transform: { r: [Math.PI / 2, 0, 0], t: [-0.55, -0.97, 0.35] } }),
  flatPart({ id: "sun", label: "Matahari", assembly: "Tempelkan cakram matahari di langit desa.", poly: discPoly(0.2), region: "sun", transform: { t: [0.85, 0.78, -0.4] } }),
  flatPart({ id: "cloud", label: "Awan", assembly: "Tempelkan awan pipih di langit desa.", poly: [[-0.3, 0], [-0.28, 0.12], [-0.12, 0.2], [0.05, 0.22], [0.2, 0.16], [0.3, 0.05], [0.28, 0]], region: "cloud", transform: { t: [-0.78, 0.8, -0.4] } }),
  boxPart({ id: "house-1", label: "Rumah Pertama", assembly: "Lipat dinding rumah pertama menjadi kotak yang kokoh.", w: 0.72, h: 0.62, d: 0.6, regions: { front: "walls1", back: "walls1", left: "walls1", right: "walls1", top: "walls1", bottom: "walls1" }, transform: { t: [-0.55, -0.62, 0] } }),
  prismPart({ id: "roof-1", label: "Atap Pertama", assembly: "Lipat atap segitiga dan rekatkan di atas rumah pertama.", poly: [[-0.46, 0], [0.46, 0], [0, 0.4]], depth: 0.66, region: "roof1", transform: { t: [-0.55, -0.31, 0] } }),
  boxPart({ id: "chimney", label: "Cerobong", assembly: "Lipat cerobong kecil dan rekatkan di atap pertama.", w: 0.13, h: 0.24, d: 0.13, regions: { front: "chimney", back: "chimney", left: "chimney", right: "chimney", top: "chimney", bottom: "chimney" }, transform: { t: [-0.38, -0.05, 0] } }),
  boxPart({ id: "house-2", label: "Rumah Kedua", assembly: "Lipat dinding rumah kedua dan berdirikan di samping rumah pertama.", w: 0.6, h: 0.52, d: 0.55, regions: { front: "walls2", back: "walls2", left: "walls2", right: "walls2", top: "walls2", bottom: "walls2" }, transform: { t: [0.45, -0.67, -0.05] } }),
  prismPart({ id: "roof-2", label: "Atap Kedua", assembly: "Lipat atap kedua dan rekatkan di atas rumah kedua.", poly: [[-0.4, 0], [0.4, 0], [0, 0.36]], depth: 0.6, region: "roof2", transform: { t: [0.45, -0.41, -0.05] } }),
  flatPart({ id: "door", label: "Pintu", assembly: "Tempelkan pintu di depan rumah pertama.", poly: rectPoly(0.18, 0.34), region: "door", transform: { t: [-0.55, -0.76, 0.31] } }),
  flatPart({ id: "windows", label: "Jendela", assembly: "Tempelkan jendela-jendela kecil di kedua rumah.", poly: rectPoly(0.15, 0.15), region: "windows", transform: { t: [-0.78, -0.5, 0.31] } }),
  flatPart({ id: "windows-2", label: "Jendela", assembly: "Tempelkan jendela-jendela kecil di kedua rumah.", poly: rectPoly(0.15, 0.15), region: "windows", transform: { t: [0.45, -0.58, 0.24] } }),
  cylPart({ id: "trunk", label: "Batang Pohon", assembly: "Gulung batang pohon dan berdirikan di antara dua rumah.", r: 0.06, h: 0.34, region: "trunk", transform: { t: [0.02, -0.8, -0.1] } }),
  ballPart({ id: "tree", label: "Pohon", assembly: "Buat bola daun pohon dan rekatkan di atas batangnya.", r: 0.26, region: "tree", transform: { t: [0.02, -0.42, -0.1] } }),
  boxPart({ id: "fence", label: "Pagar", assembly: "Lipat pagar kecil dan berdirikan di depan rumah.", w: 0.7, h: 0.16, d: 0.05, regions: { front: "fence", back: "fence", left: "fence", right: "fence", top: "fence", bottom: "fence" }, transform: { t: [0.12, -0.9, 0.3] } }),
  flatPart({ id: "flowers", label: "Bunga", assembly: "Tempelkan bunga-bunga kecil di sepanjang rumput.", poly: discPoly(0.07), region: "flowers", transform: { t: [-0.9, -0.88, 0.3] } }),
  flatPart({ id: "flowers-2", label: "Bunga", assembly: "Tempelkan bunga-bunga kecil di sepanjang rumput.", poly: discPoly(0.07), region: "flowers", transform: { t: [0.82, -0.9, 0.3] } }),
  nameplatePart("desa minimu"),
]);

const desa: TemplateDef = mkTemplate({
  id: "pb-desa",
  name: "Desa Mini Ajaib",
  collection: "magical-garden",
  blurb: "Dua rumah mungil, satu pohon rindang, dan jalan setapak pulang.",
  age: "4–5 tahun", ageBand: "4-5th",
  difficulty: 3,
  viewBox: [480, 360],
  regions: [
    { id: "sun", label: "Matahari", els: [
      { t: "circle", cx: 426, cy: 52, r: 23 },
    ] },
    { id: "cloud", label: "Awan", els: [
      { t: "path", d: "M50 64 C60 47 86 45 98 57 C113 57 121 67 117 78 C103 86 65 86 54 78 C46 72 44 68 50 64 Z" },
    ] },
    { id: "grass", label: "Rumput", els: [
      { t: "path", d: "M0 252 C90 242 180 258 260 252 C340 246 420 256 480 250 L480 360 L0 360 Z" },
    ] },
    { id: "path", label: "Jalan Setapak", els: [
      { t: "path", d: "M124 252 L154 252 L166 302 L110 302 Z" },
    ] },
    { id: "walls1", label: "Dinding Rumah 1", els: [
      { t: "rect", x: 94, y: 176, w: 86, h: 76, rx: 6 },
    ] },
    { id: "roof1", label: "Atap Rumah 1", els: [
      { t: "path", d: "M82 178 L137 126 L192 178 Z" },
    ] },
    { id: "chimney", label: "Cerobong", els: [
      { t: "rect", x: 157, y: 130, w: 17, h: 28, rx: 3 },
    ] },
    { id: "walls2", label: "Dinding Rumah 2", els: [
      { t: "rect", x: 298, y: 186, w: 74, h: 66, rx: 6 },
    ] },
    { id: "roof2", label: "Atap Rumah 2", els: [
      { t: "path", d: "M288 188 L335 142 L382 188 Z" },
    ] },
    { id: "door", label: "Pintu", els: [
      { t: "rect", x: 125, y: 208, w: 25, h: 44, rx: 9 },
    ] },
    { id: "windows", label: "Jendela", els: [
      { t: "rect", x: 103, y: 192, w: 18, h: 18, rx: 4 },
      { t: "rect", x: 153, y: 192, w: 18, h: 18, rx: 4 },
      { t: "rect", x: 312, y: 202, w: 16, h: 16, rx: 4 },
      { t: "rect", x: 342, y: 202, w: 16, h: 16, rx: 4 },
    ] },
    { id: "tree", label: "Pohon", els: [
      { t: "circle", cx: 234, cy: 148, r: 31 },
      { t: "circle", cx: 211, cy: 168, r: 22 },
      { t: "circle", cx: 257, cy: 168, r: 22 },
    ] },
    { id: "trunk", label: "Batang Pohon", els: [
      { t: "rect", x: 227, y: 192, w: 13, h: 38, rx: 4 },
    ] },
    { id: "fence", label: "Pagar", els: [
      { t: "rect", x: 196, y: 234, w: 10, h: 24, rx: 3 },
      { t: "rect", x: 216, y: 234, w: 10, h: 24, rx: 3 },
      { t: "rect", x: 236, y: 234, w: 10, h: 24, rx: 3 },
      { t: "rect", x: 256, y: 234, w: 10, h: 24, rx: 3 },
    ] },
    { id: "flowers", label: "Bunga", els: [
      { t: "circle", cx: 66, cy: 272, r: 8 },
      { t: "circle", cx: 92, cy: 282, r: 7 },
      { t: "circle", cx: 392, cy: 276, r: 8 },
      { t: "circle", cx: 418, cy: 268, r: 7 },
    ] },
  ],
  details: [
    { el: { t: "circle", cx: 143, cy: 230, r: 3 }, fill: INK },
    ...eyesAt(426, 48, 8, 3.5),
    smileAt(426, 57, 12),
    { el: { t: "path", d: "M112 192 L112 210 M103 201 L121 201 M162 192 L162 210 M153 201 L171 201" }, stroke: INK, sw: 2.5 },
    { el: { t: "circle", cx: 66, cy: 272, r: 3 }, fill: INK },
    { el: { t: "circle", cx: 392, cy: 276, r: 3 }, fill: INK },
  ],
  label: LBL,
  buildParts: desaParts,
  steps: stepsFrom(desaParts()),
});

/** Koleksi Premium: 20 ilustrasi, tepat 4 per kategori umur. */
export const PREMIUM_TEMPLATES: TemplateDef[] = [
  beruang, gajah, ikanBundar, kelinciMungil,
  bebekKolam, kura, mobilKecil, kupu,
  babyDino, singa, roketRamah, anjing,
  dinoTaman, kelinciTaman, pemadam, astronot,
  duniaDino, laut, antariksa, desa,
];
