import { Array as Arr, Record as Rec, Schema } from "effect";
import {
  bookshelfTile,
  brickTile,
  cobbleTile,
  glassTile,
  goldTile,
  lanternTile,
  marbleTile,
  planksTile,
  plasterTile,
  roofTile,
  slateTile,
  woolTile,
} from "@/lib/island/tiles/built";
import {
  barkTile,
  dirtTile,
  flowersTile,
  grassSideTile,
  grassTopTile,
  gravelTile,
  leavesTile,
  ringsTile,
  sandTile,
  stoneTile,
  waterTile,
} from "@/lib/island/tiles/nature";
import { type Pixels, TILE } from "@/lib/island/tiles/paint";

/** Every tile the island draws, in atlas order (ADR 0047, D4). */
export const TILE_NAMES = [
  "grassTop",
  "grassSide",
  "dirt",
  "sand",
  "stone",
  "gravel",
  "leaves",
  "bark",
  "rings",
  "water",
  "flowers",
  "planks",
  "cobble",
  "brick",
  "roof",
  "slate",
  "plaster",
  "glass",
  "lantern",
  "wool",
  "bookshelf",
  "marble",
  "gold",
] as const;

/** The name of one tile of the atlas. */
export const TileName = Schema.Literals(TILE_NAMES);
export type TileName = typeof TileName.Type;

/** How each tile is painted from its seed; the game loads no image. */
const PAINTERS = {
  grassTop: grassTopTile,
  grassSide: grassSideTile,
  dirt: dirtTile,
  sand: sandTile,
  stone: stoneTile,
  gravel: gravelTile,
  leaves: leavesTile,
  bark: barkTile,
  rings: ringsTile,
  water: waterTile,
  flowers: flowersTile,
  planks: planksTile,
  cobble: cobbleTile,
  brick: brickTile,
  roof: roofTile,
  slate: slateTile,
  plaster: plasterTile,
  glass: glassTile,
  lantern: lanternTile,
  wool: woolTile,
  bookshelf: bookshelfTile,
  marble: marbleTile,
  gold: goldTile,
} satisfies Record<TileName, (seed: number) => Pixels>;

/** Tiles along one side of the atlas. */
export const ATLAS_TILES = 8;

/** The side of the atlas in pixels. */
export const ATLAS_SIZE = ATLAS_TILES * TILE;

/** The seed every tile is painted from, so every island and every browser draws the same tiles. */
const TEXTURE_SEED = 20_261_109;

/** The atlas slot of every tile. */
export const SLOTS = Rec.fromEntries(
  Arr.map(TILE_NAMES, (name, index) => [name, index] as const)
);

/** The pixels of one tile, painted from the shared seed and the tile's own slot. */
export function tilePixels(name: TileName) {
  return PAINTERS[name](TEXTURE_SEED + SLOTS[name] * 101);
}

/** The whole atlas as RGBA pixels, every tile in its slot, row by row. */
export function atlasPixels() {
  const atlas = new Uint8ClampedArray(ATLAS_SIZE * ATLAS_SIZE * 4);
  for (const name of TILE_NAMES) {
    const tile = tilePixels(name);
    const left = (SLOTS[name] % ATLAS_TILES) * TILE;
    const top = Math.floor(SLOTS[name] / ATLAS_TILES) * TILE;
    for (let row = 0; row < TILE; row += 1) {
      atlas.set(
        tile.subarray(row * TILE * 4, (row + 1) * TILE * 4),
        ((top + row) * ATLAS_SIZE + left) * 4
      );
    }
  }
  return atlas;
}
