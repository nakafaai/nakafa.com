import { FARM, FARM_KEYS } from "@repo/backend/confect/island/farm";
import { PLANT_KEYS, PLANTS } from "@repo/backend/confect/island/flora";
import { Array as Arr, Schema } from "effect";

/**
 * Every block of the island game (ADR 0047, D3 and D7): the id an edit stores
 * it by, and the level of the island that opens it for building. Stored edits
 * name blocks by id, so an id is never reused or changed; 0 is air.
 */
const BUILT = {
  grass: { id: 1, opens: 1 },
  dirt: { id: 2, opens: 1 },
  sand: { id: 3, opens: 1 },
  log: { id: 4, opens: 1 },
  planks: { id: 5, opens: 1 },
  leaves: { id: 6, opens: 1 },
  flowers: { id: 7, opens: 1 },
  stone: { id: 8, opens: 2 },
  cobble: { id: 9, opens: 2 },
  glass: { id: 10, opens: 2 },
  water: { id: 11, opens: 2 },
  brick: { id: 12, opens: 3 },
  roof: { id: 13, opens: 3 },
  plaster: { id: 14, opens: 3 },
  path: { id: 15, opens: 3 },
  lantern: { id: 16, opens: 4 },
  slate: { id: 17, opens: 4 },
  wool: { id: 18, opens: 4 },
  bookshelf: { id: 19, opens: 5 },
  marble: { id: 20, opens: 6 },
  gold: { id: 21, opens: 6 },
} as const;

const CATALOG = { ...BUILT, ...PLANTS, ...FARM };

export const BlockKey = Schema.Literals([
  "grass",
  "dirt",
  "sand",
  "log",
  "planks",
  "leaves",
  "flowers",
  "stone",
  "cobble",
  "glass",
  "water",
  "brick",
  "roof",
  "plaster",
  "path",
  "lantern",
  "slate",
  "wool",
  "bookshelf",
  "marble",
  "gold",
  ...PLANT_KEYS,
  ...FARM_KEYS,
]);
export type BlockKey = typeof BlockKey.Type;

/** Every block in the order of its id, the order the block book shows. */
export const BLOCK_KEYS = BlockKey.literals;

/** The id of air, the empty cell. */
export const AIR = 0;

/** The id a block is stored by. */
export function idOf(key: BlockKey) {
  return CATALOG[key].id;
}

/** The block a stored id names, none for air or an id no block holds. */
export function keyOf(id: number) {
  return Arr.findFirst(BLOCK_KEYS, (key) => CATALOG[key].id === id);
}

/** The level that opens a block for building. */
export function opensAt(key: BlockKey) {
  return CATALOG[key].opens;
}

/** Whether an island at this level may build with this block. */
export function isOpen(key: BlockKey, level: number) {
  return CATALOG[key].opens <= level;
}
