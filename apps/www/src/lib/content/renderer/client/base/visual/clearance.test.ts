import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  boxAxisDistance,
  boxEdgeMargin,
  boxGap,
  clipSegmentRange,
  insetBounds,
  minSegmentDistance,
  segmentToBoxDistance,
} from "@/lib/content/renderer/client/base/visual/clearance";

describe("clearance geometry helpers", () => {
  it("computes inset bounds, box gaps, axis clearance, and edge margins", () => {
    const focus = {
      x: { max: 10, min: 0 },
      y: { max: 10, min: 0 },
      z: { max: 0, min: 0 },
    };
    const bounds = insetBounds(focus);
    expect(bounds.minX).toBeCloseTo(1.4);
    expect(bounds.maxX).toBeCloseTo(8.6);
    expect(bounds.minY).toBeCloseTo(1.4);
    expect(bounds.maxY).toBeCloseTo(8.6);

    const a = { cx: 2, cy: 2, halfH: 0.5, halfW: 1 };
    const overlapping = { cx: 2.5, cy: 2.2, halfH: 0.5, halfW: 1 };
    const separated = { cx: 6, cy: 2, halfH: 0.5, halfW: 1 };
    expect(boxGap(a, overlapping)).toBeLessThan(0);
    expect(boxGap(a, separated)).toBeCloseTo(2);
    expect(boxAxisDistance(a, { x: 0, y: 0, z: 0 })).toBeCloseTo(1);
    expect(boxEdgeMargin(a, focus)).toBeCloseTo(1);
  });

  it("clips segments against rectangles and measures exact segment-to-box distance", () => {
    const rect = { maxX: 3, maxY: 3, minX: 1, minY: 1 };
    expect(
      Option.isNone(
        clipSegmentRange({ x: 5, y: 0, z: 0 }, { x: 5, y: 4, z: 0 }, rect)
      )
    ).toBe(true);
    expect(
      Option.isSome(
        clipSegmentRange({ x: 2, y: 0, z: 0 }, { x: 2, y: 4, z: 0 }, rect)
      )
    ).toBe(true);
    expect(
      Option.isNone(
        clipSegmentRange({ x: 0, y: 5, z: 0 }, { x: 2, y: 7, z: 0 }, rect)
      )
    ).toBe(true);
    expect(
      Option.isNone(
        clipSegmentRange({ x: 5, y: 0, z: 0 }, { x: 7, y: 2, z: 0 }, rect)
      )
    ).toBe(true);

    const box = { cx: 2, cy: 2, halfH: 1, halfW: 1 };
    expect(
      segmentToBoxDistance(
        [
          { x: 0, y: 2, z: 0 },
          { x: 4, y: 2, z: 0 },
        ],
        box
      )
    ).toBe(0);
    expect(
      segmentToBoxDistance(
        [
          { x: 5, y: 0, z: 0 },
          { x: 5, y: 4, z: 0 },
        ],
        box
      )
    ).toBeCloseTo(2);
    expect(
      segmentToBoxDistance(
        [
          { x: 5, y: 2, z: 0 },
          { x: 5, y: 2, z: 0 },
        ],
        box
      )
    ).toBeCloseTo(2);

    expect(minSegmentDistance([], box, 9)).toBe(9);
    expect(
      minSegmentDistance(
        [
          [
            { x: 5, y: 0, z: 0 },
            { x: 5, y: 4, z: 0 },
          ],
        ],
        box,
        9
      )
    ).toBeCloseTo(2);
  });
});
