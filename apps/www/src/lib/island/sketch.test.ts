// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { Brush } from "@/lib/island/land/stroke";
import { HUES } from "@/lib/island/models/hues";
import type { Rgb } from "@/lib/island/models/parts";
import { box } from "@/lib/island/models/parts";
import { thingFaces } from "@/lib/island/models/things";
import { sketchOf, swatchOf } from "@/lib/island/sketch";

/** A CSS color written as three whole channels. */
const CSS_COLOR = /^rgb\(\d+ \d+ \d+\)$/u;

/** The side of the pictures these tests draw, in pixels. */
const SIDE = 32;

/** One pixel of a picture as red, green, blue and alpha. */
function pixelAt(
  pixels: Uint8ClampedArray<ArrayBuffer>,
  column: number,
  row: number
) {
  return Arr.fromIterable(
    pixels.subarray((row * SIDE + column) * 4, (row * SIDE + column) * 4 + 4)
  );
}

/** Every painted pixel of a picture, by its column and row. */
function paintedOf(pixels: Uint8ClampedArray<ArrayBuffer>) {
  return Arr.filter(
    Arr.makeBy(SIDE * SIDE, (at) => ({
      column: at % SIDE,
      ink: pixelAt(pixels, at % SIDE, Math.floor(at / SIDE)),
      row: Math.floor(at / SIDE),
    })),
    ({ ink }) => ink[3] === 255
  );
}

/** Whether a painted pixel is a tone of a color: its channels stand in the color's own ratios. */
function isToneOf(ink: readonly number[], [red, green, blue]: Rgb) {
  const share = ink[0] / (red * 255);
  return (
    Math.abs(ink[1] - green * 255 * share) <= 2 &&
    Math.abs(ink[2] - blue * 255 * share) <= 2
  );
}

describe("sketchOf", () => {
  it("leaves a model with no face a clear square", () => {
    expect(paintedOf(sketchOf([], SIDE))).toEqual([]);
  });

  it("fits a wide and a tall model inside the square with a pixel of room", () => {
    for (const faces of [
      box([-6, 0, -1], [6, 1, 1], HUES.wood),
      box([-1, 0, -1], [1, 9, 1], HUES.wood),
    ]) {
      const painted = paintedOf(sketchOf(faces, SIDE));
      const columns = Arr.map(painted, ({ column }) => column);
      const rows = Arr.map(painted, ({ row }) => row);
      expect(Math.min(...columns, ...rows)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...columns, ...rows)).toBeLessThanOrEqual(SIDE - 2);
      expect(
        Math.max(
          Math.max(...columns) - Math.min(...columns),
          Math.max(...rows) - Math.min(...rows)
        )
      ).toBeGreaterThanOrEqual(SIDE - 4);
    }
  });

  it("paints every face in tones of its own color, the top brightest", () => {
    const painted = paintedOf(
      sketchOf(box([-1, 0, -1], [1, 2, 1], HUES.leaf), SIDE)
    );
    expect(painted.length).toBeGreaterThan(200);
    expect(Arr.every(painted, ({ ink }) => isToneOf(ink, HUES.leaf))).toBe(
      true
    );
    const tones = Arr.dedupe(Arr.map(painted, ({ ink }) => ink[1]));
    expect(tones.length).toBe(3);
    const top = Arr.findFirst(painted, ({ column }) => column === SIDE / 2);
    expect(Arr.map(Arr.fromOption(top), ({ ink }) => ink[1])).toEqual([
      Math.max(...tones),
    ]);
  });

  it("draws the nearer of two bodies over the farther, whichever is given first", () => {
    const inner = box([-0.5, 0.5, -0.5], [0.5, 1.5, 0.5], HUES.red);
    const outer = box([-2, 0, -2], [2, 4, 2], HUES.blue);
    const reds = (faces: Parameters<typeof sketchOf>[0]) =>
      Arr.filter(paintedOf(sketchOf(faces, SIDE)), ({ ink }) =>
        isToneOf(ink, HUES.red)
      ).length;
    expect(reds(inner)).toBeGreaterThan(100);
    expect(reds([...inner, ...outer])).toBe(0);
    expect(reds([...outer, ...inner])).toBe(0);
    expect(sketchOf([...inner, ...outer], SIDE)).toEqual(
      sketchOf([...outer, ...inner], SIDE)
    );
  });

  it("lights a lone leaf from whichever side it shows the eye", () => {
    const leaf = [
      [-1, 0, 0],
      [1, 0, 0],
      [1, 2, 0],
      [-1, 2, 0],
    ] as const;
    const front = sketchOf([{ color: HUES.leaf, corners: leaf }], SIDE);
    const back = sketchOf(
      [{ color: HUES.leaf, corners: Arr.reverse(leaf) }],
      SIDE
    );
    expect(paintedOf(front).length).toBeGreaterThan(100);
    expect(back).toEqual(front);
  });

  it("draws a body that tapers to a point, whose top has no area", () => {
    const painted = paintedOf(
      sketchOf(box([-1, 0, -1], [1, 3, 1], HUES.fir, 1), SIDE)
    );
    expect(painted.length).toBeGreaterThan(100);
    expect(Arr.every(painted, ({ ink }) => isToneOf(ink, HUES.fir))).toBe(true);
  });

  it("draws a thing of the catalogue the same every time", () => {
    const first = sketchOf(thingFaces("lantern", 0), SIDE);
    expect(paintedOf(first).length).toBeGreaterThan(20);
    expect(sketchOf(thingFaces("lantern", 0), SIDE)).toEqual(first);
  });
});

describe("swatchOf", () => {
  it("gives every brush a CSS color of its own", () => {
    const swatches = Arr.map(Brush.literals, swatchOf);
    expect(Arr.dedupe(swatches).length).toBe(Brush.literals.length);
    expect(Arr.every(swatches, (swatch) => CSS_COLOR.test(swatch))).toBe(true);
    expect(swatchOf("sand")).toBe("rgb(243 227 194)");
  });
});
