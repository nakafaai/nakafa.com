// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { MutableHashSet } from "effect";
import { colorOf } from "@/lib/island/palette";
import { blankTile, flood, TILE } from "@/lib/island/tiles/paint";
import {
  markOf,
  WANG_EDGES,
  WANG_SET,
  wangTile,
} from "@/lib/island/tiles/wang";

/** Plain soil, the same from every seed, so only the marks tell two tiles apart. */
function plain() {
  const pixels = blankTile();
  flood(pixels, "soil", 1);
  return pixels;
}

/** A row mark three wide and two tall, split between its rows, and a column mark two wide and three tall. */
const MARKS = [
  markOf(1, ["aaa", "bbb"], { a: ["sand", 3], b: ["sand", 0] }),
  markOf(1, ["ab", "ab", "ab"], { a: ["stone", 3], b: ["stone", 0] }),
] as const;

/** The color of one pixel of a tile, as red, green and blue. */
function colorAt(pixels: Uint8ClampedArray, x: number, y: number) {
  const at = (y * TILE + x) * 4;
  return [pixels[at], pixels[at + 1], pixels[at + 2]];
}

describe("island/tiles/wang", () => {
  it("joins a row mark across the edge two tiles share, half in each", () => {
    const north = wangTile(plain, MARKS, 1, WANG_EDGES.south);
    const south = wangTile(plain, MARKS, 1, WANG_EDGES.north);
    // The mark's first row is the last row of the tile to the north, its second the first row of the one to the south, both centered on column 5.
    for (const x of [4, 5, 6]) {
      expect(colorAt(north, x, TILE - 1)).toEqual([...colorOf("sand", 3)]);
      expect(colorAt(south, x, 0)).toEqual([...colorOf("sand", 0)]);
    }
    expect(colorAt(north, 7, TILE - 1)).toEqual([...colorOf("soil", 1)]);
    // A tile draws only its own half: the southern tile's last row stays plain.
    expect(colorAt(south, 5, TILE - 1)).toEqual([...colorOf("soil", 1)]);
  });

  it("joins a column mark across the edge two tiles share, half in each", () => {
    const west = wangTile(plain, MARKS, 1, WANG_EDGES.east);
    const east = wangTile(plain, MARKS, 1, WANG_EDGES.west);
    // Centered on row 9: the mark's first column ends the western tile, its second starts the eastern one.
    for (const y of [8, 9, 10]) {
      expect(colorAt(west, TILE - 1, y)).toEqual([...colorOf("stone", 3)]);
      expect(colorAt(east, 0, y)).toEqual([...colorOf("stone", 0)]);
    }
    expect(colorAt(east, 0, 11)).toEqual([...colorOf("soil", 1)]);
  });

  it("leaves an unmarked tile as its ground painted, and paints each tile of a set from its own seed", () => {
    expect(wangTile(plain, MARKS, 1, 0)).toEqual(plain());
    // Tile 0 is painted from the set's own seed, the tile the block shows in the hand.
    wangTile(
      (seed) => {
        expect(seed).toBe(1);
        return plain();
      },
      MARKS,
      1,
      0
    );
    const seeds = MutableHashSet.empty<number>();
    for (let index = 0; index < WANG_SET; index += 1) {
      wangTile(
        (seed) => {
          MutableHashSet.add(seeds, seed);
          return plain();
        },
        MARKS,
        1,
        index
      );
    }
    expect(MutableHashSet.size(seeds)).toBe(WANG_SET);
  });
});
