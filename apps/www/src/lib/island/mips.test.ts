// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { mipsOf } from "@/lib/island/mips";

/** An image of `side` pixels a side, every pixel from `paint`. */
function imageOf(
  side: number,
  paint: (x: number, y: number) => readonly [number, number, number, number]
) {
  const pixels = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      pixels.set(paint(x, y), (y * side + x) * 4);
    }
  }
  return pixels;
}

describe("island/mips", () => {
  it("halves an atlas down to one pixel a tile, and keeps each tile's own color at every level", () => {
    // Two 4 px tiles side by side: red on the left, blue on the right.
    const atlas = imageOf(8, (x) =>
      x < 4 ? [200, 0, 0, 255] : [0, 0, 200, 255]
    );
    const levels = mipsOf(atlas, 8, 4);
    expect(Arr.map(levels, (level) => level.length)).toEqual([256, 64, 16]);
    expect(Array.from(levels[2].subarray(0, 4))).toEqual([200, 0, 0, 255]);
    expect(Array.from(levels[2].subarray(4, 8))).toEqual([0, 0, 200, 255]);
  });

  it("weighs colors by their opacity, so a leaf's edge keeps its green over clear pixels", () => {
    const leaf = imageOf(2, (x, y) =>
      x === 0 && y === 0 ? [40, 160, 40, 255] : [255, 255, 255, 0]
    );
    const [, one] = mipsOf(leaf, 2, 2);
    expect(Array.from(one)).toEqual([40, 160, 40, 64]);
    const clear = mipsOf(
      imageOf(2, () => [9, 9, 9, 0]),
      2,
      2
    )[1];
    expect(Array.from(clear)).toEqual([0, 0, 0, 0]);
  });
});
