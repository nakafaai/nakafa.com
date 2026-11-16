// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { TILE } from "@/lib/island/tiles/paint";
import {
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
  it("draws the fishing rod with its tip at the cursor's hot spot, where the line leaves it", () => {
    const rod = rodTile();
    expect(rod).toHaveLength(TILE * TILE * 4);
    expect(alphaAt(rod, 15, 1)).toBe(255);
    expect(alphaAt(rod, 0, 15)).toBe(0);
    expect(rod).not.toEqual(pickaxeTile());
  });
  it("draws the hoe with its blade and the can with its spout at the cursor's hot spot", () => {
    const hoe = hoeTile();
    const can = canTile();
    expect(alphaAt(hoe, 1, 11)).toBe(255);
    expect(alphaAt(can, 1, 3)).toBe(255);
    expect(alphaAt(hoe, 15, 15)).toBe(0);
    expect(alphaAt(can, 15, 15)).toBe(0);
    expect(hoe).not.toEqual(can);
  });
});
