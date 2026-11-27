import { describe, expect, it } from "@effect/vitest";
import {
  corkAt,
  feltAt,
  foamAt,
  paperAt,
} from "@repo/design-system/components/three/surface/pressed";
import { Array as Arr } from "effect";

/** Every place of a `count` by `count` grid over one tile. */
function places(count: number) {
  return Arr.makeBy(count * count, (index) => ({
    x: (index % count) / count,
    y: Math.floor(index / count) / count,
  }));
}

/** The lowest and the highest of `values`. */
function rangeOf(values: readonly number[]) {
  return { high: Math.max(...values), low: Math.min(...values) };
}

describe("pressed patterns", () => {
  it.each([
    ["cork", corkAt],
    ["felt", feltAt],
    ["foam", foamAt],
    ["paper", paperAt],
  ] as const)("keeps %s between dark and bright, low and high", (_, at) => {
    const all = Arr.map(places(48), ({ x, y }) => at(x, y));
    const heights = rangeOf(Arr.map(all, (place) => place.height));
    const shades = rangeOf(Arr.map(all, (place) => place.shade));

    expect(heights.low).toBeGreaterThanOrEqual(-0.25);
    expect(heights.high).toBeLessThanOrEqual(1);
    expect(heights.high).toBeGreaterThan(heights.low);
    expect(shades.low).toBeGreaterThanOrEqual(-0.1);
    expect(shades.high).toBeLessThanOrEqual(1);
  });

  it("opens pits in some granules of cork and leaves the others whole", () => {
    const heights = Arr.map(places(96), ({ x, y }) => corkAt(x, y).height);

    expect(Arr.some(heights, (height) => height < 0.2)).toBe(true);
    expect(Arr.some(heights, (height) => height > 0.7)).toBe(true);
  });

  it("creases foam where two beads meet", () => {
    const heights = Arr.map(places(96), ({ x, y }) => foamAt(x, y).height);

    expect(Math.min(...heights)).toBeLessThan(0.4);
    expect(Math.max(...heights)).toBeGreaterThan(0.9);
  });

  it("keeps paper nearly even in tone", () => {
    const shades = Arr.map(places(48), ({ x, y }) => paperAt(x, y).shade);

    expect(Math.max(...shades) - Math.min(...shades)).toBeLessThan(0.3);
  });
});
