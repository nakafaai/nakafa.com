import { describe, expect, it } from "@effect/vitest";
import {
  foamAt,
  paintFoam,
} from "@repo/design-system/components/three/vehicle/foam";

describe("foamAt", () => {
  it("leaves the water between the wash and the arms clear", () => {
    const mean = (across: number) =>
      (foamAt(0.1, across) + foamAt(0.37, across) + foamAt(0.71, across)) / 3;
    expect(mean(0.72)).toBeLessThan(mean(0.5));
    expect(mean(0.72)).toBeLessThan(mean(0.92));
    expect(mean(0.08)).toBeCloseTo(mean(0.92), 0);
  });

  it("never exceeds white water", () => {
    expect(foamAt(0.3, 0.5)).toBeLessThanOrEqual(1);
    expect(foamAt(0.3, 0.3)).toBeGreaterThanOrEqual(0);
  });
});

describe("paintFoam", () => {
  it("paints white pixels whose opacity is the foam", () => {
    const pixels = paintFoam(8);
    expect(pixels).toHaveLength(8 * 8 * 4);
    expect(pixels[0]).toBe(255);
    expect(pixels[3]).toBe(Math.round(255 * foamAt(0.5 / 8, 0.5 / 8)));
  });
});
