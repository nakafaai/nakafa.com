// @vitest-environment node

import {
  getArcPoints,
  getMidpoint,
} from "@repo/design-system/components/contents/snbt/geometry";
import { describe, expect, it } from "vitest";

describe("SNBT geometry", () => {
  it("returns the midpoint on every graph axis", () => {
    expect(getMidpoint({ x: -4, y: 2, z: 8 }, { x: 6, y: 10, z: -2 })).toEqual({
      x: 1,
      y: 6,
      z: 3,
    });
  });

  it("samples an inclusive arc while preserving its z plane", () => {
    const points = getArcPoints({ x: 2, y: 3, z: 4 }, 2, 0, Math.PI / 2, 2);

    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 4, y: 3, z: 4 });
    expect(points[1]).toEqual({
      x: 2 + Math.SQRT2,
      y: 3 + Math.SQRT2,
      z: 4,
    });
    expect(points[2]?.x).toBeCloseTo(2);
    expect(points[2]?.y).toBeCloseTo(5);
    expect(points[2]?.z).toBe(4);
  });

  it("uses the shared default sampling density", () => {
    expect(getArcPoints({ x: 0, y: 0, z: 0 }, 1, 0, Math.PI)).toHaveLength(21);
  });
});
