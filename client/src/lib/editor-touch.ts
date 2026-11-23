// Shared, testable geometry for the coloring canvas. The artwork is scaled about
// its center and translated in artwork units (not page coordinates).
export type Point = { x: number; y: number };
export type CanvasView = { zoom: number; pan: Point };
export type CanvasBounds = { left: number; top: number; width: number; height: number };

export const MAX_ART_ZOOM = 4;

export function clampArtZoom(value: number): number {
  return Math.min(MAX_ART_ZOOM, Math.max(1, value));
}

export function clampArtPan(pan: Point, zoom: number, viewBox: readonly [number, number]): Point {
  if (zoom <= 1) return { x: 0, y: 0 };
  const [width, height] = viewBox;
  const maxX = (width * (zoom - 1)) / 2;
  const maxY = (height * (zoom - 1)) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}

/** Transform an actual pointer position to the untransformed artwork SVG. */
export function pointToArt(
  clientX: number,
  clientY: number,
  bounds: CanvasBounds,
  view: CanvasView,
  viewBox: readonly [number, number],
): Point {
  const [width, height] = viewBox;
  const screenX = ((clientX - bounds.left) / Math.max(1, bounds.width)) * width;
  const screenY = ((clientY - bounds.top) / Math.max(1, bounds.height)) * height;
  return {
    x: width / 2 + (screenX - width / 2 - view.pan.x) / view.zoom,
    y: height / 2 + (screenY - height / 2 - view.pan.y) / view.zoom,
  };
}

/** Zoom around a finger, pinch midpoint or mouse pointer, not the page. */
export function zoomArtAt(
  view: CanvasView,
  desiredZoom: number,
  clientX: number,
  clientY: number,
  bounds: CanvasBounds,
  viewBox: readonly [number, number],
): CanvasView {
  const zoom = clampArtZoom(desiredZoom);
  const [width, height] = viewBox;
  const oldPoint = pointToArt(clientX, clientY, bounds, view, viewBox);
  const screenX = ((clientX - bounds.left) / Math.max(1, bounds.width)) * width;
  const screenY = ((clientY - bounds.top) / Math.max(1, bounds.height)) * height;
  return {
    zoom,
    pan: clampArtPan({
      x: screenX - width / 2 - (oldPoint.x - width / 2) * zoom,
      y: screenY - height / 2 - (oldPoint.y - height / 2) * zoom,
    }, zoom, viewBox),
  };
}

/** A short, intentional rub should be enough for small pieces (ears, feet, spikes). */
export function scribbleGoal(baseThreshold: number, coarseSampleCount: number): {
  threshold: number; minDistance: number; small: boolean;
} {
  if (coarseSampleCount < 10) {
    return { threshold: Math.min(baseThreshold, 0.15), minDistance: 8, small: true };
  }
  if (coarseSampleCount < 38) {
    return { threshold: Math.min(baseThreshold, 0.2), minDistance: 16, small: true };
  }
  if (coarseSampleCount < 90) {
    return { threshold: Math.min(baseThreshold, 0.28), minDistance: 28, small: true };
  }
  return { threshold: baseThreshold, minDistance: 45, small: false };
}
