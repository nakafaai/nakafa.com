import { describe, expect, it } from "@effect/vitest";
import {
  GroundSchema,
  grainAt,
  paintDashes,
  paintGround,
  paintVerge,
} from "@repo/design-system/components/three/stage/grain";
import { Array as Arr } from "effect";

describe("grainAt", () => {
  it("answers the same number between 0 and 1 for the same seed, and another for another", () => {
    const places = Arr.makeBy(
      64,
      (index) => [(index % 8) / 8, index / 64] as const
    );
    const first = Arr.map(places, ([x, y]) => grainAt(x, y, 2, 5));
    expect(first).toEqual(Arr.map(places, ([x, y]) => grainAt(x, y, 2, 5)));
    expect(first).not.toEqual(Arr.map(places, ([x, y]) => grainAt(x, y, 2, 6)));
    expect(Math.min(...first)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...first)).toBeLessThanOrEqual(1);
  });

  it("tiles without a seam: one edge of the square meets the other", () => {
    for (const along of Arr.makeBy(16, (index) => index / 16)) {
      expect(grainAt(0, along, 2, 3)).toBeCloseTo(grainAt(1, along, 2, 3), 10);
      expect(grainAt(along, 0, 2, 3)).toBeCloseTo(grainAt(along, 1, 2, 3), 10);
    }
  });
});

describe("paintGround", () => {
  it("paints every ground as opaque pixels with a relief of its own size", () => {
    for (const kind of GroundSchema.literals) {
      const { color, patches, relief } = paintGround(kind, 8);
      expect(color).toHaveLength(8 * 8 * 4);
      expect(relief).toHaveLength(8 * 8 * 4);
      expect(patches).toHaveLength(8 * 8 * 4);
      expect(color[3]).toBe(255);
      expect(relief[3]).toBe(255);
      expect(patches[3]).toBe(255);
      // The patches only ever darken: they never fall under 45% of full light.
      expect(patches[0]).toBeGreaterThanOrEqual(114);
    }
  });

  it("paints grass greener than red or blue, and snow brighter than asphalt", () => {
    const mean = (pixels: Uint8ClampedArray, channel: number) =>
      Arr.reduce(
        Arr.makeBy(
          pixels.length / 4,
          (pixel) => pixels[pixel * 4 + channel] ?? 0
        ),
        0,
        (sum, value) => sum + value
      ) /
      (pixels.length / 4);
    const grass = paintGround("grass", 16).color;
    expect(mean(grass, 1)).toBeGreaterThan(mean(grass, 0));
    expect(mean(grass, 1)).toBeGreaterThan(mean(grass, 2));
    expect(mean(paintGround("snow", 16).color, 0)).toBeGreaterThan(
      mean(paintGround("asphalt", 16).color, 0) + 100
    );
  });
});

describe("paintDashes", () => {
  it("is white along the dash and black after it", () => {
    const row = paintDashes(8, 0.5);
    expect(Arr.makeBy(8, (pixel) => row[pixel * 4 + 1])).toEqual([
      255, 255, 255, 255, 0, 0, 0, 0,
    ]);
  });
});

describe("paintVerge", () => {
  it("is black at both ends and white across the middle", () => {
    const row = paintVerge(9, 0.25);
    const alpha = Arr.makeBy(9, (pixel) => row[pixel * 4 + 1] ?? 0);
    expect(alpha[0]).toBe(0);
    expect(alpha[8]).toBe(0);
    expect(alpha[4]).toBe(255);
    expect(alpha[1]).toBeGreaterThan(0);
    expect(alpha[1]).toBeLessThan(255);
  });
});
