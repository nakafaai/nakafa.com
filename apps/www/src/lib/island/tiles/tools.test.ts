// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { TILE } from "@/lib/island/tiles/paint";
import { feetTile, hammerTile, pickaxeTile } from "@/lib/island/tiles/tools";

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
});
