import { useT } from "../lib/i18n";
// The coloring studio: a structured SVG artwork whose regions fill with
// the shared color map, plus a freehand brush layer clipped to the
// artwork, undo/redo, zoom & pan, and the personalized name plaque.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { backgroundUrl } from "../../../server/src/backgrounds";
import { MIN_ART_ZOOM, clampArtPan, clampArtZoom, pointToArt, scribbleGoal, zoomArtAt } from "../lib/editor-touch";
import {
INK,
NAME_FONTS,
PASTEL,
UNCOLORED,
VIBRANT,
elToPath,
resolveColor,
toMonoFill,
toMonoStroke,
type TemplateDef,
} from "../lib/model";

export interface Stroke {
  color: string;
  size: number;
  points: [number, number][];
}

export function fitFontSize(text: string, w: number, h: number): number {
  if (!text) return h * 0.55;
  const widthUnits = [...text.toUpperCase()].reduce((width, glyph) =>
    width + (/\s/u.test(glyph) ? 0.4 : /[I1]/u.test(glyph) ? 0.55 : 1), 0);
  return Math.min(h * 0.56, Math.max(1, w - 16) / Math.max(1, widthUnits));
}

export function ArtworkSvg({
  template,
  colors,
  strokes,
  name,
  message,
  nameFont,
  nameColor,
  nameAlign = "center",
  svgRef,
  showLabel = true,
  backgroundId,
  landscape = false,
  onRegionTap,
  children,
}: {
  template: TemplateDef;
  colors: Record<string, string>;
  strokes: Stroke[];
  name: string;
  message?: string;
  nameFont: string;
  nameColor: string;
  nameAlign?: "left" | "center" | "right";
  svgRef?: React.RefObject<SVGSVGElement | null>;
  showLabel?: boolean;
  backgroundId?: string;
  landscape?: boolean;
  onRegionTap?: (regionId: string) => void;
  children?: React.ReactNode;
}) {
  const clipId = useId();
  const [vw, vh] = template.viewBox;
  const width = landscape ? 1200 : vw;
  const height = landscape ? 900 : vh;
  const scale = landscape ? Math.min(width * 0.76 / vw, height * 0.72 / vh) : 1;
  const offsetX = (width - vw * scale) / 2;
  const offsetY = landscape ? (height - vh * scale) / 2 + height * 0.06 : 0;
  const font = NAME_FONTS.find((f) => f.id === nameFont) ?? NAME_FONTS[0]!;
  const displayName = name.trim();
  const nameSize = fitFontSize(displayName, template.label.w, template.label.h);
  const nameX =
    nameAlign === "left"
      ? template.label.x + 8
      : nameAlign === "right"
        ? template.label.x + template.label.w - 8
        : template.label.x + template.label.w / 2;
  const nameAnchor = nameAlign === "left" ? "start" : nameAlign === "right" ? "end" : "middle";
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Halaman mewarnai ${template.name}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          {template.regions.map((r) =>
            r.els.map((el, i) => <path key={`${r.id}-${i}`} d={elToPath(el)} />),
          )}
        </clipPath>
      </defs>
      {backgroundUrl(backgroundId) && <image data-background="true" href={backgroundUrl(backgroundId)} x={0} y={0} width={width} height={height} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />}
      {landscape && <rect x={0} y={0} width={width} height={height} fill={backgroundId ? "none" : "#FFFFFF"} />}
      <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
      {/* Name plaque behind the artwork's label area */}
      {!landscape && showLabel && displayName && <rect
        x={template.label.x - 8}
        y={template.label.y - 4}
        width={template.label.w + 16}
        height={template.label.h + 8}
        rx={16}
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={3}
        strokeDasharray="1 7"
        strokeLinecap="round"
      />}
      {template.regions.map((r) => (
        <g key={r.id}>
          {r.els.map((el, i) => (
            <path
              key={i}
              d={elToPath(el)}
              fill={resolveColor(template, colors, r.id)}
              stroke={INK}
              strokeWidth={6.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              onPointerDown={
                onRegionTap
                  ? (e) => {
                      e.stopPropagation();
                      onRegionTap(r.id);
                    }
                  : undefined
              }
              style={onRegionTap ? { cursor: "pointer" } : undefined}
            />
          ))}
        </g>
      ))}
      {/* Freehand layer, clipped so crayons stay inside the lines */}
      <g clipPath={`url(#${clipId})`}>
        {strokes.map((s, i) => (
          <path
            key={i}
            d={s.points.map((p, j) => `${j === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={s.size}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
      {template.details.map((d, i) => {
        // Jaring pengaman hitam putih: detail bawaan apa pun dirender
        // hanya dalam hitam/putih/abu, tidak pernah sebagai warna contoh.
        const fill = toMonoFill(d.fill) ?? "none";
        let stroke = toMonoStroke(d.stroke) ?? "none";
        if (fill === "#FFFFFF" && d.fill && d.fill !== "#FFFFFF" && stroke === "none") {
          stroke = INK;
        }
        return (
          <path
            key={i}
            d={elToPath(d.el)}
            fill={fill}
            stroke={stroke}
            strokeWidth={d.sw ?? 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        );
      })}
      {showLabel && displayName && (
        <text
          x={nameX}
          y={
            template.label.y +
            template.label.h / 2 +
            nameSize * 0.36 -
            (message?.trim() ? nameSize * 0.34 : 0)
          }
          textAnchor={nameAnchor}
          fontFamily={font.family}
          fontWeight={700}
          fontSize={message?.trim() ? nameSize * 0.88 : nameSize}
          fill={nameColor}
          pointerEvents="none"
        >
          {displayName.toUpperCase()}
        </text>
      )}
      {showLabel && message?.trim() && (
        <text
          x={nameX}
          y={template.label.y + template.label.h - 5}
          textAnchor={nameAnchor}
          fontFamily="'Nunito', sans-serif"
          fontWeight={700}
          fontSize={Math.min(template.label.h * 0.26, fitFontSize(message.trim(), template.label.w, template.label.h))}
          fill="#6F6157"
          pointerEvents="none"
        >
          {message.trim()}
        </text>
      )}
      {children}
      </g>
    </svg>
  );
}

/* ------------------------------ Editor ------------------------------ */

type Tool = "scribble" | "brush" | "eraser" | "move";

interface Snapshot {
  colors: Record<string, string>;
  strokes: Stroke[];
}

/* -------- Scribble-to-Fill difficulty (brief Part 1.2) -------- */
// Coverage thresholds and crayon widths per age group. The brief's
// three groups map onto the catalog's age bands: Little Explorer covers
// 9–24 months, Curious Creator 2–3 years, Young Artist 4–5 years.
export function scribbleParams(ageBand: string): { threshold: number; radius: number; group: string } {
  if (ageBand === "9-18bln") return { threshold: 0.16, radius: 32, group: "Little Explorer" };
  if (ageBand === "1-2th") return { threshold: 0.21, radius: 28, group: "Little Explorer" };
  if (ageBand === "2-3th") return { threshold: 0.27, radius: 24, group: "Curious Creator" };
  if (ageBand === "3-4th") return { threshold: 0.33, radius: 20, group: "Curious Creator" };
  return { threshold: 0.4, radius: 17, group: "Young Artist" };
}

/* -------- Crayon sound (brief Part 1.3) -------- */
// A soft filtered-noise loop whose volume follows finger speed. It is
// created lazily inside a pointer gesture (mobile audio rules), never
// overlaps itself (one loop, gain-driven), and stops when movement
// stops. The on/off preference persists in localStorage.
const SOUND_KEY = "bfk-crayon-sound";

export function loadSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveSoundPref(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    // Private mode etc. — the toggle still works for this session.
  }
}

class CrayonNoise {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private ensure(): boolean {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      const len = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.03 * white) / 1.03;
        data[i] = last * 3.4;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 850;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      this.ctx = ctx;
      this.gain = gain;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  /** intensity 0..1 from pointer speed. */
  stroke(intensity: number) {
    if (!this.ensure() || !this.ctx || !this.gain) return;
    const target = Math.min(0.13, 0.025 + intensity * 0.105);
    this.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.quiet(), 110);
  }

  quiet() {
    if (this.ctx && this.gain) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  stop() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.quiet();
  }
}

const crayonNoise = new CrayonNoise();

/* -------- Region geometry for coverage measurement -------- */
// Per-region sample grids, tested against the real SVG paths with
// isPointInPath: coverage is the share of a region's own sample points
// the child's crayon has actually passed over — a single tap covers
// almost nothing, and a stationary press never grows.
interface RegionGeom {
  paths: Path2D[];
  samples: [number, number][];
  /** Original 11-unit sampling density gives a size estimate for tiny parts. */
  coarseCount: number;
}

function buildRegionGeom(template: TemplateDef): { map: Map<string, RegionGeom>; ctx: CanvasRenderingContext2D | null } {
  const map = new Map<string, RegionGeom>();
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g) return { map, ctx: null };
  const [vw, vh] = template.viewBox;
  for (const r of template.regions) {
    const paths = r.els.map((el) => new Path2D(elToPath(el)));
    const sampleGrid = (spacing: number): [number, number][] => {
      const points: [number, number][] = [];
      for (let x = spacing / 2; x < vw; x += spacing) {
        for (let y = spacing / 2; y < vh; y += spacing) {
          if (paths.some((p) => g.isPointInPath(p, x, y))) points.push([x, y]);
        }
      }
      return points;
    };
    // Tiny features can have zero hits on the coarse grid. Refine those
    // grids so the coverage test remains usable even for eyes, feet and spikes.
    const coarse = sampleGrid(11);
    const samples = coarse.length < 90 ? sampleGrid(5) : coarse;
    map.set(r.id, { paths, samples, coarseCount: coarse.length });
  }
  return { map, ctx: g };
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

interface ScribbleState {
  regionId: string;
  points: [number, number][];
  covered: Set<number>;
  goal: ReturnType<typeof scribbleGoal>;
  length: number;
  lastT: number;
  lastX: number;
  lastY: number;
}

export function ColoringEditor({
  template,
  colors,
  strokes,
  name,
  message,
  nameFont,
  nameColor,
  nameAlign = "center",
  onChange,
}: {
  template: TemplateDef;
  colors: Record<string, string>;
  strokes: Stroke[];
  name: string;
  message: string;
  nameFont: string;
  nameColor: string;
  nameAlign?: "left" | "center" | "right";
  onChange: (colors: Record<string, string>, strokes: Stroke[]) => void;
}) {
  const tr = useT();
  const [tool, setTool] = useState<Tool>("scribble");
  const [palette, setPalette] = useState<"vibrant" | "pastel">("vibrant");
  const [color, setColor] = useState("#3E92CC");
  const [brushSize, setBrushSize] = useState(14);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Update this synchronously in pointer/wheel events to avoid stale values
  // during rapid pinching and trackpad wheel bursts.
  const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const [confirmReset, setConfirmReset] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(loadSoundPref);
  const [liveScribble, setLiveScribble] = useState<{ regionId: string; points: [number, number][] } | null>(null);
  const [coveragePct, setCoveragePct] = useState(0);
  const [scribbleHint, setScribbleHint] = useState("");
  const undoRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const [, forceTick] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const scribbleRef = useRef<ScribbleState | null>(null);
  const panningRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d: number; zoom: number; anchor: { x: number; y: number } } | null>(null);
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);

  const params = scribbleParams(template.ageBand);
  const geom = useMemo(() => buildRegionGeom(template), [template]);

  const pushHistory = useCallback(() => {
    undoRef.current = [...undoRef.current.slice(-40), { colors, strokes }];
    redoRef.current = [];
    forceTick((n) => n + 1);
  }, [colors, strokes]);

  const undo = () => {
    const prev = undoRef.current[undoRef.current.length - 1];
    if (!prev) return;
    undoRef.current = undoRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, { colors, strokes }];
    onChange(prev.colors, prev.strokes);
    forceTick((n) => n + 1);
  };
  const redo = () => {
    const next = redoRef.current[redoRef.current.length - 1];
    if (!next) return;
    redoRef.current = redoRef.current.slice(0, -1);
    undoRef.current = [...undoRef.current, { colors, strokes }];
    onChange(next.colors, next.strokes);
    forceTick((n) => n + 1);
  };

  const applyView = useCallback((next: { zoom: number; pan: { x: number; y: number } }) => {
    viewRef.current = next;
    setZoom(next.zoom);
    setPan(next.pan);
  }, []);

  const zoomAt = (nextZoom: number, clientX?: number, clientY?: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = zoomArtAt(viewRef.current, nextZoom,
      clientX ?? rect.left + rect.width / 2,
      clientY ?? rect.top + rect.height / 2, rect, template.viewBox);
    applyView(next);
  };

  // React's onWheel may be treated as passive by the browser; a native,
  // non-passive handler is needed to prevent the document from scrolling.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 350 : 1);
      const nextZoom = viewRef.current.zoom * Math.exp(-delta * 0.0015);
      const rect = el.getBoundingClientRect();
      applyView(zoomArtAt(viewRef.current, nextZoom,
        event.clientX, event.clientY, rect, template.viewBox));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [applyView, template.viewBox]);

  const toSvgCoords = (clientX: number, clientY: number): [number, number] => {
    const el = wrapRef.current;
    if (!el) return [0, 0];
    const p = pointToArt(clientX, clientY, el.getBoundingClientRect(),
      viewRef.current, template.viewBox);
    return [p.x, p.y];
  };

  const handleRegionTap = (regionId: string) => {
    if (tool === "eraser") {
      pushHistory();
      onChange({ ...colors, [regionId]: UNCOLORED }, strokes);
    }
  };

  /* ------------------------- Scribble-to-Fill ------------------------- */

  const hitRegion = (x: number, y: number, touch = false): string | null => {
    if (!geom.ctx) return null;
    // SVG regions are painted in this order: later ones are visually on top.
    // Hit-test in reverse so small details don't select the body behind them.
    const frontToBack = [...template.regions].reverse();
    const exact = frontToBack.find((r) =>
      geom.map.get(r.id)?.paths.some((path) => geom.ctx!.isPointInPath(path, x, y)));
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !touch) return exact?.id ?? null;
    const tolerance = Math.min(34, (params.radius * 0.5 + 4) * (template.viewBox[0] / Math.max(1, rect.width)) / viewRef.current.zoom);
    let nearest: { id: string; distance: number } | null = null;
    // A finger covers more than a mouse pointer. Nearby tiny parts get a
    // forgiving touch target without painting other large regions at random.
    for (const r of frontToBack) {
      const g = geom.map.get(r.id);
      if (!g || g.coarseCount >= 90) continue;
      for (const [sx, sy] of g.samples) {
        const d = Math.hypot(sx - x, sy - y);
        if (d <= tolerance && (!nearest || d < nearest.distance)) {
          nearest = { id: r.id, distance: d };
        }
      }
    }
    if (!exact) return nearest?.id ?? null;
    const exactGeom = geom.map.get(exact.id);
    if (exactGeom && exactGeom.coarseCount < 90) return exact.id;
    return nearest && nearest.distance <= tolerance * 0.58 ? nearest.id : exact.id;
  };

  const startScribble = (clientX: number, clientY: number, touch: boolean) => {
    const [x, y] = toSvgCoords(clientX, clientY);
    const regionId = hitRegion(x, y, touch);
    if (!regionId) return;
    const g = geom.map.get(regionId);
    const goal = scribbleGoal(params.threshold, g?.coarseCount ?? 0);
    scribbleRef.current = {
      regionId,
      points: [[x, y]],
      covered: new Set<number>(),
      goal,
      length: 0,
      lastT: performance.now(),
      lastX: clientX,
      lastY: clientY,
    };
    setLiveScribble({ regionId, points: [[x, y]] });
    setCoveragePct(0);
    setScribbleHint(goal.small ? "Detail kecil — cukup gosok sebentar!" : "");
  };

  const moveScribble = (clientX: number, clientY: number) => {
    const s = scribbleRef.current;
    if (!s) return;
    const [x, y] = toSvgCoords(clientX, clientY);
    const last = s.points[s.points.length - 1]!;
    const d = Math.hypot(x - last[0], y - last[1]);
    if (d < (s.goal.small ? 0.7 : 2.5)) return;
    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
    const speed = Math.hypot(clientX - s.lastX, clientY - s.lastY) / dt; // px per ms
    if (soundOn) crayonNoise.stroke(Math.min(1, speed / 1.6));
    s.lastT = now;
    s.lastX = clientX;
    s.lastY = clientY;
    s.length += d;
    // Bound the transient SVG path on long scribbles. Coverage is retained.
    s.points = [...s.points.slice(-179), [x, y]];
    const g = geom.map.get(s.regionId);
    if (g) {
      for (let i = 0; i < g.samples.length; i++) {
        if (s.covered.has(i)) continue;
        const [sx, sy] = g.samples[i]!;
        if (distToSegment(sx, sy, last[0], last[1], x, y) <= params.radius) s.covered.add(i);
      }
      setCoveragePct(g.samples.length ? Math.round((s.covered.size / g.samples.length) * 100) : 100);
    }
    setLiveScribble({ regionId: s.regionId, points: s.points });
  };

  const endScribble = () => {
    const s = scribbleRef.current;
    scribbleRef.current = null;
    setLiveScribble(null);
    setCoveragePct(0);
    crayonNoise.stop();
    if (!s) return;
    const g = geom.map.get(s.regionId);
    // The fallback only applies after a real dragging gesture that
    // actually began inside an extremely thin fillable SVG region.
    const coverage = g && g.samples.length ? s.covered.size / g.samples.length : g ? 1 : 0;
    // A tap (almost no travel) or a stationary press can never complete
    // a region: both the travel distance and the covered share must
    // pass their marks.
    if (s.length >= s.goal.minDistance && coverage >= s.goal.threshold) {
      pushHistory();
      onChange({ ...colors, [s.regionId]: color }, strokes);
      setScribbleHint("");
    } else if (s.points.length > 1) {
      setScribbleHint(s.goal.small
        ? "Sedikit lagi! Coret pendek pada detail kecil ini."
        : "Hampir! Gosok bidangnya lebih banyak lagi sampai penuh ya.");
    }
  };

  /* --------------------------- Pointer flow --------------------------- */

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") e.preventDefault();
    // Keep events arriving after the finger leaves the visible border.
    // This stops incomplete strokes and accidental page gestures.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* already captured */ }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const el = wrapRef.current;
      const anchor = el
        ? pointToArt(mx, my, el.getBoundingClientRect(), viewRef.current, template.viewBox)
        : { x: template.viewBox[0] / 2, y: template.viewBox[1] / 2 };
      pinchRef.current = { d: Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y)), zoom: viewRef.current.zoom, anchor };
      panningRef.current = null;
      drawingRef.current = null;
      setLiveStroke(null);
      scribbleRef.current = null;
      setLiveScribble(null);
      setCoveragePct(0);
      crayonNoise.stop();
      return;
    }
    if (pointersRef.current.size !== 1) return;
    if (tool === "move") {
      panningRef.current = { x: e.clientX, y: e.clientY, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y };
      return;
    }
    if (tool === "scribble") {
      startScribble(e.clientX, e.clientY, e.pointerType === "touch");
    } else if (tool === "brush") {
      const s: Stroke = { color, size: brushSize, points: [toSvgCoords(e.clientX, e.clientY)] };
      drawingRef.current = s;
      setLiveStroke(s);
    } else if (tool === "eraser") {
      eraseAt(e.clientX, e.clientY, true);
    }
  };

  const eraseAt = (clientX: number, clientY: number, startNew: boolean) => {
    const [x, y] = toSvgCoords(clientX, clientY);
    const radius = brushSize * 0.9;
    const kept = strokes.filter(
      (s) => !s.points.some(([px, py]) => Math.hypot(px - x, py - y) < radius + s.size / 2),
    );
    if (kept.length !== strokes.length) {
      if (startNew) pushHistory();
      onChange(colors, kept);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = [...pointersRef.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const el = wrapRef.current;
      if (el && d > 10) {
        const rect = el.getBoundingClientRect();
        const [vw, vh] = template.viewBox;
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const sx = ((mx - rect.left) / Math.max(rect.width, 1)) * vw;
        const sy = ((my - rect.top) / Math.max(rect.height, 1)) * vh;
        const nextZoom = clampArtZoom(pinchRef.current.zoom * d / pinchRef.current.d);
        const anchor = pinchRef.current.anchor;
        applyView({
          zoom: nextZoom,
          pan: clampArtPan({
            x: sx - vw / 2 - (anchor.x - vw / 2) * nextZoom,
            y: sy - vh / 2 - (anchor.y - vh / 2) * nextZoom,
          }, nextZoom, template.viewBox),
        });
      }
      return;
    }
    if (panningRef.current) {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const [vw, vh] = template.viewBox;
      const nextZoom = viewRef.current.zoom;
      applyView({
        zoom: nextZoom,
        pan: clampArtPan({
          x: panningRef.current.panX + ((e.clientX - panningRef.current.x) / Math.max(rect.width, 1)) * vw,
          y: panningRef.current.panY + ((e.clientY - panningRef.current.y) / Math.max(rect.height, 1)) * vh,
        }, nextZoom, template.viewBox),
      });
      return;
    }
    if (scribbleRef.current) {
      moveScribble(e.clientX, e.clientY);
      return;
    }
    if (drawingRef.current) {
      const p = toSvgCoords(e.clientX, e.clientY);
      const lastPt = drawingRef.current.points[drawingRef.current.points.length - 1]!;
      if (drawingRef.current.points.length < 4000 && Math.hypot(p[0] - lastPt[0], p[1] - lastPt[1]) > 2) {
        drawingRef.current = {
          ...drawingRef.current,
          points: [...drawingRef.current.points, p],
        };
        setLiveStroke(drawingRef.current);
        if (soundOn) crayonNoise.stroke(0.4);
      }
    } else if (tool === "eraser" && e.buttons > 0) {
      eraseAt(e.clientX, e.clientY, false);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const wasPinching = pinchRef.current !== null;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    panningRef.current = null;
    if (wasPinching || (e.type === "pointercancel" || e.type === "lostpointercapture")) {
      scribbleRef.current = null;
      setLiveScribble(null);
      drawingRef.current = null;
      setLiveStroke(null);
      setCoveragePct(0);
      crayonNoise.stop();
      return;
    }
    if (scribbleRef.current) endScribble();
    if (drawingRef.current) {
      pushHistory();
      onChange(colors, [...strokes, drawingRef.current]);
      drawingRef.current = null;
      setLiveStroke(null);
      crayonNoise.stop();
    }
  };

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 3500);
    return () => clearTimeout(t);
  }, [confirmReset]);

  useEffect(() => {
    if (!scribbleHint) return;
    const t = setTimeout(() => setScribbleHint(""), 3200);
    return () => clearTimeout(t);
  }, [scribbleHint]);

  useEffect(() => () => crayonNoise.stop(), []);

  const paletteColors = palette === "vibrant" ? VIBRANT : PASTEL;
  const toolBtn = (t: Tool, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={tool === t}
      onClick={() => setTool(t)}
      className={`flex min-h-12 min-w-[72px] shrink-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 font-display text-xs font-bold ${
        tool === t ? "bg-sky-deep text-white shadow" : "bg-[var(--surface)] text-[var(--text)] ring-1 ring-[var(--border)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const activeRegion = liveScribble ? template.regions.find((r) => r.id === liveScribble.regionId) : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_64px] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_116px] sm:gap-3">
      <div className="min-w-0">
      <div
        ref={wrapRef}
        className="relative w-full select-none touch-none overflow-hidden rounded-3xl bg-white shadow-inner ring-1 ring-[var(--border)]"
        style={{ aspectRatio: `${template.viewBox[0]} / ${template.viewBox[1]}`, overscrollBehavior: "contain", contain: "layout paint" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
      >
        <div
          className="absolute inset-0 h-full w-full will-change-transform"
          style={{
            transform: `translate3d(${pan.x / (template.viewBox[0] / 100)}%, ${pan.y / (template.viewBox[1] / 100)}%, 0) scale(${zoom})`,
            transformOrigin: "50% 50%",
          }}
        >
          <ArtworkSvg
            template={template}
            colors={colors}
            strokes={liveStroke ? [...strokes, liveStroke] : strokes}
            name={name}
            message={message}
            nameFont={nameFont}
            nameColor={nameColor}
            nameAlign={nameAlign}
            onRegionTap={tool === "eraser" ? handleRegionTap : undefined}
          >
            {liveScribble && activeRegion && (
              <g>
                <defs>
                  <clipPath id="clip-scribble-active">
                    {activeRegion.els.map((el, i) => (
                      <path key={i} d={elToPath(el)} />
                    ))}
                  </clipPath>
                </defs>
                <g clipPath="url(#clip-scribble-active)">
                  <path
                    d={liveScribble.points.map((p, j) => `${j === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={color}
                    strokeWidth={params.radius * 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.55}
                  />
                </g>
              </g>
            )}
          </ArtworkSvg>
        </div>
        {zoom !== 1 && (
          <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-bold text-white">
            {Math.round(zoom * 100)}%
          </span>
        )}
        {liveScribble && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-bold text-white" role="status">
            Terisi {coveragePct}%
          </span>
        )}
      </div>

      <p className="mt-2 min-h-10 text-center font-display text-sm font-bold text-olive-deep sm:min-h-5" role="status">
        {scribbleHint}
      </p>
      <p className="mt-2 text-center text-xs font-semibold leading-relaxed text-[var(--dim)]">
        Zoom hanya pada gambar: cubit dua jari atau gunakan +/−, lalu pilih Geser untuk memindahkan gambar.
        Detail kecil cukup digosok pendek sampai terisi.
      </p>

      {/* Tools */}
      <div className="mt-3 flex items-stretch gap-2 overflow-x-auto overscroll-x-contain pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible">
        {toolBtn("scribble", tr("Coret & Isi"), (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 17 C6 10 9 20 12 12 C14 7 17 15 21 8" /><path d="M4 21 H20" /></svg>
        ))}
        {toolBtn("brush", tr("Kuas"), (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20 C4 16 6 14 9 13 L20 2 L22 4 L11 15 C10 18 8 20 4 20 Z" /></svg>
        ))}
        {toolBtn("eraser", tr("Penghapus"), (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M7 15 L16 6 L20 10 L13 17 H9 L5 13 Z" /><path d="M9 21 H21" /></svg>
        ))}
        {toolBtn("move", tr("Geser"), (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3 V21 M3 12 H21 M12 3 L9 6 M12 3 L15 6 M12 21 L9 18 M12 21 L15 18 M3 12 L6 9 M3 12 L6 15 M21 12 L18 9 M21 12 L18 15" /></svg>
        ))}
        <button
          type="button"
          aria-pressed={soundOn}
          aria-label={soundOn ? tr("Matikan suara krayon") : tr("Nyalakan suara krayon")}
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            saveSoundPref(next);
            if (!next) crayonNoise.stop();
          }}
          className={`flex min-h-12 min-w-[72px] shrink-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 font-display text-xs font-bold ${
            soundOn ? "bg-[var(--surface)] text-[var(--text)] ring-1 ring-[var(--border)]" : "bg-[var(--surface)] text-[var(--dim)] ring-1 ring-[var(--border)]"
          }`}
        >
          {soundOn ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9 H3 v6 h3 l5 4 Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18 6a8.5 8.5 0 0 1 0 12" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9 H3 v6 h3 l5 4 Z" /><path d="m16 9 6 6 M22 9 l-6 6" /></svg>
          )}
          {soundOn ? tr("Suara Nyala") : tr("Suara Mati")}
        </button>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={tr("Urungkan")} disabled={undoRef.current.length === 0} onClick={undo} className="rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)] disabled:opacity-40">
            {tr("↩ Urungkan")}
          </button>
          <button type="button" aria-label={tr("Ulangi")} disabled={redoRef.current.length === 0} onClick={redo} className="rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)] disabled:opacity-40">
            Ulangi ↪
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={tr("Zoom kanvas")}>
          <button type="button" aria-label={tr("Perkecil gambar")} disabled={zoom <= MIN_ART_ZOOM}
            onClick={() => zoomAt(zoom - 0.25)}
            className="min-h-11 min-w-11 touch-manipulation rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-lg font-bold ring-1 ring-[var(--border)] disabled:opacity-40">−</button>
          <span className="min-w-12 text-center font-display text-xs font-bold text-[var(--dim)]" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label={tr("Perbesar gambar")} disabled={zoom >= 4}
            onClick={() => zoomAt(zoom + 0.25)}
            className="min-h-11 min-w-11 touch-manipulation rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-lg font-bold ring-1 ring-[var(--border)] disabled:opacity-40">+</button>
          <button type="button" aria-label={tr("Tampilkan keseluruhan gambar")}
            onClick={() => applyView({ zoom: 1, pan: { x: 0, y: 0 } })}
            className="min-h-11 touch-manipulation rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]">
            Paskan
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            pushHistory();
            onChange({}, []);
            setConfirmReset(false);
          }}
          className={`rounded-2xl px-3 py-2 font-display text-sm font-bold ring-1 ${confirmReset ? "bg-berry text-white ring-berry" : "bg-[var(--surface)] ring-[var(--border)]"}`}
        >
          {confirmReset ? tr("Ketuk lagi untuk menghapus semua") : tr("Mulai ulang")}
        </button>
      </div>

      {/* Brush size */}
      {(tool === "brush" || tool === "eraser") && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <label htmlFor="brush-size" className="font-display text-sm font-bold">
            {tool === "brush" ? tr("Ukuran krayon") : tr("Ukuran penghapus")}
          </label>
          <input
            id="brush-size"
            type="range"
            min={4}
            max={36}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-44 accent-[#F08A4B]"
          />
          <span
            className="inline-block rounded-full ring-1 ring-[var(--border)]"
            style={{ width: brushSize, height: brushSize, background: tool === "brush" ? color : "#fff" }}
          />
        </div>
      )}


      </div>
      {/* Palettes */}
      <aside className="min-w-0 rounded-2xl bg-[var(--surface)] p-1.5 sm:p-2" aria-label={tr("Pilihan warna")}>
        <div className="mb-2 flex flex-col gap-1" role="tablist" aria-label={tr("Palet warna")}>
          <button
            type="button"
            role="tab"
            aria-selected={palette === "vibrant"}
            onClick={() => setPalette("vibrant")}
            className={`rounded-xl px-1 py-2 font-display text-[10px] sm:text-xs font-bold ${palette === "vibrant" ? "bg-tang-deep text-ink" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
          >
            {tr("Krayon cerah")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={palette === "pastel"}
            onClick={() => setPalette("pastel")}
            className={`rounded-xl px-1 py-2 font-display text-[10px] sm:text-xs font-bold ${palette === "pastel" ? "bg-tang-deep text-ink" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
          >
            {tr("Pastel lembut")}
          </button>
        </div>
        <div className="grid grid-cols-1 justify-items-center gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tr("Warna krayon")}>
          {paletteColors.map((c) => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={color === c.hex}
              aria-label={c.name}
              title={c.name}
              onClick={() => {
                setColor(c.hex);
                if (tool === "eraser" || tool === "move") setTool("scribble");
              }}
              className={`h-10 w-10 rounded-full sm:h-11 sm:w-11 shadow-sm transition-transform ${color === c.hex ? "scale-110 ring-4 ring-ink/70" : "ring-1 ring-black/15"}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
        <p className="mt-2 hidden text-center text-[11px] font-semibold text-[var(--dim)] sm:block">
          {tool === "scribble" && `Gosok bidang gambar sampai cukup terisi — untuk detail kecil lebih mudah dengan gosokan pendek. Kelompok ${params.group} menggunakan target dasar sekitar ${Math.round(params.threshold * 100)}% untuk bidang besar.`}
          {tool === "brush" && "Gambar dengan jarimu — krayon tetap di dalam garis."}
          {tool === "eraser" && "Ketuk bagian untuk membersihkannya, atau gosok garis krayon untuk menghapusnya."}
          {tool === "move" && "Seret untuk menggerakkan gambar."}
        </p>
      </aside>
    </div>
  );
}
