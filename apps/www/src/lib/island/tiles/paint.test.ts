// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { MutableHashSet } from "effect";
import { RAMPS, rgbOf } from "@/lib/island/palette";
import {
  blankTile,
  cellsOf,
  clumps,
  flood,
  isPainted,
  put,
  speckle,
  TILE,
} from "@/lib/island/tiles/paint";

/** The RGBA of one pixel. */
const pixelAt = (pixels: Uint8ClampedArray, x: number, y: number) =>
  pixels.slice((y * TILE + x) * 4, (y * TILE + x) * 4 + 4);

describe("island/tiles/paint", () => {
  it("starts clear and paints a tone, wrapping past the edges so patterns tile", () => {
    const pixels = blankTile();
    expect(isPainted(pixels, 0, 0)).toBe(false);
    put(pixels, -1, TILE, "grass", 2, 200);
    expect([...pixelAt(pixels, TILE - 1, 0)]).toEqual([
      ...rgbOf(RAMPS.grass[2]),
      200,
    ]);
  });

  it("floods every pixel, and speckles the same grain from the same seed", () => {
    const flooded = blankTile();
    flood(flooded, "stone", 1);
    expect(isPainted(flooded, 15, 15)).toBe(true);
    const a = blankTile();
    const b = blankTile();
    const shares = [
      [1, 0.5],
      [2, 0.5],
    ] as const;
    speckle(a, 4, "sand", shares);
    speckle(b, 4, "sand", shares);
    expect(a).toEqual(b);
    const partial = blankTile();
    speckle(partial, 4, "sand", [[1, 0.1]]);
    expect(
      isPainted(partial, 0, 0) &&
        isPainted(partial, 1, 0) &&
        isPainted(partial, 2, 0)
    ).toBe(false);
  });

  it("paints clumps lit on top and shaded under", () => {
    const pixels = blankTile();
    clumps(pixels, 3, 4, "soil", 2, 0);
    let painted = 0;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        painted += isPainted(pixels, x, y) ? 1 : 0;
      }
    }
    expect(painted).toBeGreaterThan(4);
  });

  it("splits a tile into wrapping cells with thin edges between them", () => {
    const cells = cellsOf(5, 4);
    const owners = MutableHashSet.empty<number>();
    let edges = 0;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const { edge, owner } = cells(x, y);
        MutableHashSet.add(owners, owner);
        edges += edge < 1 ? 1 : 0;
      }
    }
    expect(MutableHashSet.size(owners)).toBe(4);
    expect(edges).toBeGreaterThan(0);
    expect(edges).toBeLessThan((TILE * TILE) / 2);
  });
});
