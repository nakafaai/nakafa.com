// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { homeOf } from "@/lib/island/land/home";
import { pointOf } from "@/lib/island/land/relief";

describe("island/land/home", () => {
  it("opens every world on dry, low, livable land within reach of the origin", () => {
    for (const seed of [1, 77, 4242, 31_337, 900_001]) {
      const [x, z] = homeOf(seed);
      const point = pointOf(seed, x, z);
      expect(Math.hypot(x, z)).toBeLessThan(281);
      expect(point.elevation).toBeGreaterThanOrEqual(1.8);
      expect(point.elevation).toBeLessThanOrEqual(16);
      expect(point.wet).toBeLessThanOrEqual(-1.2);
      expect(point.height).toBeGreaterThan(point.surface);
    }
  });

  it("finds the same home for a seed every time, and another for another seed", () => {
    expect(homeOf(4242)).toEqual(homeOf(4242));
    expect(homeOf(4242)).not.toEqual(homeOf(77));
  });

  it("remembers a seed's home after the first search, and hands the same place back", () => {
    const first = homeOf(606);
    expect(homeOf(606)).toBe(first);
    expect(homeOf(607)).not.toBe(first);
  });
});
