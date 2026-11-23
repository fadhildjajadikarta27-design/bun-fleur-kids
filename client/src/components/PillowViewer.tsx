// Interactive 3D preview of the PAPER PILLOW — the default digital model.
//
// This renders the exact product the customer receives, built from the
// same single source of truth as the print dieline (buildPillowNet):
//   FRONT PANEL — the child's own colored artwork (regions + freehand
//     strokes + details, identical drawing to the printed front panel),
//     texture-mapped onto the traced silhouette outline.
//   GUSSET EDGE — the outline extruded by the pillow's real thickness
//     (thicknessMm from the net, scaled by the printed panel height),
//     filled with the net's dominant region color — the same color the
//     printed gusset strip gets.
//   BACK PANEL — the same outline carrying the SAME artwork texture,
//     exactly like the assembled printed pillow: the printed back
//     panel is mirrored on the sheet, but flipping it over during
//     assembly cancels the mirror, so the finished back shows the
//     artwork reading correctly, with no text on either panel.
//   STAND — the foldable U-channel from the net (same width / flap /
//     floor proportions), its front flap carrying the child's name.
//
// Same software renderer family as ModelViewer: drag to rotate, pinch /
// wheel to zoom, Depan / Samping / Belakang presets, auto-rotate.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  INK,
  elToPath,
  resolveColor,
  shade,
  toMonoFill,
  toMonoStroke,
  type Pt,
  type TemplateDef,
  type V3,
} from "../lib/model";
import { buildPillowNet, simplifyClosed } from "../lib/pillow";
import type { Stroke } from "./ColoringEditor";

interface Props {
  template: TemplateDef;
  colors: Record<string, string>;
  strokes: Stroke[];
  name: string;
  nameFontFamily: string;
  nameColor: string;
  height?: number;
  showControls?: boolean;
  autoRotate?: boolean;
  /** Yaw the reveal animation settles at (π = straight-on front view). */
  restYaw?: number;
  /** Change this value to replay the reveal animation. */
  revealKey?: number | string;
}

interface PillowGeometry {
  /** Outline polygons in model space (x negated for the viewer's yaw
   *  convention, so the front view is never mirrored), at z = 0. */
  polys: Pt[][];
  /** Matching outline polygons in raw SVG units (texture UV source). */
  uvPolys: Pt[][];
  /** Ear-clipped triangulation of each outline polygon (indices into
   *  that polygon's points) — covers any simple polygon exactly, so
   *  the artwork texture never leaves holes on concave silhouettes. */
  tris: { poly: number; a: number; b: number; c: number }[];
  panelW: number;
  panelH: number;
  thickness: number;
  centerY: number;
  standW: number;
  floorY: number;
  floorDepth: number;
  flapH: number;
  dominantRegion: string;
}

/** Simple ear-clipping triangulation; falls back to a centroid fan if
 *  the ring is degenerate. Indices refer to the input ring's points. */
function triangulate(poly: Pt[]): [number, number, number][] {
  const n = poly.length;
  if (n < 3) return [];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p = poly[i]!, q = poly[(i + 1) % n]!;
    area += p[0] * q[1] - q[0] * p[1];
  }
  const orient = area >= 0 ? 1 : -1;
  const cross = (a: Pt, b: Pt, c: Pt) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p: Pt, a: Pt, b: Pt, c: Pt) => {
    const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
    return orient > 0 ? d1 >= -1e-9 && d2 >= -1e-9 && d3 >= -1e-9
      : d1 <= 1e-9 && d2 <= 1e-9 && d3 <= 1e-9;
  };
  const idx = poly.map((_, i) => i);
  const tris: [number, number, number][] = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n * 4) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length]!;
      const ib = idx[i]!;
      const ic = idx[(i + 1) % idx.length]!;
      const a = poly[ia]!, b = poly[ib]!, c = poly[ic]!;
      if (cross(a, b, c) * orient <= 1e-12) continue; // reflex or flat
      let ear = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        if (inside(poly[j]!, a, b, c)) { ear = false; break; }
      }
      if (!ear) continue;
      tris.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) {
    tris.push([idx[0]!, idx[1]!, idx[2]!]);
    return tris;
  }
  // Fallback: centroid fan (centroid appended as a virtual point is
  // not available to the caller, so fan around point 0 instead).
  const fan: [number, number, number][] = [];
  for (let i = 1; i + 1 < n; i++) fan.push([0, i, i + 1]);
  return fan;
}

function buildGeometry(template: TemplateDef): PillowGeometry {
  const net = buildPillowNet(template);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of net.outlineSvg) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const panelH = 1.5;
  const scale = panelH / bh;
  const panelW = bw * scale;
  // Real plumpness: the net's gusset thickness over the printed panel
  // height, applied to the model panel — floored so the edge always
  // reads on screen, capped so it never looks inflated.
  const panelHmm = bh * net.art.s;
  const ratio = panelHmm > 0 ? net.thicknessMm / panelHmm : 0.1;
  const thickness = Math.max(0.13, Math.min(0.34, ratio * panelH));
  const floorY = -0.84;
  const centerY = floorY + panelH / 2;
  // Lightly simplify the traced outline for the 3D render only (the
  // printed dieline keeps the exact trace).
  const uvPolys = net.outlineSvg.map((p) => {
    const s = simplifyClosed(p, 1.8);
    return s.length >= 10 ? s : p;
  });
  const polys = uvPolys.map((poly) =>
    poly.map(([x, y]) => [-(x - cx) * scale, (cy - y) * scale] as Pt),
  );
  // Stand proportions from the printed net: width ≈ 72% of the panel,
  // floor 26 mm deep, flaps 14 mm tall (scaled by the same mm→model
  // factor as the panel height).
  const mmToModel = panelH / panelHmm;
  const tris: PillowGeometry["tris"] = [];
  uvPolys.forEach((poly, pi) => {
    for (const [a, b, c] of triangulate(poly)) tris.push({ poly: pi, a, b, c });
  });
  return {
    polys,
    uvPolys,
    tris,
    panelW,
    panelH,
    thickness,
    centerY,
    standW: panelW * 0.72,
    floorY,
    floorDepth: 26 * mmToModel,
    flapH: 14 * mmToModel,
    dominantRegion: net.dominantRegion,
  };
}

/** The front panel's artwork as a standalone SVG document — the same
 *  regions / strokes / details drawing the printed front panel uses. */
function artworkSvgString(
  template: TemplateDef,
  colors: Record<string, string>,
  strokes: Stroke[],
  texW: number,
  texH: number,
): string {
  const [vw, vh] = template.viewBox;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${texW}" height="${texH}">`,
  ];
  for (const r of template.regions) {
    const fill = resolveColor(template, colors, r.id);
    for (const el of r.els) {
      parts.push(
        `<path d="${elToPath(el)}" fill="${fill}" stroke="${INK}" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>`,
      );
    }
  }
  for (const s of strokes) {
    const d = s.points.map((p, j) => `${j === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    parts.push(
      `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  for (const d of template.details) {
    const fill = toMonoFill(d.fill) ?? "none";
    let stroke = toMonoStroke(d.stroke) ?? "none";
    if (fill === "#FFFFFF" && d.fill && d.fill !== "#FFFFFF" && stroke === "none") stroke = INK;
    parts.push(
      `<path d="${elToPath(d.el)}" fill="${fill}" stroke="${stroke}" stroke-width="${d.sw ?? 3}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

export function PillowViewer({
  template,
  colors,
  strokes,
  name,
  nameFontFamily,
  nameColor,
  height = 340,
  showControls = true,
  autoRotate = true,
  restYaw = Math.PI,
  revealKey = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const geo = useMemo(() => buildGeometry(template), [template]);
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const stateRef = useRef({
    yaw: restYaw - 2.2,
    pitch: 0.32,
    dist: 3.4,
    targetYaw: null as number | null,
    auto: autoRotate,
    dragging: false,
    revealStart: performance.now(),
    restYaw,
  });
  stateRef.current.restYaw = restYaw;
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d: number; dist: number } | null>(null);
  const [auto, setAuto] = useState(autoRotate);

  useEffect(() => {
    stateRef.current.revealStart = performance.now();
    stateRef.current.targetYaw = null;
  }, [revealKey, template.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g = geoRef.current;
    const dominant = resolveColor(template, colors, g.dominantRegion);

    // Rasterize the front-panel artwork once per artwork change; the
    // render loop picks it up as soon as it is ready.
    const [vw, vh] = template.viewBox;
    const K = 1000 / vw;
    const texCanvas = document.createElement("canvas");
    texCanvas.width = Math.max(2, Math.round(vw * K));
    texCanvas.height = Math.max(2, Math.round(vh * K));
    let texReady = false;
    const img = new Image();
    img.onload = () => {
      const tctx = texCanvas.getContext("2d");
      if (tctx) {
        tctx.drawImage(img, 0, 0, texCanvas.width, texCanvas.height);
        texReady = true;
      }
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(artworkSvgString(template, colors, strokes, texCanvas.width, texCanvas.height))}`;

    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = stateRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rt = Math.min(1, Math.max(0, (now - st.revealStart) / 950));
      const ease = 1 - Math.pow(1 - rt, 3);
      const pop = rt < 1 ? Math.max(0.2, 0.55 + 0.45 * ease + Math.sin(rt * Math.PI) * 0.05) : 1;
      if (rt < 1 && !st.dragging) st.yaw = st.restYaw - 2.2 + 2.2 * ease;
      else if (st.targetYaw != null) {
        let diff = st.targetYaw - st.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        st.yaw += diff * Math.min(1, dt * 7);
        if (Math.abs(diff) < 0.01) st.targetYaw = null;
      } else if (st.auto && !st.dragging) {
        st.yaw += dt * 0.55;
      }

      const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
      const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      const rot = ([x, y, z]: V3): V3 => {
        const y1 = y * cp - z * sp, z1 = y * sp + z * cp;
        return [x * cy + z1 * sy, y1, -x * sy + z1 * cy];
      };
      const cx = w / 2, cyy = h / 2 + 6;
      const focal = Math.min(w, h) * 1.05 * pop;
      const project = ([x, y, z]: V3): [number, number, number] => {
        const d = st.dist + z;
        const s = focal / Math.max(0.6, d);
        return [cx + x * s, cyy - y * s, z];
      };

      // Soft ground shadow.
      ctx.beginPath();
      ctx.ellipse(cx, cyy + focal * 0.34, Math.max(1, focal * 0.34), Math.max(1, focal * 0.075), 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(59,50,48,0.13)";
      ctx.fill();

      const light: V3 = [-0.45, 0.75, -0.55];
      const ll = Math.hypot(...light);
      const L: V3 = [light[0] / ll, light[1] / ll, light[2] / ll];
      const shadeFor = (pts: V3[], base: string): string => {
        const a = pts[0]!, b = pts[1]!, c = pts[2]!;
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const diffuse = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        return shade(base.startsWith("#") ? base : "#FFFFFF", 0.74 + 0.4 * diffuse);
      };
      const normalZ = (n: V3): number => rot(n)[2];

      /* Draw text riding on a model-space quad face, following the
         face's projected shape (same technique as ModelViewer's
         nameplate, so the text reads correctly from the viewing side). */
      const drawQuadText = (
        modelQuad: V3[],
        text: string,
        boxW: number,
        boxH: number,
        baseSize: number,
        upper: boolean,
      ) => {
        const q = modelQuad.map((p) => project(rot(p)));
        let tl = q[0]!, tr = q[0]!, bl = q[0]!;
        let minSum = Infinity, maxDiff = -Infinity, minDiff = Infinity;
        for (const p of q) {
          const sum = p[0] + p[1], diff = p[0] - p[1];
          if (sum < minSum) { minSum = sum; tl = p; }
          if (diff > maxDiff) { maxDiff = diff; tr = p; }
          if (diff < minDiff) { minDiff = diff; bl = p; }
        }
        const ax = (tr[0] - tl[0]) / boxW, ay = (tr[1] - tl[1]) / boxW;
        const bx = (bl[0] - tl[0]) / boxH, by = (bl[1] - tl[1]) / boxH;
        ctx.save();
        ctx.beginPath();
        q.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.clip();
        ctx.setTransform(dpr * ax, dpr * ay, dpr * bx, dpr * by, dpr * tl[0], dpr * tl[1]);
        ctx.fillStyle = nameColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = upper ? text.toUpperCase() : text;
        let size = baseSize;
        ctx.font = `700 ${size}px ${nameFontFamily}`;
        const tw = ctx.measureText(label).width;
        if (tw > boxW - 10) size = Math.max(8, (size * (boxW - 10)) / tw);
        ctx.font = `700 ${size}px ${nameFontFamily}`;
        ctx.fillText(label, boxW / 2, boxH / 2 + 1);
        ctx.restore();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      const t2 = g.thickness / 2;
      const main = g.polys[0] ?? [];
      const frontPts: V3[] = main.map(([x, y]) => [x, y + g.centerY, t2] as V3);
      const backPts: V3[] = main.map(([x, y]) => [x, y + g.centerY, -t2] as V3);
      const frontFacing = normalZ([0, 0, 1]) < 0;
      const backFacing = normalZ([0, 0, -1]) < 0;

      type Item = { z: number; draw: () => void };
      const items: Item[] = [];
      const avgZ = (pts: [number, number, number][]) => pts.reduce((a, p) => a + p[2], 0) / Math.max(1, pts.length);
      const solidItem = (modelPts: V3[], base: string, strokeIt = true) => {
        const rotated = modelPts.map(rot);
        const projected = rotated.map(project);
        items.push({
          z: avgZ(rotated),
          draw: () => {
            ctx.beginPath();
            projected.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
            ctx.closePath();
            ctx.fillStyle = shadeFor(rotated, base);
            ctx.fill();
            if (strokeIt) {
              ctx.strokeStyle = "rgba(59,50,48,0.45)";
              ctx.lineWidth = 1.1;
              ctx.stroke();
            }
          },
        });
      };

      /* ---- stand: U-channel (floor + back flap here; the front name
         flap is drawn with the front panel below, because it wraps the
         pillow's front-bottom edge and must paint over the artwork's
         lowest strip — a per-item painter sort gets that backwards
         under pitch) ---- */
      const hw = g.standW / 2, fd = g.floorDepth / 2, fy = g.floorY, fh = g.flapH;
      solidItem([[-hw, fy, -fd], [hw, fy, -fd], [hw, fy, fd], [-hw, fy, fd]], "#FFF6E0");
      solidItem([[-hw, fy, -fd], [-hw, fy + fh, -fd], [hw, fy + fh, -fd], [hw, fy, -fd]], "#FFF6E0");
      const flapModel: V3[] = [[-hw, fy, fd], [hw, fy, fd], [hw, fy + fh, fd], [-hw, fy + fh, fd]];

      /* ---- back panel base (dominant color; the artwork texture
         paints over it below whenever the back faces the viewer) ---- */
      {
        const rotated = backPts.map(rot);
        const projected = rotated.map(project);
        items.push({
          z: avgZ(rotated),
          draw: () => {
            ctx.beginPath();
            projected.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
            ctx.closePath();
            ctx.fillStyle = shadeFor(rotated, dominant);
            ctx.fill();
            ctx.strokeStyle = "rgba(59,50,48,0.45)";
            ctx.lineWidth = 1.1;
            ctx.stroke();
          },
        });
      }

      /* ---- gusset edge around the main outline ---- */
      for (let i = 0; i < main.length; i++) {
        const a = frontPts[i]!, b = frontPts[(i + 1) % main.length]!;
        const a2 = backPts[i]!, b2 = backPts[(i + 1) % main.length]!;
        solidItem([a, b, b2, a2], dominant, false);
      }

      /* ---- front panel: the artwork itself, texture-mapped ---- */
      if (frontFacing) {
        const frontRotated = frontPts.map(rot);
        const frontProjected = frontRotated.map(project);
        items.push({
          z: avgZ(frontRotated) - 0.001,
          draw: () => {
            const tracePath = (pts: [number, number, number][]) => {
              ctx.beginPath();
              pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
              ctx.closePath();
            };
            if (!texReady) {
              tracePath(frontProjected);
              ctx.fillStyle = "#FFFFFF";
              ctx.fill();
            } else {
              // Affine-map the artwork texture per ear-clipped triangle
              // of each outline polygon, clipped to that polygon's
              // projected silhouette so nothing spills outside it.
              const projByPoly = g.polys.map((mPoly, pi) => {
                const zOff = pi === 0 ? t2 : t2 + 0.006;
                return mPoly.map(([x, y]) => project(rot([x, y + g.centerY, zOff] as V3)));
              });
              for (const triIdx of g.tris) {
                const uvPoly = g.uvPolys[triIdx.poly]!;
                const proj = projByPoly[triIdx.poly]!;
                const tri: [number, number, number][] = [proj[triIdx.a]!, proj[triIdx.b]!, proj[triIdx.c]!];
                const uv: Pt[] = [uvPoly[triIdx.a]!, uvPoly[triIdx.b]!, uvPoly[triIdx.c]!];
                const [u0, v0] = [uv[0]![0] * K, uv[0]![1] * K];
                const [u1, v1] = [uv[1]![0] * K, uv[1]![1] * K];
                const [u2, v2] = [uv[2]![0] * K, uv[2]![1] * K];
                const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
                if (Math.abs(det) < 1e-9) continue;
                const [x0, y0] = [tri[0]![0], tri[0]![1]];
                const [x1, y1] = [tri[1]![0], tri[1]![1]];
                const [x2, y2] = [tri[2]![0], tri[2]![1]];
                const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det;
                const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det;
                const e = x0 - a * u0 - c * v0;
                const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det;
                const d = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det;
                const f = y0 - b * u0 - d * v0;
                ctx.save();
                tracePath(proj);
                ctx.clip();
                ctx.beginPath();
                tri.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
                ctx.closePath();
                ctx.clip();
                ctx.setTransform(dpr * a, dpr * b, dpr * c, dpr * d, dpr * e, dpr * f);
                ctx.drawImage(texCanvas, 0, 0);
                ctx.restore();
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              }
            }
            tracePath(frontProjected);
            ctx.strokeStyle = "rgba(59,50,48,0.55)";
            ctx.lineWidth = 1.2;
            ctx.stroke();
            // The stand's front name flap wraps the pillow's front
            // bottom edge, so it paints over the artwork's lowest
            // strip — draw it (and the name on it) as part of this
            // pass, after the texture.
            {
              const flapRotated = flapModel.map(rot);
              const flapProjected = flapRotated.map(project);
              ctx.beginPath();
              flapProjected.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
              ctx.closePath();
              ctx.fillStyle = shadeFor(flapRotated, "#FFC93C");
              ctx.fill();
              ctx.strokeStyle = "rgba(59,50,48,0.45)";
              ctx.lineWidth = 1.1;
              ctx.stroke();
              if (name.trim()) drawQuadText(flapModel, name.trim(), 220, 30, 25, true);
            }
          },
        });
      }

      /* ---- back panel: the same artwork, texture-mapped with the
         same UVs as the front (the assembled pillow's back reads
         correctly because the print mirror cancels in the flip-over
         during assembly) — no text on the back. ---- */
      if (backFacing) {
        const backRotated = backPts.map(rot);
        const backProjected = backRotated.map(project);
        items.push({
          z: avgZ(backRotated) - 0.001,
          draw: () => {
            const tracePath = (pts: [number, number, number][]) => {
              ctx.beginPath();
              pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
              ctx.closePath();
            };
            if (!texReady) {
              tracePath(backProjected);
              ctx.fillStyle = "#FFFFFF";
              ctx.fill();
            } else {
              // Same per-triangle affine mapping and same UVs as the
              // front panel: this panel is the assembled back, whose
              // printed mirror image reads correctly after the
              // flip-over at assembly time.
              const projByPoly = g.polys.map((mPoly, pi) => {
                const zOff = pi === 0 ? -t2 : -t2 - 0.006;
                return mPoly.map(([x, y]) => project(rot([x, y + g.centerY, zOff] as V3)));
              });
              for (const triIdx of g.tris) {
                const uvPoly = g.uvPolys[triIdx.poly]!;
                const proj = projByPoly[triIdx.poly]!;
                const tri: [number, number, number][] = [proj[triIdx.a]!, proj[triIdx.b]!, proj[triIdx.c]!];
                const uv: Pt[] = [uvPoly[triIdx.a]!, uvPoly[triIdx.b]!, uvPoly[triIdx.c]!];
                const [u0, v0] = [uv[0]![0] * K, uv[0]![1] * K];
                const [u1, v1] = [uv[1]![0] * K, uv[1]![1] * K];
                const [u2, v2] = [uv[2]![0] * K, uv[2]![1] * K];
                const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
                if (Math.abs(det) < 1e-9) continue;
                const [x0, y0] = [tri[0]![0], tri[0]![1]];
                const [x1, y1] = [tri[1]![0], tri[1]![1]];
                const [x2, y2] = [tri[2]![0], tri[2]![1]];
                const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det;
                const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det;
                const e = x0 - a * u0 - c * v0;
                const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det;
                const d = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det;
                const f = y0 - b * u0 - d * v0;
                ctx.save();
                tracePath(proj);
                ctx.clip();
                ctx.beginPath();
                tri.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
                ctx.closePath();
                ctx.clip();
                ctx.setTransform(dpr * a, dpr * b, dpr * c, dpr * d, dpr * e, dpr * f);
                ctx.drawImage(texCanvas, 0, 0);
                ctx.restore();
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              }
            }
            tracePath(backProjected);
            ctx.strokeStyle = "rgba(59,50,48,0.55)";
            ctx.lineWidth = 1.2;
            ctx.stroke();
          },
        });
      }

      items.sort((a, b) => b.z - a.z);
      for (const it of items) it.draw();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [template, colors, strokes, name, nameFontFamily, nameColor]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stateRef.current.dragging = true;
    stateRef.current.targetYaw = null;
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinchRef.current = {
        d: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        dist: stateRef.current.dist,
      };
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const st = stateRef.current;
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = [...pointersRef.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (d > 10) st.dist = Math.min(5.2, Math.max(2.2, pinchRef.current.dist * (pinchRef.current.d / d)));
    } else {
      st.yaw += dx * 0.012;
      st.pitch = Math.min(1.1, Math.max(-0.5, st.pitch + dy * 0.008));
    }
  };
  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) stateRef.current.dragging = false;
    pinchRef.current = null;
  };
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    st.dist = Math.min(5.2, Math.max(2.2, st.dist + e.deltaY * 0.002));
  };
  const goView = (yaw: number) => {
    stateRef.current.targetYaw = yaw;
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Model digital Bantal Kertas ${template.name}. Seret untuk memutar dan melihat ketebalannya.`}
        className="w-full touch-none select-none"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      />
      {showControls && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => goView(Math.PI)} className="rounded-full bg-[var(--surface)] px-4 py-1.5 font-display text-sm font-semibold text-[var(--text)] shadow-sm ring-1 ring-[var(--border)]">
            Depan
          </button>
          <button type="button" onClick={() => goView(Math.PI / 2)} className="rounded-full bg-[var(--surface)] px-4 py-1.5 font-display text-sm font-semibold text-[var(--text)] shadow-sm ring-1 ring-[var(--border)]">
            Samping
          </button>
          <button type="button" onClick={() => goView(0)} className="rounded-full bg-[var(--surface)] px-4 py-1.5 font-display text-sm font-semibold text-[var(--text)] shadow-sm ring-1 ring-[var(--border)]">
            Belakang
          </button>
          <button
            type="button"
            aria-pressed={auto}
            onClick={() => {
              const next = !auto;
              setAuto(next);
              stateRef.current.auto = next;
            }}
            className={`rounded-full px-4 py-1.5 font-display text-sm font-semibold shadow-sm ring-1 ring-[var(--border)] ${auto ? "bg-butter text-ink" : "bg-[var(--surface)] text-[var(--text)]"}`}
          >
            {auto ? "Berputar: Nyala" : "Berputar: Mati"}
          </button>
        </div>
      )}
    </div>
  );
}
