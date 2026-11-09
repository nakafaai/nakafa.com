// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet, Record as Rec } from "effect";
import {
  ATLAS_SIZE,
  ATLAS_TILES,
  atlasPixels,
  SLOTS,
  TILE_NAMES,
  tilePixels,
} from "@/lib/island/atlas";
import { TILE } from "@/lib/island/tiles/paint";

/** How many of a tile's pixels are clear. */
const clearOf = (pixels: Uint8ClampedArray) =>
  Arr.filter(
    Arr.makeBy(TILE * TILE, (index) => pixels[index * 4 + 3]),
    (alpha) => alpha === 0
  ).length;

/** The tiles a block or a sprite shows the world through, around its shape. */
const SEE_THROUGH = [
  "glass",
  "flowers",
  "hen",
  "henStep",
  "duck",
  "nina",
  "ninaStep",
  "catTop",
  "catBottom",
  "catStep",
  "rabbitTop",
  "rabbitBottom",
  "rabbitStep",
  "bearTop",
  "bearBottom",
  "bearStep",
  "foxTop",
  "foxBottom",
  "foxStep",
];

describe("island/atlas", () => {
  it("gives every tile its own slot, all of them inside the atlas", () => {
    const slots = Rec.values(SLOTS);
    expect(HashSet.size(HashSet.fromIterable(slots))).toBe(TILE_NAMES.length);
    expect(Math.max(...slots)).toBeLessThan(ATLAS_TILES * ATLAS_TILES);
  });

  it("paints every tile the same in every browser", () => {
    for (const name of TILE_NAMES) {
      expect(tilePixels(name)).toEqual(tilePixels(name));
    }
  });

  it("paints solid tiles edge to edge, and leaves glass, flowers, animals and villagers see-through", () => {
    for (const name of TILE_NAMES) {
      const clear = clearOf(tilePixels(name));
      if (Arr.contains(SEE_THROUGH, name)) {
        expect(clear, name).toBeGreaterThan(TILE * 2);
      } else {
        expect(clear, name).toBe(0);
      }
    }
  });

  it("copies each tile into its slot of the atlas", () => {
    const atlas = atlasPixels();
    expect(atlas).toHaveLength(ATLAS_SIZE * ATLAS_SIZE * 4);
    const slot = SLOTS.brick;
    const left = (slot % ATLAS_TILES) * TILE;
    const top = Math.floor(slot / ATLAS_TILES) * TILE;
    const tile = tilePixels("brick");
    for (const [x, y] of [
      [0, 0],
      [7, 9],
      [15, 15],
    ] as const) {
      const at = ((top + y) * ATLAS_SIZE + left + x) * 4;
      expect([...atlas.slice(at, at + 4)]).toEqual([
        ...tile.slice((y * TILE + x) * 4, (y * TILE + x) * 4 + 4),
      ]);
    }
  });
});
