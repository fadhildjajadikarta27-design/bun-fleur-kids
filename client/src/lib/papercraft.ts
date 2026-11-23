// Papercraft engine v2: shape-preserving 3D parts + real mesh unfolding.
//
// Every featured character is built from CraftParts — indexed triangle /
// quad meshes whose faces carry coloring-region ids. The SAME faces drive:
//   1. the interactive 3D preview (partsToFaces → ModelViewer), and
//   2. the printable net: each part defines fold "strips" (chains of faces
//      sharing edges). The unfolder lays every strip flat by exact
//      trilateration from the 3D edge lengths — no distortion, no invented
//      geometry. Edges shared by two faces but cut in the net become
//      numbered joins; a glue tab is generated on one side of each join.
//      Fold lines are classified mountain/valley from the 3D dihedral.
//   3. the validator (analyzeCraft), which numerically re-checks coverage,
//      edge-length compatibility, overlaps, page fit, stability, colors,
//      the nameplate, and the front-view silhouette against the artwork.

import {
  elToPath,
  type Face,
  type NetDef,
  type NetOptions,
  type NetPiece,
  type Pt,
  type TemplateDef,
  type V3,
} from "./model";

/* ------------------------------ vectors ------------------------------ */

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const dist3 = (a: V3, b: V3) => len3(sub(a, b));
const centroid3 = (pts: V3[]): V3 => {
  const c: V3 = [0, 0, 0];
  for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length];
};
function faceNormal(verts: V3[], f: CraftFace): V3 {
  const a = verts[f.v[0]!]!, b = verts[f.v[1]!]!, c = verts[f.v[2]!]!;
  const n = cross(sub(b, a), sub(c, a));
  const l = len3(n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

export interface XfOpts { t?: V3; r?: V3; s?: V3 }

function applyXf(verts: V3[], o: XfOpts): V3[] {
  const [sx, sy, sz] = o.s ?? [1, 1, 1];
  const [rx, ry, rz] = o.r ?? [0, 0, 0];
  const [tx, ty, tz] = o.t ?? [0, 0, 0];
  const cx = Math.cos(rx), sxn = Math.sin(rx);
  const cy = Math.cos(ry), syn = Math.sin(ry);
  const cz = Math.cos(rz), szn = Math.sin(rz);
  return verts.map(([x0, y0, z0]) => {
    let x = x0 * sx, y = y0 * sy, z = z0 * sz;
    const y1 = y * cx - z * sxn, z1 = y * sxn + z * cx;
    y = y1; z = z1;
    const x2 = x * cy + z * syn, z2 = -x * syn + z * cy;
    x = x2; z = z2;
    const x3 = x * cz - y * szn, y3 = x * szn + y * cz;
    return [x3 + tx, y3 + ty, z + tz] as V3;
  });
}

/* ------------------------------ parts ------------------------------ */

export interface CraftFace {
  id: string;
  /** Vertex indices into CraftPart.verts (3 = triangle, 4 = quad). */
  v: number[];
  region: string;
}

export interface CraftPart {
  id: string;
  label: string;
  /** One plain-language assembly instruction for this part. */
  assembly: string;
  verts: V3[];
  faces: CraftFace[];
  /** Fold chains: consecutive faces share exactly one edge. */
  strips: number[][];
  /** Face index whose printed area carries the child's name. */
  nameplateFace?: number;
  /** Printed dots (eyes, nostrils, cheeks) placed on the nearest face. */
  decals3d?: { at: V3; r: number; fill?: string; region?: string }[];
}

class MeshBuilder {
  verts: V3[] = [];
  faces: CraftFace[] = [];
  private keys = new Map<string, number>();
  constructor(private partId: string) {}
  vert(p: V3): number {
    const k = p.map((n) => n.toFixed(4)).join(",");
    let i = this.keys.get(k);
    if (i === undefined) {
      i = this.verts.length;
      this.verts.push(p);
      this.keys.set(k, i);
    }
    return i;
  }
  face(pts: V3[], region: string): number {
    const idx = this.faces.length;
    this.faces.push({
      id: `${this.partId}:${idx}`,
      v: pts.map((p) => this.vert(p)),
      region,
    });
    return idx;
  }
}

/** Fix face winding so normals point away from the part centroid. */
function finalizePart(part: CraftPart): CraftPart {
  const c = centroid3(part.verts);
  for (const f of part.faces) {
    if (f.v.length < 3) continue;
    const pts = f.v.map((i) => part.verts[i]!);
    const n = faceNormal(part.verts, f);
    const fc = centroid3(pts);
    if (Math.abs(dot(n, sub(fc, c))) > 1e-9 && dot(n, sub(fc, c)) < 0) {
      f.v.reverse();
    }
  }
  return part;
}

export function mirrorPartsX(parts: CraftPart[]): CraftPart[] {
  return parts.map((p) =>
    finalizePart({
      ...p,
      verts: p.verts.map(([x, y, z]) => [-x, y, z] as V3),
      faces: p.faces.map((f) => ({ ...f, v: [...f.v] })),
      decals3d: p.decals3d?.map((d) => ({
        ...d,
        at: [-d.at[0], d.at[1], d.at[2]] as V3,
      })),
    }),
  );
}

/* --------------------------- lathe parts --------------------------- */

export interface LatheRing { r: number; y: number; cx?: number; cz?: number }

/**
 * A surface of revolution (egg, ball, cone, tube…) built as indexed
 * triangles. Profile runs bottom → top; r = 0 makes a pole. The net
 * strips pair adjacent gores, crossing at a pole/cap fan when one exists.
 */
export function lathePart(o: {
  id: string;
  label: string;
  assembly: string;
  profile: LatheRing[];
  segments: number;
  region: string | ((band: number, seg: number) => string);
  transform?: XfOpts;
  capBottomRegion?: string;
  capTopRegion?: string;
  decals3d?: CraftPart["decals3d"];
}): CraftPart {
  const S = o.segments;
  const regionAt = (band: number, seg: number) =>
    typeof o.region === "function" ? o.region(band, seg) : o.region;
  const b = new MeshBuilder(o.id);
  type Level = { pole: V3 } | { ring: V3[] };
  const levels: Level[] = [];
  const prof = o.profile;
  if (o.capBottomRegion && prof[0] && prof[0].r > 0.001) {
    levels.push({ pole: [prof[0].cx ?? 0, prof[0].y, prof[0].cz ?? 0] });
  }
  for (const p of prof) {
    if (p.r <= 0.001) levels.push({ pole: [p.cx ?? 0, p.y, p.cz ?? 0] });
    else {
      const ring: V3[] = [];
      for (let j = 0; j < S; j++) {
        const th = (j / S) * Math.PI * 2;
        ring.push([(p.cx ?? 0) + p.r * Math.cos(th), p.y, (p.cz ?? 0) + p.r * Math.sin(th)]);
      }
      levels.push({ ring });
    }
  }
  if (o.capTopRegion && prof[prof.length - 1] && prof[prof.length - 1]!.r > 0.001) {
    const last = prof[prof.length - 1]!;
    levels.push({ pole: [last.cx ?? 0, last.y, last.cz ?? 0] });
  }
  const isCapLevel = (li: number) =>
    (li === 0 && o.capBottomRegion && prof[0]!.r > 0.001) ||
    (li === levels.length - 1 && !!o.capTopRegion && prof[prof.length - 1]!.r > 0.001);

  // goreFaces[j] = chain of face indices, bottom → top (ascending order).
  const goreFaces: number[][] = Array.from({ length: S }, () => []);
  const L = levels.length;
  for (let li = 0; li < L - 1; li++) {
    const lo = levels[li]!, hi = levels[li + 1]!;
    const bandRegion = (seg: number) =>
      li === 0 && isCapLevel(0) ? o.capBottomRegion!
      : li === L - 2 && isCapLevel(L - 1) ? o.capTopRegion!
      : regionAt(li, seg);
    for (let j = 0; j < S; j++) {
      const j1 = (j + 1) % S;
      if ("pole" in lo && "ring" in hi) {
        goreFaces[j]!.push(b.face([lo.pole, hi.ring[j1]!, hi.ring[j]!], bandRegion(j)));
      } else if ("ring" in lo && "pole" in hi) {
        goreFaces[j]!.push(b.face([lo.ring[j]!, lo.ring[j1]!, hi.pole], bandRegion(j)));
      } else if ("ring" in lo && "ring" in hi) {
        const A = b.face([lo.ring[j]!, lo.ring[j1]!, hi.ring[j1]!], bandRegion(j));
        const B = b.face([lo.ring[j]!, hi.ring[j1]!, hi.ring[j]!], bandRegion(j));
        goreFaces[j]!.push(A, B);
      }
    }
  }
  const hasFanTop = "pole" in levels[L - 1]!;
  const hasFanBottom = "pole" in levels[0]!;
  const descending = (j: number) => [...goreFaces[j]!].reverse();
  const strips: number[][] = [];
  if (hasFanTop || hasFanBottom) {
    for (let g = 0; g < S; g += 2) {
      if (g + 1 < S) {
        strips.push(
          hasFanTop
            ? [...goreFaces[g]!, ...descending(g + 1)]
            : [...descending(g), ...goreFaces[g + 1]!],
        );
      } else strips.push(goreFaces[g]!);
    }
  } else {
    for (let g = 0; g < S; g++) strips.push(goreFaces[g]!);
  }
  const part: CraftPart = {
    id: o.id, label: o.label, assembly: o.assembly,
    verts: b.verts, faces: b.faces, strips, decals3d: o.decals3d,
  };
  if (o.transform) part.verts = applyXf(part.verts, o.transform);
  return finalizePart(part);
}

/* --------------------------- prism parts --------------------------- */

/** An extruded polygon (spikes, fins, roofs). One strip: front, sides, back. */
export function prismPart(o: {
  id: string;
  label: string;
  assembly: string;
  poly: Pt[];
  depth: number;
  region: string | { front?: string; back?: string; side?: string | string[] };
  transform?: XfOpts;
}): CraftPart {
  const b = new MeshBuilder(o.id);
  const z = o.depth / 2;
  const front: V3[] = o.poly.map(([x, y]) => [x, y, z]);
  const back: V3[] = o.poly.map(([x, y]) => [x, y, -z]);
  const reg = (k: "front" | "back"): string => {
    if (typeof o.region === "string") return o.region;
    const side = Array.isArray(o.region.side) ? o.region.side[0] : o.region.side;
    return (k === "front" ? o.region.front : o.region.back) ?? side ?? "body";
  };
  const sideReg = (i: number): string => {
    if (typeof o.region === "string") return o.region;
    const s = o.region.side;
    return Array.isArray(s) ? (s[i] ?? s[0]!) : (s ?? reg("front"));
  };
  const frontIdx = b.face(front, reg("front"));
  const sideIdx: number[] = [];
  for (let i = 0; i < o.poly.length; i++) {
    const a = front[i]!, c = front[(i + 1) % o.poly.length]!;
    const cB = back[(i + 1) % o.poly.length]!, aB = back[i]!;
    sideIdx.push(b.face([a, c, cB, aB], sideReg(i)));
  }
  const backIdx = b.face([...back].reverse(), reg("back"));
  const part: CraftPart = {
    id: o.id, label: o.label, assembly: o.assembly,
    verts: b.verts, faces: b.faces,
    strips: [[frontIdx, ...sideIdx, backIdx]],
  };
  if (o.transform) part.verts = applyXf(part.verts, o.transform);
  return finalizePart(part);
}

/* ---------------------------- box parts ---------------------------- */

/** A box built as a wrap-around strip (front→right→back→left) + lids. */
export function boxPart(o: {
  id: string;
  label: string;
  assembly: string;
  w: number; h: number; d: number;
  regions: { front: string; back: string; left: string; right: string; top?: string; bottom?: string };
  transform?: XfOpts;
  nameplate?: boolean;
  /** Split the wall strip in two halves so wide boxes fit the sheet. */
  splitWalls?: boolean;
}): CraftPart {
  const b = new MeshBuilder(o.id);
  const x = o.w / 2, y = o.h / 2, z = o.d / 2;
  const R = o.regions;
  const front = b.face([[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], R.front);
  const right = b.face([[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]], R.right);
  const back = b.face([[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]], R.back);
  const left = b.face([[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]], R.left);
  const strips: number[][] = o.splitWalls
    ? [[front, right], [back, left]]
    : [[front, right, back, left]];
  if (R.top) strips.push([b.face([[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]], R.top)]);
  if (R.bottom) strips.push([b.face([[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]], R.bottom)]);
  const part: CraftPart = {
    id: o.id, label: o.label, assembly: o.assembly,
    verts: b.verts, faces: b.faces, strips,
    nameplateFace: o.nameplate ? front : undefined,
  };
  if (o.transform) part.verts = applyXf(part.verts, o.transform);
  return finalizePart(part);
}

/* ---------------------------- flat parts ---------------------------- */

/** A single flat polygon part (appliqué door, window, sun disc…). */
export function flatPart(o: {
  id: string;
  label: string;
  assembly: string;
  poly: Pt[];
  region: string;
  transform?: XfOpts;
}): CraftPart {
  const b = new MeshBuilder(o.id);
  const idx = b.face(o.poly.map(([x, y]) => [x, y, 0] as V3), o.region);
  const part: CraftPart = {
    id: o.id, label: o.label, assembly: o.assembly,
    verts: b.verts, faces: b.faces, strips: [[idx]],
  };
  if (o.transform) part.verts = applyXf(part.verts, o.transform);
  return part;
}

export function rectPoly(w: number, h: number): Pt[] {
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
}

export function discPoly(r: number, n = 12): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)] as Pt;
  });
}

/** Flatten parts into viewer faces (the same geometry the net unfolds). */
export function partsToFaces(parts: CraftPart[]): Face[] {
  return parts.flatMap((p) =>
    p.faces.map((f) => ({
      pts: f.v.map((i) => p.verts[i]!),
      region: f.region,
      part: p.id,
    })),
  );
}

/* ----------------------------- unfolder ----------------------------- */

const d2 = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Circle-circle intersection; returns the candidate on the opposite
 *  side of line(p,q) from `ref` (or the first candidate if degenerate). */
function trilaterate(p: Pt, q: Pt, dp: number, dq: number, ref: Pt): Pt {
  const vx = q[0] - p[0], vy = q[1] - p[1];
  const L = Math.hypot(vx, vy) || 1e-9;
  const a = (dp * dp - dq * dq + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, dp * dp - a * a));
  const ux = vx / L, uy = vy / L;
  const mx = p[0] + a * ux, my = p[1] + a * uy;
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  const side = (pt: Pt) => Math.sign(vx * (pt[1] - p[1]) - vy * (pt[0] - p[0]));
  const rs = side(ref);
  if (rs !== 0 && side(c1) !== 0 && side(c1) !== rs) return c1;
  if (rs !== 0 && side(c2) !== 0 && side(c2) !== rs) return c2;
  return d2(c1, ref) >= d2(c2, ref) ? c1 : c2;
}

interface PlacedFace { faceIdx: number; poly: Pt[] }

/** Lay one strip flat. Returns placed faces in strip-local mm coords. */
function unfoldStrip(part: CraftPart, strip: number[], scale: number): PlacedFace[] {
  const placed: PlacedFace[] = [];
  const byFace = new Map<number, PlacedFace>();
  for (let k = 0; k < strip.length; k++) {
    const fi = strip[k]!;
    const face = part.faces[fi]!;
    const pts3 = face.v.map((i) => part.verts[i]!);
    if (k === 0) {
      // Place via the face's own plane basis — exact for any polygon.
      const o = pts3[0]!;
      const e1raw = sub(pts3[1]!, o);
      const e1l = len3(e1raw) || 1;
      const e1: V3 = [e1raw[0] / e1l, e1raw[1] / e1l, e1raw[2] / e1l];
      let n = faceNormal(part.verts, face);
      const e2 = cross(n, e1);
      const poly = pts3.map((p) => {
        const d = sub(p, o);
        return [dot(d, e1) * scale, dot(d, e2) * scale] as Pt;
      });
      const pf = { faceIdx: fi, poly };
      placed.push(pf); byFace.set(fi, pf);
      continue;
    }
    const prev = byFace.get(strip[k - 1]!)!;
    const prevFace = part.faces[strip[k - 1]!]!;
    // Shared edge: the two verts common to both faces.
    const shared = face.v.filter((v) => prevFace.v.includes(v));
    const sA = shared[0]!, sB = shared[1]!;
    const posOf = (pf: PlacedFace, f: CraftFace, v: number): Pt =>
      pf.poly[f.v.indexOf(v)]!;
    const pA = posOf(prev, prevFace, sA);
    const pB = posOf(prev, prevFace, sB);
    // Order this face's corners starting at sA → sB, then the rest in
    // cyclic polygon order after sB.
    const m = face.v.length;
    const iA = face.v.indexOf(sA), iB = face.v.indexOf(sB);
    const order: number[] = [];
    if ((iA + 1) % m === iB) { for (let t = 0; t < m; t++) order.push(face.v[(iA + t) % m]!); }
    else { for (let t = 0; t < m; t++) order.push(face.v[(iA - t + m * 2) % m]!); }
    const poly: Pt[] = new Array(m);
    const setPos = (v: number, p: Pt) => { poly[face.v.indexOf(v)] = p; };
    setPos(sA, pA); setPos(sB, pB);
    let ref: Pt = centroid2(prev.poly);
    for (let t = 2; t < m; t++) {
      const v = order[t]!;
      const w3 = part.verts[v]!;
      const a3 = part.verts[order[t - 1]!]!;
      const b3vert = t === 2 ? sA : order[0]!;
      const b3 = part.verts[b3vert]!;
      const pPrev = poly[face.v.indexOf(order[t - 1]!)]!;
      const pAnchor = t === 2 ? pA : poly[face.v.indexOf(order[0]!)]!;
      const pt = trilaterate(pPrev, pAnchor, dist3(w3, a3) * scale, dist3(w3, b3) * scale, ref);
      setPos(v, pt);
      if (t === 2) ref = pB;
    }
    const pf = { faceIdx: fi, poly };
    placed.push(pf); byFace.set(fi, pf);
  }
  return placed;
}

function centroid2(pts: Pt[]): Pt {
  return [
    pts.reduce((a, p) => a + p[0], 0) / pts.length,
    pts.reduce((a, p) => a + p[1], 0) / pts.length,
  ];
}

/* --------------------------- net assembly --------------------------- */

export interface JoinInfo {
  n: number;
  partId: string;
  lenMm: number;
  lenA: number;
  lenB: number;
}

export interface CraftBuild {
  net: NetDef;
  joins: JoinInfo[];
  /** src face id → true for every face that landed in the net. */
  coveredFaces: Set<string>;
}

interface EdgeInstance {
  part: CraftPart;
  stripIdx: number;
  faceIdx: number;
  p: Pt; q: Pt;
  faceCentroid: Pt;
  lenMm: number;
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export function buildCraftNet(
  parts: CraftPart[],
  opts: NetOptions | undefined,
  config: { steps: string[]; orientation: "portrait" | "landscape" },
): CraftBuild {
  const scale = 46 * ((opts?.scalePct ?? 100) / 100);
  const tabDepth = opts?.tabDepthMm ?? 7;
  const nameOffset = opts?.nameOffsetMm ?? 0;
  const paper = opts?.paper ?? "A4";
  const pageW = paper === "A3" ? 297 : 210;
  const pageH = paper === "A3" ? 420 : 297;
  const W = config.orientation === "portrait" ? pageW : pageH;
  const H = config.orientation === "portrait" ? pageH : pageW;

  const joins: JoinInfo[] = [];
  const covered = new Set<string>();
  const pieces: NetPiece[] = [];

  for (const part of parts) {
    // Unfold every strip of this part.
    const stripFaces: PlacedFace[][] = part.strips.map((s) => unfoldStrip(part, s, scale));
    const faceToStrip = new Map<number, number>();
    part.strips.forEach((s, si) => s.forEach((fi) => faceToStrip.set(fi, si)));

    // Fold edges: shared edges of consecutive faces inside a strip.
    const foldKeys = new Set<string>();
    for (const strip of part.strips) {
      for (let k = 0; k + 1 < strip.length; k++) {
        const f1 = part.faces[strip[k]!]!, f2 = part.faces[strip[k + 1]!]!;
        const shared = f1.v.filter((v) => f2.v.includes(v));
        if (shared.length >= 2) foldKeys.add(edgeKey(shared[0]!, shared[1]!));
      }
    }

    // Collect every face-edge instance in 2D.
    const instances = new Map<string, EdgeInstance[]>();
    stripFaces.forEach((faces, si) => {
      for (const pf of faces) {
        const face = part.faces[pf.faceIdx]!;
        covered.add(face.id);
        const fc = centroid2(pf.poly);
        for (let i = 0; i < face.v.length; i++) {
          const va = face.v[i]!, vb = face.v[(i + 1) % face.v.length]!;
          const key = edgeKey(va, vb);
          const inst: EdgeInstance = {
            part, stripIdx: si, faceIdx: pf.faceIdx,
            p: pf.poly[i]!, q: pf.poly[(i + 1) % face.v.length]!,
            faceCentroid: fc,
            lenMm: dist3(part.verts[va]!, part.verts[vb]!) * scale,
          };
          const arr = instances.get(key) ?? [];
          arr.push(inst);
          instances.set(key, arr);
        }
      }
    });

    // Build the pieces for this part.
    const partPieces: NetPiece[] = stripFaces.map((faces, si) => ({
      id: `${part.id}-${si + 1}`,
      label: part.strips.length > 1 ? `${part.label} · strip ${si + 1}` : part.label,
      region: part.faces[faces[0]!.faceIdx]!.region,
      polygon: faces[0]!.poly,
      faces: faces.map((pf) => ({
        polygon: pf.poly,
        region: part.faces[pf.faceIdx]!.region,
        src: part.faces[pf.faceIdx]!.id,
      })),
      tabs: [], cutEdges: [], foldLines: [], edgeNumbers: [], decals: [],
      partId: part.id,
      labelAt: centroid2(
        faces.reduce((best, pf) => (polyArea(pf.poly) > polyArea(best.poly) ? pf : best), faces[0]!).poly,
      ),
    }));

    // Classify edges: fold / numbered join (+tab) / open boundary.
    // Tabs are placed provisionally and verified once all pieces of the
    // part exist: a tab that would cover artwork is moved to the mating
    // edge, or dropped (the numbered join still glues edge-to-edge).
    const pendingTabs: {
      piece: NetPiece; tab: Pt[];
      matePiece: NetPiece; mateP: Pt; mateQ: Pt; mateCentroid: Pt;
    }[] = [];
    let joinCounter = 0;
    for (const [key, arr] of instances) {
      if (arr.length === 2 && foldKeys.has(key)) {
        const inst = arr[0]!;
        const piece = partPieces[inst.stripIdx]!;
        const f1 = part.faces[inst.faceIdx]!;
        const other = arr[1]!;
        const f2 = part.faces[other.faceIdx]!;
        const va = Number(key.split(":")[0]), vb = Number(key.split(":")[1]);
        const mid3 = centroid3([part.verts[va]!, part.verts[vb]!]);
        const opp = f2.v.find((v) => v !== va && v !== vb);
        const kind: "mountain" | "valley" =
          opp !== undefined && dot(sub(part.verts[opp]!, mid3), faceNormal(part.verts, f1)) < 0
            ? "mountain"
            : "valley";
        piece.foldLines!.push({ a: inst.p, b: inst.q, kind });
      } else if (arr.length === 2) {
        joinCounter += 1;
        const n = joinCounter;
        const [i1, i2] = arr as [EdgeInstance, EdgeInstance];
        joins.push({ n, partId: part.id, lenMm: i1.lenMm, lenA: d2(i1.p, i1.q), lenB: d2(i2.p, i2.q) });
        const tabTarget = i1.stripIdx <= i2.stripIdx ? i1 : i2;
        const mate = tabTarget === i1 ? i2 : i1;
        for (const inst of arr) {
          const piece = partPieces[inst.stripIdx]!;
          piece.cutEdges!.push([inst.p, inst.q]);
          const mid: Pt = [(inst.p[0] + inst.q[0]) / 2, (inst.p[1] + inst.q[1]) / 2];
          const out = outward(inst.p, inst.q, inst.faceCentroid, 3.4);
          piece.edgeNumbers!.push({ x: mid[0] + out[0], y: mid[1] + out[1], n });
          if (inst === tabTarget && inst.lenMm >= 5) {
            pendingTabs.push({
              piece,
              tab: makeTab(inst.p, inst.q, inst.faceCentroid, tabDepth),
              matePiece: partPieces[mate.stripIdx]!,
              mateP: mate.p, mateQ: mate.q, mateCentroid: mate.faceCentroid,
            });
          }
        }
      } else {
        for (const inst of arr) {
          partPieces[inst.stripIdx]!.cutEdges!.push([inst.p, inst.q]);
        }
      }
    }

    // Decals: pin each 3D decal onto its nearest face's printed position.
    for (const d of part.decals3d ?? []) {
      let best: { si: number; pf: PlacedFace; dist: number } | null = null;
      stripFaces.forEach((faces, si) => {
        for (const pf of faces) {
          const face = part.faces[pf.faceIdx]!;
          const c3 = centroid3(face.v.map((i) => part.verts[i]!));
          const dd = dist3(c3, d.at);
          if (!best || dd < best.dist) best = { si, pf, dist: dd };
        }
      });
      if (best) {
        const b = best as { si: number; pf: PlacedFace };
        const c = centroid2(b.pf.poly);
        partPieces[b.si]!.decals!.push({
          circle: { cx: c[0], cy: c[1], r: d.r * scale },
          fill: d.fill,
          region: d.region,
        });
      }
    }

    // Nameplate: shrink the designated face's printed polygon a little.
    if (part.nameplateFace !== undefined) {
      const si = faceToStrip.get(part.nameplateFace);
      if (si !== undefined) {
        const pf = stripFaces[si]!.find((f) => f.faceIdx === part.nameplateFace);
        if (pf) {
          const c = centroid2(pf.poly);
          const shrunk = pf.poly.map(
            (p) => [c[0] + (p[0] - c[0]) * 0.86 + nameOffset, c[1] + (p[1] - c[1]) * 0.8] as Pt,
          );
          partPieces[si]!.nameplate = shrunk;
          partPieces[si]!.noRotate = true;
        }
      }
    }

    // Verify provisional tabs against the finished pieces.
    const tabOverlaps = (piece: NetPiece, tab: Pt[]) =>
      (piece.faces ?? []).some((f) => polysOverlap(tab, f.polygon));
    for (const job of pendingTabs) {
      if (!tabOverlaps(job.piece, job.tab)) {
        job.piece.tabs!.push(job.tab);
      } else {
        const mt = makeTab(job.mateP, job.mateQ, job.mateCentroid, tabDepth);
        if (!tabOverlaps(job.matePiece, mt)) job.matePiece.tabs!.push(mt);
      }
    }
    pieces.push(...partPieces);
  }

  const pages = packPieces(pieces, W, H);
  const all = pages.flatMap((p) => p.pieces);
  return {
    net: {
      orientation: config.orientation,
      widthMm: W,
      heightMm: H,
      pieces: all,
      steps: config.steps,
      pages,
      engine: true,
    },
    joins,
    coveredFaces: covered,
  };
}

function polyArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}

/** Unit outward offset from edge p→q, away from `inside` point, scaled. */
function outward(p: Pt, q: Pt, inside: Pt, dist: number): Pt {
  const vx = q[0] - p[0], vy = q[1] - p[1];
  const L = Math.hypot(vx, vy) || 1;
  let nx = -vy / L, ny = vx / L;
  const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  if ((inside[0] - mid[0]) * nx + (inside[1] - mid[1]) * ny > 0) { nx = -nx; ny = -ny; }
  return [nx * dist, ny * dist];
}

function makeTab(p: Pt, q: Pt, inside: Pt, depth: number): Pt[] {
  const inset = 0.18;
  const a: Pt = [p[0] + (q[0] - p[0]) * inset, p[1] + (q[1] - p[1]) * inset];
  const b: Pt = [p[0] + (q[0] - p[0]) * (1 - inset), p[1] + (q[1] - p[1]) * (1 - inset)];
  const off = outward(p, q, inside, depth);
  return [a, b, [b[0] + off[0], b[1] + off[1]], [a[0] + off[0], a[1] + off[1]]];
}

/* ----------------------------- packing ----------------------------- */

function piecePolys(piece: NetPiece): Pt[][] {
  const polys: Pt[][] = [];
  for (const f of piece.faces ?? []) polys.push(f.polygon);
  for (const t of piece.tabs ?? []) polys.push(t);
  if (piece.nameplate) polys.push(piece.nameplate);
  return polys;
}

function pieceBBox(piece: NetPiece): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of piecePolys(piece)) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function mapPiece(piece: NetPiece, fn: (p: Pt) => Pt): NetPiece {
  return {
    ...piece,
    polygon: piece.polygon.map(fn),
    faces: piece.faces?.map((f) => ({ ...f, polygon: f.polygon.map(fn) })),
    tabs: piece.tabs?.map((t) => t.map(fn)),
    cutEdges: piece.cutEdges?.map(([a, b]) => [fn(a), fn(b)] as [Pt, Pt]),
    foldLines: piece.foldLines?.map((f) => ({ ...f, a: fn(f.a), b: fn(f.b) })),
    edgeNumbers: piece.edgeNumbers?.map((e) => { const p = fn([e.x, e.y]); return { ...e, x: p[0], y: p[1] }; }),
    decals: piece.decals?.map((d) =>
      d.circle
        ? { ...d, circle: { ...d.circle, cx: fn([d.circle.cx, d.circle.cy])[0], cy: fn([d.circle.cx, d.circle.cy])[1] } }
        : d,
    ),
    nameplate: piece.nameplate?.map(fn),
    labelAt: piece.labelAt ? fn(piece.labelAt) : undefined,
  };
}

/** Shelf-pack pieces onto sheets; header zone (top 24mm) stays clear. */
function packPieces(pieces: NetPiece[], W: number, H: number): { pieces: NetPiece[] }[] {
  const areaX = 9, areaY = 25, areaW = W - 18, areaH = H - 25 - 9;
  const gap = 3.5;
  // Normalize each piece to its bbox origin first.
  const norm = pieces.map((p) => {
    const bb = pieceBBox(p);
    return mapPiece(p, ([x, y]) => [x - bb.minX, y - bb.minY]);
  });
  const sized = norm.map((p) => {
    const bb = pieceBBox(p);
    return { p, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY };
  });
  sized.sort((a, b) => b.h - a.h);
  const pages: { pieces: NetPiece[] }[] = [];
  let page: NetPiece[] = [];
  let shelfY = 0, shelfH = 0, cursorX = 0;
  const newPage = () => {
    if (page.length) pages.push({ pieces: page });
    page = []; shelfY = 0; shelfH = 0; cursorX = 0;
  };
  for (const item of sized) {
    const orientations = [
      { w: item.w, h: item.h, rot: false },
      { w: item.h, h: item.w, rot: true },
    ]
      .filter((or) => !or.rot || !item.p.noRotate)
      .filter((or) => or.w <= areaW && or.h <= areaH);
    if (!orientations.length) { // oversize piece: place alone; validator flags fit
      newPage();
      page.push(mapPiece(item.p, ([x, y]) => [x + areaX, y + areaY]));
      newPage();
      continue;
    }
    let done = false;
    if (shelfH > 0) {
      for (const or of orientations) {
        if (cursorX + or.w <= areaW && or.h <= shelfH) {
          const rot = or.rot ? rotate90(item.p, item.h) : item.p;
          page.push(mapPiece(rot, ([x, y]) => [x + areaX + cursorX, y + areaY + shelfY]));
          cursorX += or.w + gap;
          done = true;
          break;
        }
      }
    }
    if (!done) {
      const or = orientations.reduce((best, c) => (c.h < best.h ? c : best), orientations[0]!);
      let yy = page.length === 0 ? 0 : shelfY + shelfH + gap;
      if (yy + or.h > areaH) { newPage(); yy = 0; }
      const rot = or.rot ? rotate90(item.p, item.h) : item.p;
      page.push(mapPiece(rot, ([x, y]) => [x + areaX, y + areaY + yy]));
      shelfY = yy;
      shelfH = or.h;
      cursorX = or.w + gap;
    }
  }
  newPage();
  return pages.length ? pages : [{ pieces: [] }];
}

function rotate90(piece: NetPiece, height: number): NetPiece {
  return mapPiece(piece, ([x, y]) => [height - y, x]);
}

/* ---------------------------- validation ---------------------------- */

export interface CraftCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface CraftAnalysis {
  ok: boolean;
  engine: boolean;
  checks: CraftCheck[];
  stats: { faces: number; pieces: number; sheets: number; joins: number };
  /** One-line summary of the print format these checks describe. */
  formatLabel?: string;
}

type Tri = [Pt, Pt, Pt];

function triOf(poly: Pt[]): Tri[] {
  const tris: Tri[] = [];
  for (let i = 1; i + 1 < poly.length; i++) tris.push([poly[0]!, poly[i]!, poly[i + 1]!]);
  return tris;
}
function shrinkTri(t: Tri, f: number): Tri {
  const c = centroid2(t);
  return t.map((p) => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f] as Pt) as Tri;
}
function segCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}
function pointInTri(p: Pt, t: Tri): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = o(t[0], t[1], p), d2 = o(t[1], t[2], p), d3 = o(t[2], t[0], p);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
function trisOverlap(a0: Tri, b0: Tri): boolean {
  const a = shrinkTri(a0, 0.94), b = shrinkTri(b0, 0.94);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (segCross(a[i]!, a[(i + 1) % 3]!, b[j]!, b[(j + 1) % 3]!)) return true;
    }
  }
  return pointInTri(centroid2(a), b) || pointInTri(centroid2(b), a);
}
function polysOverlap(a: Pt[], b: Pt[]): boolean {
  for (const ta of triOf(a)) for (const tb of triOf(b)) if (trisOverlap(ta, tb)) return true;
  return false;
}

function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const half = (seq: Pt[]) => {
    const h: Pt[] = [];
    for (const p of seq) {
      while (h.length >= 2) {
        const a = h[h.length - 2]!, b = h[h.length - 1]!;
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) <= 0) h.pop();
        else break;
      }
      h.push(p);
    }
    return h;
  };
  const lower = half(pts);
  const upper = half([...pts].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

/** Rasterize the artwork and the model's front silhouette; return IoU. */
/** Bounds of the artwork itself (union of all coloring regions), so the
 *  silhouette comparison fits the drawing by its own bbox — exactly the
 *  way the model grid below is fit by the model's bbox. Fitting the
 *  artwork by the whole viewBox instead would penalize characters whose
 *  page has wide empty margins or a name-label zone, i.e. it would grade
 *  page framing, not character shape. */
function artworkBounds(template: TemplateDef): { minX: number; minY: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eat = (x: number, y: number) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  for (const r of template.regions) {
    for (const el of r.els) {
      if (el.t === "rect") { eat(el.x, el.y); eat(el.x + el.w, el.y + el.h); }
      else if (el.t === "circle") { eat(el.cx - el.r, el.cy - el.r); eat(el.cx + el.r, el.cy + el.r); }
      else if (el.t === "ellipse") { eat(el.cx - el.rx, el.cy - el.ry); eat(el.cx + el.rx, el.cy + el.ry); }
      else {
        // Sample the path (M/L/H/V/C/Z, absolute) so curve bounds are real.
        const toks = el.d.match(/[MLCHVZ]|-?\d*\.?\d+/g) ?? [];
        let i = 0, cmd = "", cx = 0, cy = 0, sx = 0, sy = 0;
        const num = () => parseFloat(toks[i++]!);
        while (i < toks.length) {
          const t = toks[i]!;
          if (/[MLCHVZ]/.test(t)) {
            cmd = t; i++;
            if (cmd === "Z") { cx = sx; cy = sy; }
            continue;
          }
          if (cmd === "M") { sx = cx = num(); sy = cy = num(); eat(cx, cy); cmd = "L"; }
          else if (cmd === "L") { cx = num(); cy = num(); eat(cx, cy); }
          else if (cmd === "H") { cx = num(); eat(cx, cy); }
          else if (cmd === "V") { cy = num(); eat(cx, cy); }
          else if (cmd === "C") {
            const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
            for (let k = 1; k <= 16; k++) {
              const u = k / 16, v = 1 - u;
              eat(
                v * v * v * cx + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x,
                v * v * v * cy + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y,
              );
            }
            cx = x; cy = y;
          } else break;
        }
      }
    }
  }
  if (!Number.isFinite(minX)) { const [vw, vh] = template.viewBox; return { minX: 0, minY: 0, w: vw, h: vh }; }
  return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function silhouetteIou(template: TemplateDef, faces: Face[]): number {
  try {
    const GW = 48, GH = 36;
    const art = document.createElement("canvas");
    art.width = GW; art.height = GH;
    const actx = art.getContext("2d");
    if (!actx) return 0;
    const ab = artworkBounds(template);
    const s = Math.min(GW / ab.w, GH / ab.h);
    const ox = (GW - ab.w * s) / 2 - ab.minX * s, oy = (GH - ab.h * s) / 2 - ab.minY * s;
    actx.fillStyle = "#000";
    for (const r of template.regions) {
      for (const el of r.els) {
        const path = new Path2D(elToPath(el));
        actx.save();
        actx.translate(ox, oy);
        actx.scale(s, s);
        actx.fill(path);
        actx.restore();
      }
    }
    const artData = actx.getImageData(0, 0, GW, GH).data;
    const grid = (flip: boolean): boolean[] => {
      const xs = faces.map((f) => f.pts.map((p) => (flip ? -p[0] : p[0])));
      const ys = faces.map((f) => f.pts.map((p) => p[1]));
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      faces.forEach((f, i) => f.pts.forEach((_, j) => {
        minX = Math.min(minX, xs[i]![j]!); maxX = Math.max(maxX, xs[i]![j]!);
        minY = Math.min(minY, ys[i]![j]!); maxY = Math.max(maxY, ys[i]![j]!);
      }));
      const c = document.createElement("canvas");
      c.width = GW; c.height = GH;
      const ctx = c.getContext("2d")!;
      const sc = Math.min(GW / (maxX - minX || 1), GH / (maxY - minY || 1));
      const oxx = (GW - (maxX - minX) * sc) / 2, oyy = (GH - (maxY - minY) * sc) / 2;
      ctx.fillStyle = "#000";
      faces.forEach((f, i) => {
        ctx.beginPath();
        f.pts.forEach((_, j) => {
          const X = oxx + (xs[i]![j]! - minX) * sc;
          const Y = GH - (oyy + (ys[i]![j]! - minY) * sc); // model y is up, canvas y is down
          if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        });
        ctx.closePath();
        ctx.fill();
      });
      const d = ctx.getImageData(0, 0, GW, GH).data;
      return Array.from({ length: GW * GH }, (_, i) => d[i * 4 + 3]! > 40);
    };
    const iou = (g: boolean[]) => {
      let inter = 0, union = 0;
      for (let i = 0; i < GW * GH; i++) {
        const a = artData[i * 4 + 3]! > 40;
        if (a || g[i]) union++;
        if (a && g[i]) inter++;
      }
      return union ? inter / union : 0;
    };
    return Math.max(iou(grid(false)), iou(grid(true)));
  } catch {
    return 0;
  }
}

export function analyzeCraft(
  template: TemplateDef,
  colors: Record<string, string>,
  name: string,
): CraftAnalysis {
  if (!template.buildParts) {
    return {
      ok: false, engine: false, stats: { faces: 0, pieces: 0, sheets: 0, joins: 0 },
      checks: [{
        id: "engine", label: "Mesh pembentuk karakter + jaring terbuka",
        ok: false,
        detail: "Karakter ini masih memakai jaring gambar-di-atas-kubus yang lama. Belum dibangun ulang di mesin papercraft, jadi statusnya tetap Draf.",
      }],
    };
  }
  const parts = template.buildParts();
  const { net, joins, coveredFaces } = buildCraftNet(parts, undefined, {
    steps: template.buildNet().steps,
    orientation: template.buildNet().orientation,
  });
  const checks: CraftCheck[] = [];
  const allFaces = parts.flatMap((p) => p.faces);
  const meshIds = new Set(allFaces.map((f) => f.id));

  // 1 — coverage: every mesh face is in the net exactly once.
  const netSrc = (net.pages ?? []).flatMap((pg) => pg.pieces.flatMap((pc) => (pc.faces ?? []).map((f) => f.src!)));
  const dupes = netSrc.length - new Set(netSrc).size;
  checks.push({
    id: "coverage", label: "Setiap permukaan 3D punya sisi cetak yang cocok",
    ok: coveredFaces.size === meshIds.size && dupes === 0,
    detail: `${netSrc.length} sisi cetak untuk ${meshIds.size} sisi mesh${dupes ? `, ${dupes} terduplikasi` : ""}.`,
  });

  // 2 — joining edges have compatible lengths.
  const worstJoin = joins.reduce((w, j) => Math.max(w, Math.abs(j.lenA - j.lenB), Math.abs(j.lenA - j.lenMm)), 0);
  checks.push({
    id: "edges", label: "Panjang tepi sambungan cocok",
    ok: joins.length > 0 && worstJoin <= 0.5,
    detail: `${joins.length} sambungan bernomor; selisih terburuk ${worstJoin.toFixed(2)} mm (toleransi 0,5 mm).`,
  });

  // 3+5 — overlaps: faces within pieces, tabs vs artwork, pieces per sheet.
  let overlapDetail = "";
  let overlapOk = true;
  for (const pg of net.pages ?? []) {
    const sheetFaces: { poly: Pt[]; piece: string }[] = [];
    for (const pc of pg.pieces) {
      const faces = pc.faces ?? [];
      for (let i = 0; i < faces.length && overlapOk; i++) {
        for (let j = i + 1; j < faces.length; j++) {
          if (polysOverlap(faces[i]!.polygon, faces[j]!.polygon)) {
            overlapOk = false;
            overlapDetail = `Sisi-sisi tumpang tindih di dalam potongan “${pc.label}”.`;
            break;
          }
        }
      }
      for (const f of faces) sheetFaces.push({ poly: f.polygon, piece: pc.id });
      for (const t of pc.tabs ?? []) sheetFaces.push({ poly: t, piece: `${pc.id}-tab` });
    }
    if (overlapOk) {
      outer: for (let i = 0; i < sheetFaces.length; i++) {
        for (let j = i + 1; j < sheetFaces.length; j++) {
          const A = sheetFaces[i]!, B = sheetFaces[j]!;
          if (A.piece === B.piece) continue;
          if (A.piece.replace(/-tab$/, "") === B.piece.replace(/-tab$/, "") && (A.piece.endsWith("-tab") || B.piece.endsWith("-tab"))) {
            // a tab may touch its own piece's faces along its base edge only
            if (polysOverlap(A.poly, B.poly)) { overlapOk = false; overlapDetail = "Sebuah tab lem menimpa gambar pada potongannya sendiri."; break outer; }
            continue;
          }
          if (polysOverlap(A.poly, B.poly)) {
            overlapOk = false;
            overlapDetail = "Potongan atau tab tumpang tindih di lembar cetak.";
            break outer;
          }
        }
      }
    }
    if (!overlapOk) break;
  }
  checks.push({
    id: "overlap", label: "Tidak ada sisi, tab, atau potongan yang tumpang tindih di lembar",
    ok: overlapOk,
    detail: overlapOk ? "Semua lembar bebas tumpang tindih, dan tab lem tidak menimpa gambar." : overlapDetail,
  });

  // 4 — page fit with print-safe margins.
  let fitOk = true;
  for (const pg of net.pages ?? []) {
    for (const pc of pg.pieces) {
      for (const poly of piecePolys(pc)) {
        for (const [x, y] of poly) {
          if (x < 4 || y < 4 || x > net.widthMm - 4 || y > net.heightMm - 4) fitOk = false;
        }
      }
    }
  }
  checks.push({
    id: "fit", label: "Semua bagian muat di dalam margin halaman cetak",
    ok: fitOk,
    detail: `${net.pages?.length ?? 1} lembar ukuran ${net.widthMm}×${net.heightMm} mm, margin aman cetak 4 mm terpenuhi.`,
  });

  // 5 — stability: center of mass over the support polygon (the convex
  // hull of every mesh vertex that touches the ground plane).
  const faces3 = partsToFaces(parts);
  let minY = Infinity;
  for (const part of parts) for (const v of part.verts) minY = Math.min(minY, v[1]);
  const support: Pt[] = [];
  for (const part of parts) {
    for (const v of part.verts) {
      if (v[1] <= minY + 0.02) support.push([v[0], v[2]]);
    }
  }
  let comX = 0, comZ = 0, wSum = 0;
  for (const part of parts) {
    for (const f of part.faces) {
      const pts = f.v.map((i) => part.verts[i]!);
      const c = centroid3(pts);
      const area = len3(cross(sub(pts[1]!, pts[0]!), sub(pts[2]!, pts[0]!))) / 2;
      comX += c[0] * area; comZ += c[2] * area; wSum += area;
    }
  }
  comX /= wSum || 1; comZ /= wSum || 1;
  const hull = convexHull(support);
  const stable = hull.length >= 3 && pointInPoly([comX, comZ], hull);
  checks.push({
    id: "stability", label: "Berdiri stabil di alas yang rata",
    ok: stable,
    detail: stable
      ? `${support.length} titik kontak tanah membentuk alasnya; titik berat terproyeksi di dalamnya.`
      : "Titik berat jatuh di luar garis kontak tanah — mainannya akan terguling.",
  });

  // 6 — silhouette: model front view vs the 2D artwork.
  const iou = silhouetteIou(template, faces3);
  checks.push({
    id: "silhouette", label: "Siluet cocok dengan gambar asli",
    ok: iou >= 0.42,
    detail: `Tumpang tindih tampak depan dengan halaman mewarnai: ${Math.round(iou * 100)}% (perlu ≥ 42%).`,
  });

  // 7 — shape-preserving geometry: characters must be faceted lathes /
  // prisms, not cuboids. Buildings are rectilinear by design, so for
  // Little Homes the shaped element required is the prism roof/gables.
  const triFaces = allFaces.filter((f) => f.v.length === 3).length;
  const rectilinear = template.collection === "little-homes" || template.collection === "little-vehicles";
  const hasShapedPart = parts.some((p) => p.faces.some((f) => f.v.length === 3));
  checks.push({
    id: "rounded", label: "Geometri pembentuk karakter (tanpa konversi kubus generik)",
    ok: rectilinear ? hasShapedPart : triFaces / Math.max(1, allFaces.length) > 0.6,
    detail: rectilinear
      ? "Kendaraan dan bangunan memang bersudut lurus; bentuknya datang dari komponen lathe/prisma lipatnya (roda, atap, sirip), dan setiap panel dibuka dari mesh yang sama dengan pratinjaunya."
      : `${triFaces} dari ${allFaces.length} sisi adalah segitiga dari permukaan lathe/prisma yang melengkung.`,
  });

  // 8 — regions: mesh regions ⊆ coloring regions; colored regions print.
  const special = new Set(["__ink", "__butter", "plate", "__nameplate"]);
  const regionIds = new Set(template.regions.map((r) => r.id));
  const usedRegions = new Set(allFaces.map((f) => f.region));
  const unknown = [...usedRegions].filter((r) => !regionIds.has(r) && !special.has(r));
  const netRegions = new Set(netSrc.map((src) => allFaces.find((f) => f.id === src)?.region));
  (net.pages ?? []).forEach((pg) => pg.pieces.forEach((pc) => (pc.decals ?? []).forEach((d) => { if (d.region) netRegions.add(d.region); })));
  const dropped = Object.keys(colors).filter((r) => regionIds.has(r) && !netRegions.has(r));
  checks.push({
    id: "regions", label: "Region warna terpetakan 1:1 antara gambar, 3D, dan cetakan",
    ok: unknown.length === 0 && dropped.length === 0,
    detail: unknown.length
      ? `Mesh memakai region tak dikenal: ${unknown.join(", ")}.`
      : dropped.length
        ? `Region berwarna yang hilang dari jaring: ${dropped.join(", ")}.`
        : `${usedRegions.size} region dipakai bersama di halaman SVG, mesh, dan jaring.`,
  });

  // 9 — nameplate present and the name fits.
  const plate = (net.pages ?? []).flatMap((pg) => pg.pieces).find((pc) => pc.nameplate);
  let nameOk = false, nameDetail = "Tidak ada papan nama di jaring ini.";
  if (plate?.nameplate) {
    const xs = plate.nameplate.map((p) => p[0]);
    const ys = plate.nameplate.map((p) => p[1]);
    const wMm = Math.max(...xs) - Math.min(...xs);
    const hMm = Math.max(...ys) - Math.min(...ys);
    const label = (name.trim() || "BABA").toUpperCase();
    const sizePt = Math.min(13, hMm * (72 / 25.4) * 0.52);
    const estWidthMm = (label.length * sizePt * 0.56) / (72 / 25.4);
    nameOk = estWidthMm <= wMm - 3;
    nameDetail = `Papan nama ${wMm.toFixed(0)}×${hMm.toFixed(0)} mm; “${label}” butuh ≈${estWidthMm.toFixed(0)} mm pada ukuran cetak.`;
  }
  checks.push({ id: "name", label: "Nama pribadi terpasang dan muat di plakatnya", ok: nameOk, detail: nameDetail });

  // 10 — assembly plan covers every part.
  const stepsText = net.steps.join(" ").toLowerCase();
  const missingSteps = parts.filter((p) => !stepsText.includes(p.label.toLowerCase().split(" ")[0]!));
  checks.push({
    id: "steps", label: "Petunjuk rakit mencakup setiap komponen",
    ok: missingSteps.length === 0,
    detail: missingSteps.length
      ? `Tidak ada petunjuk yang menyebut: ${missingSteps.map((p) => p.label).join(", ")}.`
      : `${parts.length} komponen, masing-masing dengan langkah petunjuknya sendiri.`,
  });

  return {
    ok: checks.every((c) => c.ok),
    engine: true,
    checks,
    stats: {
      faces: allFaces.length,
      pieces: (net.pages ?? []).reduce((a, pg) => a + pg.pieces.length, 0),
      sheets: net.pages?.length ?? 1,
      joins: joins.length,
    },
  };
}
