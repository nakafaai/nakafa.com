import { describe, expect, it } from "@effect/vitest";
import {
  anodisedAt,
  brushedAt,
  castAt,
  knurlAt,
  machinedAt,
  polishedAt,
  TURNS,
  WIRES,
  windingAt,
} from "@repo/design-system/components/three/surface/metal";
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

describe("metal patterns", () => {
  it.each([
    ["anodised", anodisedAt],
    ["brushed", brushedAt],
    ["cast", castAt],
    ["knurl", knurlAt],
    ["machined", machinedAt],
    ["polished", polishedAt],
    ["winding", windingAt],
  ] as const)("keeps %s between dark and bright, low and high", (_, at) => {
    const all = Arr.map(places(48), ({ x, y }) => at(x, y));
    const heights = rangeOf(Arr.map(all, (place) => place.height));
    const shades = rangeOf(Arr.map(all, (place) => place.shade));

    expect(heights.low).toBeGreaterThanOrEqual(-0.5);
    expect(heights.high).toBeLessThanOrEqual(1);
    expect(heights.high).toBeGreaterThan(heights.low);
    expect(shades.low).toBeGreaterThan(0);
    expect(shades.high).toBeLessThanOrEqual(1.05);
  });

  it("pits cast metal in some of its cells and leaves the others whole", () => {
    const heights = Arr.map(places(96), ({ x, y }) => castAt(x, y).height);

    expect(Arr.some(heights, (height) => height < 0.2)).toBe(true);
    expect(Arr.some(heights, (height) => height > 0.8)).toBe(true);
  });

  it("stands a knurl highest where its two cuts leave a point", () => {
    expect(knurlAt(1 / 48, 0).height).toBeCloseTo(1, 9);
    expect(knurlAt(0, 0).height).toBe(0);
  });

  it("cuts machined metal into one cusp a turn", () => {
    const groove = machinedAt(0.3, 0.5 / TURNS).height;
    const crest = machinedAt(0.3, 1 / TURNS).height;

    expect(crest - groove).toBeGreaterThan(0.6);
  });

  it("scratches polished metal only where a cloth rubbed it", () => {
    const heights = Arr.map(places(96), ({ x, y }) => polishedAt(x, y).height);

    expect(Arr.some(heights, (height) => height === 0.9)).toBe(true);
    expect(Arr.some(heights, (height) => height < 0.6)).toBe(true);
  });

  it("rounds each turn of a winding and sinks between two", () => {
    expect(windingAt(0.3, 0.5 / WIRES).height).toBeCloseTo(1, 9);
    expect(windingAt(0.3, 1 / WIRES).height).toBeCloseTo(0, 9);
    expect(windingAt(0.9, 0.5 / WIRES).height).toBe(
      windingAt(0.1, 0.5 / WIRES).height
    );
  });
});
