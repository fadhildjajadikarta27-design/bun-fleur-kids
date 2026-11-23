// The coloring studio: a structured SVG artwork whose regions fill with
// the shared color map, plus a freehand brush layer clipped to the
// artwork, undo/redo, zoom & pan, and the personalized name plaque.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const byWidth = (w / Math.max(1, text.length)) * 1.55;
  return Math.max(9, Math.min(h * 0.56, byWidth));
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
  onRegionTap?: (regionId: string) => void;
  children?: React.ReactNode;
}) {
  const [vw, vh] = template.viewBox;
  const font = NAME_FONTS.find((f) => f.id === nameFont) ?? NAME_FONTS[0]!;
  const displayName = name.trim();
  const nameSize = fitFontSize(displayName || "★", template.label.w, template.label.h);
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
      viewBox={`0 0 ${vw} ${vh}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Halaman mewarnai ${template.name}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={`clip-${template.id}`}>
          {template.regions.map((r) =>
            r.els.map((el, i) => <path key={`${r.id}-${i}`} d={elToPath(el)} />),
          )}
        </clipPath>
      </defs>
      {/* Name plaque behind the artwork's label area */}
      <rect
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
      />
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
      <g clipPath={`url(#clip-${template.id})`}>
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
      {displayName && (
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
      {displayName && message?.trim() && (
        <text
          x={nameX}
          y={template.label.y + template.label.h - 5}
          textAnchor={nameAnchor}
          fontFamily="'Nunito', sans-serif"
          fontWeight={700}
          fontSize={Math.max(9, template.label.h * 0.26)}
          fill="#6F6157"
          pointerEvents="none"
        >
          {message.trim()}
        </text>
      )}
      {children}
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
  if (ageBand === "9-18bln" || ageBand === "1-2th") {
    return { threshold: 0.18, radius: 30, group: "Little Explorer" };
  }
  if (ageBand === "2-3th") {
    return { threshold: 0.28, radius: 22, group: "Curious Creator" };
  }
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
}

function buildRegionGeom(template: TemplateDef): { map: Map<string, RegionGeom>; ctx: CanvasRenderingContext2D | null } {
  const map = new Map<string, RegionGeom>();
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g) return { map, ctx: null };
  const [vw, vh] = template.viewBox;
  const spacing = 11;
  for (const r of template.regions) {
    const paths = r.els.map((el) => new Path2D(elToPath(el)));
    const samples: [number, number][] = [];
    for (let x = spacing / 2; x < vw; x += spacing) {
      for (let y = spacing / 2; y < vh; y += spacing) {
        if (paths.some((p) => g.isPointInPath(p, x, y))) samples.push([x, y]);
      }
    }
    map.set(r.id, { paths, samples });
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
  const [tool, setTool] = useState<Tool>("scribble");
  const [palette, setPalette] = useState<"vibrant" | "pastel">("vibrant");
  const [color, setColor] = useState("#3E92CC");
  const [brushSize, setBrushSize] = useState(14);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
  const pinchRef = useRef<{ d: number; zoom: number } | null>(null);
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

  const toSvgCoords = (clientX: number, clientY: number): [number, number] => {
    const el = wrapRef.current;
    if (!el) return [0, 0];
    const rect = el.getBoundingClientRect();
    const [vw, vh] = template.viewBox;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return [(px * vw - pan.x) / zoom, (py * vh - pan.y) / zoom];
  };

  const handleRegionTap = (regionId: string) => {
    if (tool === "eraser") {
      pushHistory();
      onChange({ ...colors, [regionId]: UNCOLORED }, strokes);
    }
  };

  /* ------------------------- Scribble-to-Fill ------------------------- */

  const hitRegion = (x: number, y: number): string | null => {
    if (!geom.ctx) return null;
    for (const r of template.regions) {
      const g = geom.map.get(r.id);
      if (g && g.paths.some((p) => geom.ctx!.isPointInPath(p, x, y))) return r.id;
    }
    return null;
  };

  const startScribble = (clientX: number, clientY: number) => {
    const [x, y] = toSvgCoords(clientX, clientY);
    const regionId = hitRegion(x, y);
    if (!regionId) return;
    scribbleRef.current = {
      regionId,
      points: [[x, y]],
      covered: new Set<number>(),
      length: 0,
      lastT: performance.now(),
      lastX: clientX,
      lastY: clientY,
    };
    setLiveScribble({ regionId, points: [[x, y]] });
    setCoveragePct(0);
    setScribbleHint("");
  };

  const moveScribble = (clientX: number, clientY: number) => {
    const s = scribbleRef.current;
    if (!s) return;
    const [x, y] = toSvgCoords(clientX, clientY);
    const last = s.points[s.points.length - 1]!;
    const d = Math.hypot(x - last[0], y - last[1]);
    if (d < 2.5) return;
    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
    const speed = Math.hypot(clientX - s.lastX, clientY - s.lastY) / dt; // px per ms
    if (soundOn) crayonNoise.stroke(Math.min(1, speed / 1.6));
    s.lastT = now;
    s.lastX = clientX;
    s.lastY = clientY;
    s.length += d;
    s.points = [...s.points, [x, y]];
    const g = geom.map.get(s.regionId);
    if (g) {
      for (let i = 0; i < g.samples.length; i++) {
        if (s.covered.has(i)) continue;
        const [sx, sy] = g.samples[i]!;
        if (distToSegment(sx, sy, last[0], last[1], x, y) <= params.radius) s.covered.add(i);
      }
      setCoveragePct(g.samples.length ? Math.round((s.covered.size / g.samples.length) * 100) : 0);
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
    const coverage = g && g.samples.length ? s.covered.size / g.samples.length : 0;
    // A tap (almost no travel) or a stationary press can never complete
    // a region: both the travel distance and the covered share must
    // pass their marks.
    if (s.length >= 45 && coverage >= params.threshold) {
      pushHistory();
      onChange({ ...colors, [s.regionId]: color }, strokes);
      setScribbleHint("");
    } else if (s.points.length > 1) {
      setScribbleHint("Hampir! Gosok bidangnya lebih banyak lagi sampai penuh ya.");
    }
  };

  /* --------------------------- Pointer flow --------------------------- */

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinchRef.current = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom };
      drawingRef.current = null;
      setLiveStroke(null);
      scribbleRef.current = null;
      setLiveScribble(null);
      setCoveragePct(0);
      crayonNoise.stop();
      return;
    }
    if (tool === "move") {
      panningRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (tool === "scribble") {
      startScribble(e.clientX, e.clientY);
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
    const had = pointersRef.current.get(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = [...pointersRef.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (d > 10) setZoom(Math.min(3, Math.max(1, pinchRef.current.zoom * (d / pinchRef.current.d))));
      return;
    }
    if (!had) return;
    if (panningRef.current) {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const [vw, vh] = template.viewBox;
      setPan({
        x: panningRef.current.panX + ((e.clientX - panningRef.current.x) / rect.width) * vw,
        y: panningRef.current.panY + ((e.clientY - panningRef.current.y) / rect.height) * vh,
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
      if (Math.hypot(p[0] - lastPt[0], p[1] - lastPt[1]) > 2) {
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
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null;
    panningRef.current = null;
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

  const paletteColors = palette === "vibrant" ? VIBRANT : PASTEL;
  const toolBtn = (t: Tool, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={tool === t}
      onClick={() => setTool(t)}
      className={`flex min-w-16 flex-col items-center gap-0.5 rounded-2xl px-3 py-2 font-display text-xs font-bold ${
        tool === t ? "bg-sky-deep text-white shadow" : "bg-[var(--surface)] text-[var(--text)] ring-1 ring-[var(--border)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const activeRegion = liveScribble ? template.regions.find((r) => r.id === liveScribble.regionId) : undefined;

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative touch-none overflow-hidden rounded-3xl bg-white shadow-inner ring-1 ring-[var(--border)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => {
          setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY * 0.0015)));
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x / (template.viewBox[0] / 100)}%, ${pan.y / (template.viewBox[1] / 100)}%) scale(${zoom})`,
            transformOrigin: "center",
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
        {zoom > 1 && (
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

      {scribbleHint && (
        <p className="mt-2 text-center font-display text-sm font-bold text-tang-deep" role="status">
          {scribbleHint}
        </p>
      )}

      {/* Tools */}
      <div className="mt-3 flex flex-wrap items-stretch justify-center gap-2">
        {toolBtn("scribble", "Coret & Isi", (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 17 C6 10 9 20 12 12 C14 7 17 15 21 8" /><path d="M4 21 H20" /></svg>
        ))}
        {toolBtn("brush", "Kuas", (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20 C4 16 6 14 9 13 L20 2 L22 4 L11 15 C10 18 8 20 4 20 Z" /></svg>
        ))}
        {toolBtn("eraser", "Penghapus", (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M7 15 L16 6 L20 10 L13 17 H9 L5 13 Z" /><path d="M9 21 H21" /></svg>
        ))}
        {toolBtn("move", "Geser", (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3 V21 M3 12 H21 M12 3 L9 6 M12 3 L15 6 M12 21 L9 18 M12 21 L15 18 M3 12 L6 9 M3 12 L6 15 M21 12 L18 9 M21 12 L18 15" /></svg>
        ))}
        <button
          type="button"
          aria-pressed={soundOn}
          aria-label={soundOn ? "Matikan suara krayon" : "Nyalakan suara krayon"}
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            saveSoundPref(next);
            if (!next) crayonNoise.stop();
          }}
          className={`flex min-w-16 flex-col items-center gap-0.5 rounded-2xl px-3 py-2 font-display text-xs font-bold ${
            soundOn ? "bg-[var(--surface)] text-[var(--text)] ring-1 ring-[var(--border)]" : "bg-[var(--surface)] text-[var(--dim)] ring-1 ring-[var(--border)]"
          }`}
        >
          {soundOn ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9 H3 v6 h3 l5 4 Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18 6a8.5 8.5 0 0 1 0 12" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9 H3 v6 h3 l5 4 Z" /><path d="m16 9 6 6 M22 9 l-6 6" /></svg>
          )}
          {soundOn ? "Suara Nyala" : "Suara Mati"}
        </button>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Urungkan" disabled={undoRef.current.length === 0} onClick={undo} className="rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)] disabled:opacity-40">
            ↩ Urungkan
          </button>
          <button type="button" aria-label="Ulangi" disabled={redoRef.current.length === 0} onClick={redo} className="rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)] disabled:opacity-40">
            Ulangi ↪
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Perkecil" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} className="rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-lg font-bold ring-1 ring-[var(--border)]">−</button>
          <button type="button" aria-label="Perbesar" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-lg font-bold ring-1 ring-[var(--border)]">+</button>
          <button
            type="button"
            aria-label="Atur ulang zoom"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="rounded-2xl bg-[var(--surface)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]"
          >
            Fit
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
          {confirmReset ? "Ketuk lagi untuk menghapus semua" : "Mulai ulang"}
        </button>
      </div>

      {/* Brush size */}
      {(tool === "brush" || tool === "eraser") && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <label htmlFor="brush-size" className="font-display text-sm font-bold">
            {tool === "brush" ? "Ukuran krayon" : "Ukuran penghapus"}
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

      {/* Palettes */}
      <div className="mt-4">
        <div className="mb-2 flex justify-center gap-2" role="tablist" aria-label="Palet warna">
          <button
            type="button"
            role="tab"
            aria-selected={palette === "vibrant"}
            onClick={() => setPalette("vibrant")}
            className={`rounded-full px-4 py-1.5 font-display text-sm font-bold ${palette === "vibrant" ? "bg-tang-deep text-white" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
          >
            Krayon cerah
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={palette === "pastel"}
            onClick={() => setPalette("pastel")}
            className={`rounded-full px-4 py-1.5 font-display text-sm font-bold ${palette === "pastel" ? "bg-tang-deep text-white" : "bg-[var(--surface)] ring-1 ring-[var(--border)]"}`}
          >
            Pastel lembut
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Warna krayon">
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
              className={`h-11 w-11 rounded-full shadow-sm transition-transform ${color === c.hex ? "scale-110 ring-4 ring-ink/70" : "ring-1 ring-black/15"}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-sm font-semibold text-[var(--dim)]">
          {tool === "scribble" && `Gosok bidang gambar dengan jarimu sampai penuh — kelompok ${params.group} terisi setelah kira-kira ${Math.round(params.threshold * 100)}% bidang tergosok.`}
          {tool === "brush" && "Gambar dengan jarimu — krayon tetap di dalam garis."}
          {tool === "eraser" && "Ketuk bagian untuk membersihkannya, atau gosok garis krayon untuk menghapusnya."}
          {tool === "move" && "Seret untuk menggerakkan gambar."}
        </p>
      </div>
    </div>
  );
}
