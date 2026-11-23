import { describe, expect, test } from "bun:test";
import { clampArtPan, pointToArt, scribbleGoal, zoomArtAt } from "./editor-touch";

const box = { left: 100, top: 50, width: 600, height: 600 };
const size: [number, number] = [600, 600];
const original = { zoom: 1, pan: { x: 0, y: 0 } };

describe("coloring editor gesture geometry", () => {
  test("canvas coordinates remain accurate at the center after zooming", () => {
    const next = zoomArtAt(original, 2, 400, 350, box, size);
    expect(next).toEqual({ zoom: 2, pan: { x: 0, y: 0 } });
    expect(pointToArt(400, 350, box, next, size)).toEqual({ x: 300, y: 300 });
    expect(pointToArt(550, 350, box, next, size)).toEqual({ x: 375, y: 300 });
  });

  test("cursor-anchored wheel zoom keeps the same SVG point under the pointer", () => {
    const anchor = { x: 510, y: 350 };
    const before = pointToArt(anchor.x, anchor.y, box, original, size);
    const zoomed = zoomArtAt(original, 2, anchor.x, anchor.y, box, size);
    const after = pointToArt(anchor.x, anchor.y, box, zoomed, size);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  test("panning is bounded and fit resets the center", () => {
    expect(clampArtPan({ x: 999, y: -999 }, 2, size)).toEqual({ x: 300, y: -300 });
    expect(clampArtPan({ x: 45, y: -20 }, 1, size)).toEqual({ x: 0, y: 0 });
    expect(zoomArtAt(original, 999, 400, 350, box, size).zoom).toBe(4);
  });

  test("the same view is preserved through zoom in and zoom out", () => {
    const bigger = zoomArtAt(original, 2.5, 520, 440, box, size);
    const originalAgain = zoomArtAt(bigger, 1, 520, 440, box, size);
    expect(originalAgain).toEqual(original);
  });

  test("small regions use shorter strokes while a stationary tap never qualifies", () => {
    expect(scribbleGoal(0.4, 5)).toEqual({ threshold: 0.15, minDistance: 8, small: true });
    expect(scribbleGoal(0.28, 22)).toEqual({ threshold: 0.2, minDistance: 16, small: true });
    expect(scribbleGoal(0.4, 60)).toEqual({ threshold: 0.28, minDistance: 28, small: true });
    expect(scribbleGoal(0.4, 220)).toEqual({ threshold: 0.4, minDistance: 45, small: false });
    expect(scribbleGoal(0.18, 5).minDistance).toBeGreaterThan(0);
  });
});
