import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { Array as Arr, Record as Rec, Schema } from "effect";
import { FAMILIES } from "@/lib/island/fauna/families";
import { SPECIES } from "@/lib/island/fauna/species";
import { FLORA } from "@/lib/island/flora/families";
import { plantLookOf } from "@/lib/island/flora/plants";
import { ninaStepTile, ninaTile } from "@/lib/island/tiles/animals";
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
import { farmlandTile, sproutTile } from "@/lib/island/tiles/farm";
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
import { emptyShape, markBody, paintShape } from "@/lib/island/tiles/shape";
import { bobberTile } from "@/lib/island/tiles/tools";

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
  "nina",
  "ninaStep",
  "bobber",
  "farmland",
  "wetFarmland",
  "riceSprout",
  "cornSprout",
  "cabbageSprout",
  "tomatoSprout",
  "chiliSprout",
  "carrotSprout",
  "cassavaSprout",
  "sweetPotatoSprout",
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
  nina: ninaTile,
  ninaStep: ninaStepTile,
  bobber: bobberTile,
  farmland: (seed: number) => farmlandTile(seed, false),
  wetFarmland: (seed: number) => farmlandTile(seed, true),
  riceSprout: () => sproutTile("lime", "sun"),
  cornSprout: () => sproutTile("leaf", "sun"),
  cabbageSprout: () => sproutTile("lime", "lime"),
  tomatoSprout: () => sproutTile("leaf", "roof"),
  chiliSprout: () => sproutTile("leaf", "rust"),
  carrotSprout: () => sproutTile("lime", "ginger"),
  cassavaSprout: () => sproutTile("leaf", "bark"),
  sweetPotatoSprout: () => sproutTile("leaf", "violet"),
} satisfies Record<TileName, (seed: number) => Pixels>;

/** Tiles along one side of the atlas: room for every block, sprite and species. */
export const ATLAS_TILES = 32;

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

/** The atlas slot of the first plant; each plant follows in the order of its id. */
export const PLANT_SLOT = TILE_NAMES.length;

/** One plant drawn by its family's shape in its own coat. */
export function plantPixels(index: number) {
  const look = plantLookOf(index);
  const shape = emptyShape();
  FLORA[look.family](shape);
  return paintShape(shape, look.coat);
}

/** One species drawn by its family's shape in its own coat and pattern, for the block book's field guide. */
export function speciesPixels(index: number) {
  const species = SPECIES[index];
  const shape = emptyShape();
  FAMILIES[species.family](shape, species.traits);
  markBody(shape, species.pattern);
  return paintShape(shape, species.coat);
}

/** Copies one tile into its slot of the atlas. */
function placeTile(atlas: Uint8ClampedArray, tile: Pixels, slot: number) {
  const left = (slot % ATLAS_TILES) * TILE;
  const top = Math.floor(slot / ATLAS_TILES) * TILE;
  for (let row = 0; row < TILE; row += 1) {
    atlas.set(
      tile.subarray(row * TILE * 4, (row + 1) * TILE * 4),
      ((top + row) * ATLAS_SIZE + left) * 4
    );
  }
}

/** The whole atlas as RGBA pixels: every named tile in its slot, then every plant, row by row. */
export function atlasPixels() {
  const atlas = new Uint8ClampedArray(ATLAS_SIZE * ATLAS_SIZE * 4);
  for (const name of TILE_NAMES) {
    placeTile(atlas, tilePixels(name), SLOTS[name]);
  }
  Arr.forEach(PLANT_KEYS, (_plant, index) =>
    placeTile(atlas, plantPixels(index), PLANT_SLOT + index)
  );
  return atlas;
}

/** The atlas coordinate of a corner of the tile in a slot, inset a hair, mirrored across when `flip`. */
export function slotUv(slot: number, u: number, v: number, flip: boolean) {
  const across = flip ? 1 - u : u;
  return [
    ((slot % ATLAS_TILES) + 0.002 + across * 0.996) / ATLAS_TILES,
    (Math.floor(slot / ATLAS_TILES) + 0.002 + v * 0.996) / ATLAS_TILES,
  ] as const;
}
