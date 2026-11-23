// Interactive 3D preview: a small flat-shaded software renderer on canvas.
//
// Every face of the model carries a coloring-region id, so the colors a
// child picks in the SVG editor appear on exactly the same body parts
// here. Supports drag-to-rotate, pinch / wheel zoom, auto-rotate, an
// introductory reveal spin, and front / side / back view presets. The
// personalized name is drawn onto the model's nameplate face so it
// rotates with the character.

import { useEffect, useRef, useState } from "react";
import { INK, shade, type Face, type TemplateDef, type V3 } from "../lib/model";

interface Props {
  template: TemplateDef;
  colors: Record<string, string>;
  name: string;
  nameFontFamily: string;
  nameColor: string;
  height?: number;
  showControls?: boolean;
  /** Start with auto-rotation on (default) or off. */
  autoRotate?: boolean;
  /** Yaw the reveal animation settles at (π = straight-on front view). */
  restYaw?: number;
  /** Change this value to replay the reveal animation. */
  revealKey?: number | string;
}

function faceColor(region: string, colors: Record<string, string>): string {
  if (region === "__ink") return INK;
  if (region === "__butter") return "#FFC93C";
  if (region === "plate") return "#FFF3D6";
  if (region === "__nameplate") return "#FFC93C";
  return colors[region] ?? "#FFFFFF";
}

export function ModelViewer({
  template,
  colors,
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
  const [edgesOn, setEdgesOn] = useState(true);
  const [exploded, setExploded] = useState(false);
  const viewRef = useRef({ edges: true, explodeTarget: 0, explodeCur: 0 });
  viewRef.current.edges = edgesOn;
  viewRef.current.explodeTarget = exploded ? 1 : 0;
  const facesRef = useRef<Face[]>([]);
  facesRef.current = template.buildModel();

  useEffect(() => {
    stateRef.current.revealStart = performance.now();
    stateRef.current.targetYaw = null;
  }, [revealKey, template.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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

      // Reveal animation: spin in + pop scale.
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
        // pitch around X, then yaw around Y
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

      // Exploded view: slide each component away from the model center
      // along its own centroid direction (same parts the net prints).
      const vw = viewRef.current;
      vw.explodeCur += (vw.explodeTarget - vw.explodeCur) * Math.min(1, dt * 5);
      if (Math.abs(vw.explodeTarget - vw.explodeCur) < 0.002) vw.explodeCur = vw.explodeTarget;
      const partCenter = new Map<string, V3>();
      const modelCenter: V3 = [0, 0, 0];
      {
        const sums = new Map<string, { s: V3; n: number }>();
        let nAll = 0;
        for (const face of facesRef.current) {
          const key = face.part ?? "__all";
          const c: V3 = [0, 0, 0];
          for (const p of face.pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
          c[0] /= face.pts.length; c[1] /= face.pts.length; c[2] /= face.pts.length;
          const e = sums.get(key) ?? { s: [0, 0, 0] as V3, n: 0 };
          e.s[0] += c[0]; e.s[1] += c[1]; e.s[2] += c[2]; e.n++;
          sums.set(key, e);
          modelCenter[0] += c[0]; modelCenter[1] += c[1]; modelCenter[2] += c[2];
          nAll++;
        }
        if (nAll) { modelCenter[0] /= nAll; modelCenter[1] /= nAll; modelCenter[2] /= nAll; }
        for (const [k, e] of sums) partCenter.set(k, [e.s[0] / e.n, e.s[1] / e.n, e.s[2] / e.n]);
      }
      const explodeOffset = (face: Face): V3 => {
        if (vw.explodeCur <= 0.001 || !face.part) return [0, 0, 0];
        const c = partCenter.get(face.part);
        if (!c) return [0, 0, 0];
        const k = vw.explodeCur * 0.55;
        return [
          (c[0] - modelCenter[0]) * k,
          (c[1] - modelCenter[1]) * k,
          (c[2] - modelCenter[2]) * k,
        ];
      };

      type DrawFace = { pts: [number, number][]; z: number; color: string; region: string; raw: [number, number, number][]; nz: number };
      const drawFaces: DrawFace[] = [];
      let plateFace: DrawFace | null = null;
      for (const face of facesRef.current) {
        const off = explodeOffset(face);
        const moved = off[0] || off[1] || off[2]
          ? face.pts.map((p) => [p[0] + off[0], p[1] + off[1], p[2] + off[2]] as V3)
          : face.pts;
        const rotated = moved.map(rot);
        const projected = rotated.map(project);
        const avgZ = rotated.reduce((a, p) => a + p[2], 0) / rotated.length;
        // Face normal (view space) for flat shading.
        const a = rotated[0]!, b = rotated[1]!, c = rotated[2]!;
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const diffuse = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        const base = faceColor(face.region, colors);
        const df: DrawFace = {
          pts: projected.map(([x, y]) => [x, y] as [number, number]),
          z: avgZ,
          color: shade(base.startsWith("#") ? base : "#FFFFFF", 0.74 + 0.4 * diffuse),
          region: face.region,
          raw: projected,
          nz,
        };
        drawFaces.push(df);
        if (face.region === "__nameplate") {
          if (!plateFace || df.z < plateFace.z) plateFace = df;
        }
      }
      // Painter's sort: farthest first.
      drawFaces.sort((a, b) => b.z - a.z);
      for (const df of drawFaces) {
        ctx.beginPath();
        df.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = df.color;
        ctx.fill();
        ctx.strokeStyle = vw.edges ? "rgba(59,50,48,0.5)" : "rgba(59,50,48,0.07)";
        ctx.lineWidth = vw.edges ? 1.2 : 1;
        ctx.stroke();
      }

      // Personalized name on the nameplate's front face, when it faces us.
      if (plateFace && plateFace.nz < -0.15 && name.trim()) {
        const q = plateFace.raw;
        // Identify screen corners geometrically: TL minimizes x+y,
        // BR maximizes x+y, TR maximizes x−y, BL minimizes x−y.
        let tl = q[0]!, tr = q[0]!, bl = q[0]!;
        let minSum = Infinity, maxDiff = -Infinity, minDiff = Infinity;
        for (const p of q) {
          const sum = p[0] + p[1], diff = p[0] - p[1];
          if (sum < minSum) { minSum = sum; tl = p; }
          if (diff > maxDiff) { maxDiff = diff; tr = p; }
          if (diff < minDiff) { minDiff = diff; bl = p; }
        }
        const W = 100, H = 30;
        const ax = (tr[0] - tl[0]) / W, ay = (tr[1] - tl[1]) / W;
        const bx = (bl[0] - tl[0]) / H, by = (bl[1] - tl[1]) / H;
        ctx.save();
        ctx.beginPath();
        plateFace.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.clip();
        ctx.setTransform(dpr * ax, dpr * ay, dpr * bx, dpr * by, dpr * tl[0], dpr * tl[1]);
        ctx.fillStyle = nameColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = name.trim().toUpperCase();
        let size = 21;
        ctx.font = `700 ${size}px ${nameFontFamily}`;
        const tw = ctx.measureText(label).width;
        if (tw > W - 8) size = Math.max(9, (size * (W - 8)) / tw);
        ctx.font = `700 ${size}px ${nameFontFamily}`;
        ctx.fillText(label, W / 2, H / 2 + 1);
        ctx.restore();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [template, colors, name, nameFontFamily, nameColor]);

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
        aria-label={`Pratinjau 3D ${template.name}. Seret untuk memutar.`}
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
          <button
            type="button"
            aria-pressed={edgesOn}
            onClick={() => setEdgesOn(!edgesOn)}
            className={`rounded-full px-4 py-1.5 font-display text-sm font-semibold shadow-sm ring-1 ring-[var(--border)] ${edgesOn ? "bg-butter text-ink" : "bg-[var(--surface)] text-[var(--text)]"}`}
          >
            {edgesOn ? "Tepi lipat: Nyala" : "Tepi lipat: Mati"}
          </button>
          <button
            type="button"
            aria-pressed={exploded}
            onClick={() => setExploded(!exploded)}
            className={`rounded-full px-4 py-1.5 font-display text-sm font-semibold shadow-sm ring-1 ring-[var(--border)] ${exploded ? "bg-butter text-ink" : "bg-[var(--surface)] text-[var(--text)]"}`}
          >
            {exploded ? "Tampilan meledak: Nyala" : "Tampilan meledak: Mati"}
          </button>
        </div>
      )}
    </div>
  );
}
