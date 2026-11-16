import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import {
  GROUND_SLOT,
  GROUND_TILES,
  groundSlot,
  SLOTS,
} from "@/lib/island/atlas";
import { KIND, LOOK } from "@/lib/island/look";
import { unitOf } from "@/lib/island/noise";
import { WANG_SET } from "@/lib/island/tiles/wang";
import { blockAt, type Cells, cellOf, SEA_LEVEL } from "@/lib/island/world";

/**
 * The ground of the island (ADR 0047, D39): what tops each column, and how a
 * ground top is drawn. Sand, soil, a path and grass each draw from a Wang set
 * of sixteen tiles, chosen by which of the top's four edges carry the set's
 * mark, so no two blocks of a meadow look the same and no grid shows. Where
 * two grounds meet at one height, the painter blends them art pixel by art
 * pixel from the column map, so a path wears into the grass and a beach
 * frays into it instead of meeting it in a square.
 */

/** The share of edges that carry their set's mark. */
const MARKED = 0.3;

/** The seed the edges are marked from, the same on every island, so the ground of a block never changes with its world. */
const EDGES = 39;

/**
 * For each block id, its ground: 0 for a block that is no ground, else its
 * set's place in `GROUND_TILES` plus 1, read from the tile the block shows on
 * top, so the column map numbers a ground the way the atlas lays its sets.
 */
const GROUNDS = Uint8Array.from(LOOK.tops, (top, block) =>
  LOOK.kinds[block] === KIND.solid
    ? Option.match(
        Arr.findFirstIndex(GROUND_TILES, (name) => SLOTS[name] === top),
        { onNone: () => 0, onSome: (index) => index + 1 }
      )
    : 0
);

/** The ground a block draws its top from, 0 for none: its set's place in `GROUND_TILES` plus 1. */
export function groundOf(block: number) {
  return GROUNDS[block];
}

/** Whether the edge before column (x, z) carries its set's mark: along x for a north edge, along z for a west one. */
function markedAt(x: number, z: number, west: boolean) {
  return unitOf(EDGES, x * 2 + (west ? 1 : 0), z) < MARKED ? 1 : 0;
}

/**
 * The tile of its Wang set a ground top at column (x, z) draws: one bit for
 * each marked edge, north, east, south and west. Two neighbours read the edge
 * they share alike, so a mark drawn across it joins.
 */
export function wangOf(x: number, z: number) {
  return (
    markedAt(x, z, false) +
    markedAt(x + 1, z, true) * 2 +
    markedAt(x, z + 1, false) * 4 +
    markedAt(x, z, true) * 8
  );
}

/** The atlas slot of a ground top at column (x, z): its ground's tile for the marks of its edges. */
export function groundTopSlot(ground: number, x: number, z: number) {
  return groundSlot(ground - 1, wangOf(x, z));
}

/** The highest cell of each column that stops the sky, -1 for an empty column. */
export function skylineOf(cells: Cells) {
  const skyline = new Int8Array(SPAN * SPAN).fill(-1);
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      for (let y = HEIGHT - 1; y >= 0; y -= 1) {
        const kind = LOOK.kinds[cells[cellOf(x, y, z)]];
        if (kind === KIND.solid || kind === KIND.liquid) {
          skyline[z * SPAN + x] = y;
          break;
        }
      }
    }
  }
  return skyline;
}

/**
 * The column map: two bytes for each column of the world, which the shaders
 * read. The first is twice the height a falling drop stops at, plus one when
 * it stops on water, where it rings instead of splashing (D33); an empty
 * column, open to the sea floor, reads as the sea. The second is the ground
 * of the column's top, 0 when its top is no ground.
 */
export function columnsOf(cells: Cells) {
  const skyline = skylineOf(cells);
  const columns = new Uint8Array(SPAN * SPAN * 2);
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      const top = skyline[z * SPAN + x];
      const block = top < 0 ? 0 : blockAt(cells, x, top, z);
      const liquid = top < 0 || LOOK.kinds[block] === KIND.liquid;
      const height = top < 0 ? SEA_LEVEL : top + 1;
      columns[(z * SPAN + x) * 2] = height * 2 + (liquid ? 1 : 0);
      columns[(z * SPAN + x) * 2 + 1] = top < 0 ? 0 : groundOf(block);
    }
  }
  return columns;
}

/** The column map's number for grass, the ground the wind's gusts show on. */
const GRASS = Option.getOrThrow(
  Arr.findFirstIndex(GROUND_TILES, (name) => name === "grassTop")
);

/**
 * The ground on the GPU (D39), for the program that draws the blocks, which
 * gives it `hashOf` and `noiseOf`. `groundAt` is the ground an art pixel of a
 * top shows: each of the four columns round the pixel votes for its own
 * ground by how near it stands, a column at another height or with no ground
 * on top votes for the top's own, a still noise of the place tips a close
 * vote so the border frays, and a later ground gets a little more, so grass
 * spreads over a path and a beach. Every pixel is decided from the world
 * alone, so the two tops on either side of a border agree on it.
 */
export const GROUND_GLSL = `
uniform sampler2D uColumns;
const float GROUND_SLOT = ${GROUND_SLOT.toFixed(1)};
const float WANG = ${WANG_SET.toFixed(1)};
const float GRASS = ${(GRASS + 1).toFixed(1)};
float groundOfSlot(float slot) {
  float set = slot - GROUND_SLOT;
  return set >= 0.0 && set < ${(GROUND_TILES.length * WANG_SET).toFixed(1)} ? floor(set / WANG) + 1.0 : 0.0;
}
float groundAt(vec2 art, float top, float own) {
  vec2 corner = art - 0.5;
  vec2 base = floor(corner);
  vec2 t = corner - base;
  float votes[${GROUND_TILES.length + 1}];
  for (int index = 0; index <= ${GROUND_TILES.length}; index++) {
    votes[index] = 0.0;
  }
  for (int index = 0; index < 4; index++) {
    vec2 side = vec2(float(index & 1), float(index >> 1));
    vec2 cell = base + side;
    float ground = own;
    if (all(greaterThanEqual(cell, vec2(0.0))) && all(lessThan(cell, vec2(${SPAN.toFixed(1)})))) {
      vec2 column = floor(texelFetch(uColumns, ivec2(cell), 0).rg * 255.0 + 0.5);
      if (column.y > 0.5 && floor(column.x * 0.5) - 1.0 == top) ground = column.y;
    }
    votes[int(ground)] += mix(1.0 - t.x, t.x, side.x) * mix(1.0 - t.y, t.y, side.y);
  }
  if (votes[int(own)] > 0.999) return own;
  float chosen = own;
  float best = -1.0;
  for (int index = 1; index <= ${GROUND_TILES.length}; index++) {
    float ground = float(index);
    float score = votes[index] + (noiseOf(art * 2.5 + ground * 13.7) - 0.5) * 0.5 + (hashOf(floor(art * 16.0) + ground * 3.1) - 0.5) * 0.12 + ground * 0.05;
    if (votes[index] > 0.0 && score > best) {
      best = score;
      chosen = ground;
    }
  }
  return chosen;
}`;
