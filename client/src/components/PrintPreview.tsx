// On-screen previews of the printables, drawn from the exact same net
// data the PDF builder consumes — what you see is what prints.

import { INK, NAME_FONTS, elToPath, resolveColor, type NetDef, type NetPiece, type TemplateDef } from "../lib/model";
import type { PillowNet, PillowPiece } from "../lib/pillow";
import { ArtworkSvg, type Stroke } from "./ColoringEditor";

function fillFor(template: TemplateDef, colors: Record<string, string>, region: string) {
  return region === "__ink" ? INK
    : region === "__butter" ? "#FFC93C"
    : region === "plate" || region === "__nameplate" ? "#FFC93C"
    : resolveColor(template, colors, region);
}

function LegacyPiece({
  piece, idx, template, colors, name, nameColor,
}: {
  piece: NetPiece; idx: number; template: TemplateDef;
  colors: Record<string, string>; name: string; nameColor: string;
}) {
  const centroid = (pts: [number, number][]): [number, number] => [
    pts.reduce((a, p) => a + p[0], 0) / pts.length,
    pts.reduce((a, p) => a + p[1], 0) / pts.length,
  ];
  const [cx, cy] = centroid(piece.polygon);
  return (
    <g>
      {(piece.tabs ?? []).map((t, i) => (
        <polygon key={i} points={t.map((p) => p.join(",")).join(" ")} fill="#EFECE6" stroke={INK} strokeWidth={0.5} />
      ))}
      <polygon
        points={piece.polygon.map((p) => p.join(",")).join(" ")}
        fill={fillFor(template, colors, piece.region)}
        stroke={INK}
        strokeWidth={0.9}
      />
      {(piece.decals ?? []).map((d, i) => {
        const c = d.region ? fillFor(template, colors, d.region) : (d.fill ?? "#fff");
        if (d.polygon)
          return <polygon key={i} points={d.polygon.map((p) => p.join(",")).join(" ")} fill={c} stroke={INK} strokeWidth={0.5} />;
        if (d.circle)
          return <circle key={i} cx={d.circle.cx} cy={d.circle.cy} r={d.circle.r} fill={c} stroke={INK} strokeWidth={0.5} />;
        if (d.pathD)
          return (
            <path
              key={i}
              d={d.pathD}
              transform={`translate(${d.pathTx ?? 0} ${d.pathTy ?? 0}) scale(${d.pathScale ?? 1})`}
              fill={c}
              stroke={INK}
              strokeWidth={2.5}
            />
          );
        return null;
      })}
      {(piece.folds ?? []).map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeWidth={0.6} strokeDasharray="2.4 1.8" />
      ))}
      <g pointerEvents="none">
        <circle cx={cx} cy={cy} r={4.4} fill="#fff" stroke={INK} strokeWidth={0.8} />
        <text x={cx} y={cy + 1.7} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={INK}>
          {idx + 1}
        </text>
      </g>
      {piece.nameplate && name.trim() && (
        <g pointerEvents="none">
          <polygon points={piece.nameplate.map((p) => p.join(",")).join(" ")} fill="#FFC93C" stroke={INK} strokeWidth={0.6} />
          <text
            x={(Math.min(...piece.nameplate.map((p) => p[0])) + Math.max(...piece.nameplate.map((p) => p[0]))) / 2}
            y={(Math.min(...piece.nameplate.map((p) => p[1])) + Math.max(...piece.nameplate.map((p) => p[1]))) / 2 + 2}
            textAnchor="middle"
            fontSize={5.4}
            fontWeight={800}
            fill={nameColor}
          >
            {name.trim().toUpperCase()}
          </text>
        </g>
      )}
    </g>
  );
}

function EnginePiece({
  piece, template, colors, name, nameColor,
}: {
  piece: NetPiece; template: TemplateDef;
  colors: Record<string, string>; name: string; nameColor: string;
}) {
  return (
    <g>
      {(piece.tabs ?? []).map((t, i) => (
        <polygon key={`t${i}`} points={t.map((p) => p.join(",")).join(" ")} fill="#EFECE6" stroke={INK} strokeWidth={0.45} />
      ))}
      {(piece.faces ?? []).map((fc, i) => (
        <polygon
          key={`f${i}`}
          points={fc.polygon.map((p) => p.join(",")).join(" ")}
          fill={fillFor(template, colors, fc.region)}
        />
      ))}
      {(piece.decals ?? []).map((d, i) => {
        const c = d.region ? fillFor(template, colors, d.region) : (d.fill ?? "#fff");
        if (d.polygon)
          return <polygon key={`d${i}`} points={d.polygon.map((p) => p.join(",")).join(" ")} fill={c} stroke={INK} strokeWidth={0.45} />;
        if (d.circle)
          return <circle key={`d${i}`} cx={d.circle.cx} cy={d.circle.cy} r={d.circle.r} fill={c} stroke={INK} strokeWidth={0.45} />;
        return null;
      })}
      {(piece.foldLines ?? []).map((fl, i) => (
        <line
          key={`fl${i}`}
          x1={fl.a[0]} y1={fl.a[1]} x2={fl.b[0]} y2={fl.b[1]}
          stroke={INK}
          strokeWidth={0.55}
          strokeDasharray={fl.kind === "mountain" ? "2.4 1.8" : "3.4 1.1 0.7 1.1"}
        />
      ))}
      {(piece.cutEdges ?? []).map(([a, b], i) => (
        <line key={`c${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeWidth={0.85} />
      ))}
      {(piece.edgeNumbers ?? []).map((e, i) => (
        <text key={`n${i}`} x={e.x} y={e.y + 1} textAnchor="middle" fontSize={2.7} fontWeight={700} fill="#6F6157">
          {e.n}
        </text>
      ))}
      {piece.labelAt && (
        <text x={piece.labelAt[0]} y={piece.labelAt[1] + 1} textAnchor="middle" fontSize={3} fill="#6F6157" opacity={0.85} pointerEvents="none">
          {piece.label}
        </text>
      )}
      {piece.nameplate && name.trim() && (
        <g pointerEvents="none">
          <polygon points={piece.nameplate.map((p) => p.join(",")).join(" ")} fill="#FFC93C" stroke={INK} strokeWidth={0.6} />
          <text
            x={(Math.min(...piece.nameplate.map((p) => p[0])) + Math.max(...piece.nameplate.map((p) => p[0]))) / 2}
            y={(Math.min(...piece.nameplate.map((p) => p[1])) + Math.max(...piece.nameplate.map((p) => p[1]))) / 2 + 2.2}
            textAnchor="middle"
            fontSize={5.6}
            fontWeight={800}
            fill={nameColor}
          >
            {name.trim().toUpperCase()}
          </text>
        </g>
      )}
    </g>
  );
}

export function NetPreview({
  net,
  template,
  colors,
  name,
  nameColor,
}: {
  net: NetDef;
  template: TemplateDef;
  colors: Record<string, string>;
  name: string;
  nameColor: string;
}) {
  if (net.engine && net.pages) {
    const pages = net.pages;
    return (
      <div className="space-y-4">
        {pages.map((pg, si) => (
          <figure key={si}>
            <svg
              viewBox={`0 0 ${net.widthMm} ${net.heightMm}`}
              className="h-auto w-full rounded-xl bg-white shadow-inner ring-1 ring-[var(--border)]"
              role="img"
              aria-label={`Lembar template mainan kertas ${si + 1} dari ${pages.length}`}
            >
              {pg.pieces.map((piece) => (
                <EnginePiece
                  key={piece.id}
                  piece={piece}
                  template={template}
                  colors={colors}
                  name={name}
                  nameColor={nameColor}
                />
              ))}
            </svg>
            <figcaption className="mt-1 text-center text-xs font-bold text-[var(--dim)]">
              Lembar {si + 1} dari {pages.length} · dibuka dari mesh 3D yang sama dengan pratinjaunya
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${net.widthMm} ${net.heightMm}`}
      className="h-auto w-full rounded-xl bg-white shadow-inner ring-1 ring-[var(--border)]"
      role="img"
      aria-label="Pratinjau template mainan kertas"
    >
      {net.pieces.map((piece, idx) => (
        <LegacyPiece
          key={piece.id}
          piece={piece}
          idx={idx}
          template={template}
          colors={colors}
          name={name}
          nameColor={nameColor}
        />
      ))}
    </svg>
  );
}

/* ------------------------- Paper Pillow preview ------------------------ */

const ptsAttr = (poly: [number, number][]) => poly.map((p) => p.join(",")).join(" ");
const pathFromPoly = (poly: [number, number][]) =>
  poly.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";

function PillowPieceView({
  piece, net, template, colors, strokes, name, nameFont, nameColor,
}: {
  piece: PillowPiece; net: PillowNet; template: TemplateDef;
  colors: Record<string, string>; strokes: Stroke[];
  name: string; nameFont: string; nameColor: string;
}) {
  const font = (NAME_FONTS.find((f) => f.id === nameFont) ?? NAME_FONTS[0]!).family;
  const solid = (region?: string) => resolveColor(template, colors, region ?? net.dominantRegion);
  if (piece.kind === "front" || piece.kind === "back") {
    // Both panels carry the child's artwork in the traced silhouette;
    // the back panel's artwork transform is mirrored together with its
    // outline, so the assembled pillow reads the same from behind.
    const isBack = piece.kind === "back";
    const art = isBack ? net.artBack : net.art;
    const clipId = `pillow-clip-${isBack ? "back-" : ""}${template.id}`;
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            {piece.polygons.map((poly, i) => <path key={i} d={pathFromPoly(poly)} />)}
          </clipPath>
        </defs>
        {piece.polygons.map((poly, i) => (
          <polygon key={`b${i}`} points={ptsAttr(poly)} fill={solid()} />
        ))}
        <g clipPath={`url(#clipId)`}>
          <g transform={`translate(${art.tx} ${art.ty}) scale(${isBack ? -art.s : art.s} ${art.s})`}>
            {template.regions.map((r) => (
              <g key={r.id}>
                {r.els.map((el, i) => (
                  <path key={i} d={elToPath(el)} fill={resolveColor(template, colors, r.id)} stroke={INK} strokeWidth={6.5} strokeLinejoin="round" strokeLinecap="round" />
                ))}
              </g>
            ))}
            {strokes.map((s, i) => (
              <path
                key={`s${i}`}
                d={s.points.map((p, j) => `${j === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
                fill="none" stroke={s.color} strokeWidth={s.size} strokeLinecap="round" strokeLinejoin="round"
              />
            ))}
            {template.details.map((d, i) => (
              <path key={`d${i}`} d={elToPath(d.el)} fill={d.fill ?? "none"} stroke={d.stroke ?? "none"} strokeWidth={d.sw ?? 3} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </g>
        </g>
        {piece.polygons.map((poly, i) => (
          <polygon key={`o${i}`} points={ptsAttr(poly)} fill="none" stroke={INK} strokeWidth={0.9} />
        ))}
        {piece.startMark && <circle cx={piece.startMark[0]} cy={piece.startMark[1]} r={1.7} fill={INK} />}
      </g>
    );
  }
  if (piece.kind === "gusset") {
    return (
      <g>
        {(piece.tabs ?? []).map((t, i) => (
          <polygon key={`t${i}`} points={ptsAttr(t)} fill="#EFECE6" stroke={INK} strokeWidth={0.45} />
        ))}
        {piece.band && <polygon points={ptsAttr(piece.band)} fill={solid(piece.region)} />}
        {piece.polygons.map((poly, i) => (
          <polygon key={`o${i}`} points={ptsAttr(poly)} fill="none" stroke={INK} strokeWidth={0.85} />
        ))}
        {(piece.folds ?? []).map(([a, b], i) => (
          <line key={`f${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeWidth={0.55} strokeDasharray="2.4 1.8" />
        ))}
        {(piece.joinMarks ?? []).map((m, i) => (
          <g key={`j${i}`} pointerEvents="none">
            <circle cx={m.x} cy={m.y} r={3.2} fill="#fff" stroke={INK} strokeWidth={0.8} />
            <text x={m.x} y={m.y + 1.5} textAnchor="middle" fontSize={4.6} fontWeight={800} fill={INK}>{m.n}</text>
          </g>
        ))}
        {piece.labelAt && (
          <text x={piece.labelAt[0]} y={piece.labelAt[1] + 1.4} textAnchor="middle" fontSize={3.4} fontWeight={700} fill="#FFFFFF" pointerEvents="none">
            {piece.label}
          </text>
        )}
      </g>
    );
  }
  // Stand
  const plate = piece.nameplate;
  const plateCx = plate ? (Math.min(...plate.map((p) => p[0])) + Math.max(...plate.map((p) => p[0]))) / 2 : 0;
  const plateCy = plate ? (Math.min(...plate.map((p) => p[1])) + Math.max(...plate.map((p) => p[1]))) / 2 : 0;
  const plateW = plate ? Math.max(...plate.map((p) => p[0])) - Math.min(...plate.map((p) => p[0])) : 0;
  return (
    <g>
      {piece.polygons.map((poly, i) => (
        <polygon key={i} points={ptsAttr(poly)} fill={piece.fill ?? "#FFF6E0"} stroke={INK} strokeWidth={0.85} />
      ))}
      {(piece.folds ?? []).map(([a, b], i) => (
        <line key={`f${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeWidth={0.55} strokeDasharray="2.4 1.8" />
      ))}
      {plate && name.trim() && (
        <g pointerEvents="none">
          <polygon points={ptsAttr(plate)} fill="#FFC93C" stroke={INK} strokeWidth={0.6} />
          <text
            x={plateCx} y={plateCy + 2.4} textAnchor="middle" fontWeight={800} fill={nameColor}
            fontFamily={font} fontSize={6.4}
            textLength={Math.min(plateW - 4, Math.max(10, name.trim().length * 4.4))}
            lengthAdjust="spacingAndGlyphs"
          >
            {name.trim().toUpperCase()}
          </text>
        </g>
      )}
      {piece.labelAt && (
        <text x={piece.labelAt[0]} y={piece.labelAt[1] + 1.2} textAnchor="middle" fontSize={3.2} fill="#6F6157" pointerEvents="none">
          PENYANGGA — lipat menjadi U
        </text>
      )}
    </g>
  );
}

export function PillowPreview({
  net, template, colors, strokes, name, nameFont, nameColor,
}: {
  net: PillowNet; template: TemplateDef;
  colors: Record<string, string>; strokes: Stroke[];
  name: string; nameFont: string; nameColor: string;
}) {
  return (
    <div className="space-y-4">
      {net.pages.map((pg, si) => (
        <figure key={si}>
          <svg
            viewBox={`0 0 ${net.widthMm} ${net.heightMm}`}
            className="h-auto w-full rounded-xl bg-white shadow-inner ring-1 ring-[var(--border)]"
            role="img"
            aria-label={`Lembar Bantal Kertas ${si + 1} dari ${net.pages.length}`}
          >
            {pg.pieces.map((piece) => (
              <PillowPieceView
                key={piece.id}
                piece={piece}
                net={net}
                template={template}
                colors={colors}
                strokes={strokes}
                name={name}
                nameFont={nameFont}
                nameColor={nameColor}
              />
            ))}
          </svg>
          <figcaption className="mt-1 text-center text-xs font-bold text-[var(--dim)]">
            Lembar {si + 1} dari {net.pages.length} · Bantal Kertas — kedua panelnya adalah gambar persisnya, ditelusuri dari gambar itu sendiri
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function StandeePreview({
  template,
  colors,
  strokes,
  name,
  nameFont,
  nameColor,
}: {
  template: TemplateDef;
  colors: Record<string, string>;
  strokes: Stroke[];
  name: string;
  nameFont: string;
  nameColor: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-inner ring-1 ring-[var(--border)]">
      <ArtworkSvg
        template={template}
        colors={colors}
        strokes={strokes}
        name={name}
        nameFont={nameFont}
        nameColor={nameColor}
      />
      <div className="mt-1 border-t-2 border-dashed border-ink/50 pt-2 text-center">
        <div className="bg-[#FFF6E0] px-2 py-2">
          <p className="font-display text-lg font-extrabold uppercase tracking-wide" style={{ color: nameColor }}>
            {name.trim() || "Namamu di sini"}
          </p>
          <p className="text-[11px] font-semibold text-[var(--dim)]">— lipat alasnya ke bawah supaya bisa berdiri —</p>
        </div>
      </div>
    </div>
  );
}
