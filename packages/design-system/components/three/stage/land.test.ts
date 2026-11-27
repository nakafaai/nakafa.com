import { describe, expect, it } from "@effect/vitest";
import {
  GROUNDS,
  GroundSchema,
  paintSweep,
} from "@repo/design-system/components/three/stage/land";
import { BOARDS } from "@repo/design-system/components/three/surface/detail";
import { Array as Arr } from "effect";

/** The mean of one channel of a painted image. */
function mean(pixels: Uint8ClampedArray, channel: number) {
  return (
    Arr.reduce(
      Arr.makeBy(pixels.length / 4, (pixel) =>
        Number(pixels[pixel * 4 + channel])
      ),
      0,
      (sum, value) => sum + value
    ) /
    (pixels.length / 4)
  );
}

describe("GROUNDS", () => {
  it("keeps every top inside a room flat and rolls only unpaved open land", () => {
    for (const kind of GroundSchema.literals) {
      const { indoor, rise } = GROUNDS[kind];
      expect(indoor && rise > 0).toBe(false);
    }
    expect(GROUNDS.asphalt.rise).toBe(0);
    expect(GROUNDS.concrete.rise).toBe(0);
    expect(GROUNDS.grass.rise).toBeGreaterThan(0);
  });
});

describe("paintSweep", () => {
  it.each(GroundSchema.literals)(
    "paints %s opaque, between its darkest and its palest tone",
    (kind) => {
      const { dark, light } = GROUNDS[kind];
      const { height, pixels, width } = paintSweep(kind, 5);

      expect(pixels).toHaveLength(width * height * 4);
      for (const pixel of Arr.makeBy(width * height, (each) => each)) {
        expect(pixels[pixel * 4 + 3]).toBe(255);
        expect(Number(pixels[pixel * 4])).toBeGreaterThanOrEqual(dark[0]);
        expect(Number(pixels[pixel * 4])).toBeLessThanOrEqual(light[0]);
      }
    }
  );

  it("paints grass greener than red or blue, and snow brighter than asphalt", () => {
    const grass = paintSweep("grass", 5).pixels;

    expect(mean(grass, 1)).toBeGreaterThan(mean(grass, 0));
    expect(mean(grass, 1)).toBeGreaterThan(mean(grass, 2));
    expect(mean(paintSweep("snow", 5).pixels, 0)).toBeGreaterThan(
      mean(paintSweep("asphalt", 5).pixels, 0) + 100
    );
  });

  it("spreads open ground in soft patches as broad as the lab reaches", () => {
    const { height, pixels, span, width } = paintSweep("soil", 5);
    const tones = Arr.dedupe(
      Arr.makeBy(width * height, (pixel) => pixels[pixel * 4])
    );

    expect(tones.length).toBeGreaterThan(20);
    expect(span[0]).toBeGreaterThan(2 * 5);
    expect(paintSweep("soil", 10).span[0]).toBe(2 * span[0]);
    // Neighbouring pixels differ by little: patches, not speckle.
    expect(Math.abs(Number(pixels[0]) - Number(pixels[4]))).toBeLessThan(24);
  });

  it("spreads a top inside a room wider than its tiles, never lined up with them", () => {
    const tiles = paintSweep("epoxy", 5).span[0] / GROUNDS.epoxy.tile[0];

    expect(paintSweep("epoxy", 50).span[0]).toBe(
      paintSweep("epoxy", 5).span[0]
    );
    expect(tiles).toBeGreaterThan(8);
    expect(tiles).not.toBe(Math.round(tiles));
  });

  it("gives every board of a planked top one tone of its own, a pixel a board", () => {
    const { height, pixels, span, width } = paintSweep("oak", 5);
    const tones = Arr.dedupe(Arr.makeBy(height, (row) => pixels[row * 4]));

    expect(width).toBe(1);
    expect(tones.length).toBeGreaterThan(height / 3);
    expect(span[0]).toBe(GROUNDS.oak.tile[0]);
    expect(span[1] / height).toBeCloseTo(GROUNDS.oak.tile[1] / BOARDS, 10);
  });
});
