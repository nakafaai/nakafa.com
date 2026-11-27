import { describe, expect, it } from "@effect/vitest";
import { starField } from "@repo/design-system/components/three/habitat/stars";
import { Array as Arr } from "effect";

describe("starField", () => {
  it("places every star on the unit sphere with a tint and a size", () => {
    const { places, sizes, tints } = starField(600, 9);

    expect(places).toHaveLength(1800);
    expect(tints).toHaveLength(1800);
    expect(sizes).toHaveLength(600);
    const lengths = Arr.makeBy(600, (star) =>
      Math.hypot(
        places[star * 3] ?? 0,
        places[star * 3 + 1] ?? 0,
        places[star * 3 + 2] ?? 0
      )
    );
    expect(Math.min(...lengths)).toBeCloseTo(1, 5);
    expect(Math.max(...lengths)).toBeCloseTo(1, 5);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0.69);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(3.31);
    expect(Math.min(...tints)).toBeGreaterThan(0.15);
    expect(Math.max(...tints)).toBeLessThanOrEqual(1);
  });

  it("answers the same sky for the same seed and another for another", () => {
    expect(starField(50, 4).places).toEqual(starField(50, 4).places);
    expect(starField(50, 4).places).not.toEqual(starField(50, 5).places);
  });

  it("keeps most stars faint and only a few bright", () => {
    const { sizes } = starField(2000, 2);
    const bright = Arr.filter([...sizes], (size) => size > 2).length;

    expect(bright).toBeGreaterThan(0);
    expect(bright).toBeLessThan(400);
  });
});
