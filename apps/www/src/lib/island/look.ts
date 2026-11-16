import {
  BLOCK_KEYS,
  type BlockKey,
  idOf,
} from "@repo/backend/confect/island/blocks";
import { Schema } from "effect";
import { SLOTS, TileName } from "@/lib/island/atlas";

/**
 * How a block is drawn (ADR 0047, D3): `solid` hides what is behind it,
 * `cutout` shows through its clear pixels (glass), `liquid` is see-through and
 * drawn after everything else (water), and `cross` is two crossed planes
 * (flowers). The numbers are what the mesher reads per cell.
 */
export const KIND = {
  air: 0,
  solid: 1,
  cutout: 2,
  liquid: 3,
  cross: 4,
} as const;

/** The tiles of a block's faces, its kind, and the block light it gives, from 0 to 15 (a lantern's flame). */
const Faces = Schema.Struct({
  bottom: TileName,
  glow: Schema.optionalKey(Schema.Int),
  kind: Schema.Literals(["solid", "cutout", "liquid", "cross"]),
  side: TileName,
  top: TileName,
});
type Faces = typeof Faces.Type;

/** A block whose six faces show the same tile. */
function plain(tile: TileName, kind: Faces["kind"] = "solid"): Faces {
  return { bottom: tile, kind, side: tile, top: tile };
}

const LOOKS = {
  grass: { bottom: "dirt", kind: "solid", side: "grassSide", top: "grassTop" },
  dirt: plain("dirt"),
  sand: plain("sand"),
  log: { bottom: "rings", kind: "solid", side: "bark", top: "rings" },
  planks: plain("planks"),
  leaves: plain("leaves"),
  flowers: plain("flowers", "cross"),
  stone: plain("stone"),
  cobble: plain("cobble"),
  glass: plain("glass", "cutout"),
  water: plain("water", "liquid"),
  brick: plain("brick"),
  roof: plain("roof"),
  plaster: plain("plaster"),
  path: { bottom: "dirt", kind: "solid", side: "dirt", top: "gravel" },
  lantern: { ...plain("lantern"), glow: 15 },
  slate: plain("slate"),
  wool: plain("wool"),
  bookshelf: {
    bottom: "planks",
    kind: "solid",
    side: "bookshelf",
    top: "planks",
  },
  marble: plain("marble"),
  gold: plain("gold"),
} satisfies Record<BlockKey, Faces>;

/** The faces of one block. */
export function looksOf(key: BlockKey): Faces {
  return LOOKS[key];
}

/**
 * The look of every block id, as typed arrays the mesher reads per cell: its
 * kind (`KIND`), the atlas slots of its top, side and bottom, and its glow.
 */
function tablesOf() {
  const tables = {
    bottoms: new Uint8Array(256),
    glows: new Uint8Array(256),
    kinds: new Uint8Array(256),
    sides: new Uint8Array(256),
    tops: new Uint8Array(256),
  };
  for (const key of BLOCK_KEYS) {
    const id = idOf(key);
    const look: Faces = LOOKS[key];
    tables.kinds[id] = KIND[look.kind];
    tables.tops[id] = SLOTS[look.top];
    tables.sides[id] = SLOTS[look.side];
    tables.bottoms[id] = SLOTS[look.bottom];
    tables.glows[id] = look.glow ?? 0;
  }
  return tables;
}

export const LOOK = tablesOf();
