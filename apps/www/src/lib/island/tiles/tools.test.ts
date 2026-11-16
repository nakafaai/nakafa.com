// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { TILE } from "@/lib/island/tiles/paint";
import {
  bobberTile,
  canTile,
  feetTile,
  hammerTile,
  hoeTile,
  pickaxeTile,
  rodTile,
} from "@/lib/island/tiles/tools";

/** The opacity of one pixel of a tile. */
const alphaAt = (pixels: Uint8ClampedArray, x: number, y: number) =>
  pixels[(y * TILE + x) * 4 + 3];

describe("island/tiles/tools", () => {
  it("draws each hand's cursor as its own picture, the pickaxe and hammer with their point at the cursor's hot spot", () => {
    const pickaxe = pickaxeTile();
    const hammer = hammerTile();
    const feet = feetTile();
    expect(pickaxe).toHaveLength(TILE * TILE * 4);
    expect(alphaAt(pickaxe, 1, 1)).toBe(255);
    expect(alphaAt(hammer, 1, 1)).toBe(255);
    expect(alphaAt(pickaxe, 15, 15)).toBe(0);
    expect(alphaAt(feet, 3, 1)).toBe(255);
    expect(pickaxe).not.toEqual(hammer);
    expect(hammer).not.toEqual(feet);
  });

  it("draws the rod, its float, the hoe and the watering can, each a picture of its own", () => {
    const tiles = [rodTile(), bobberTile(), hoeTile(), canTile()];
    for (const tile of tiles) {
      expect(tile).toHaveLength(TILE * TILE * 4);
      expect(
        Arr.some(
          Arr.fromIterable(tile),
          (value, index) => index % 4 === 3 && value === 255
        )
      ).toBe(true);
    }
    expect(tiles[0]).not.toEqual(tiles[1]);
    expect(tiles[1]).not.toEqual(tiles[2]);
    expect(tiles[2]).not.toEqual(tiles[3]);
  });
});
