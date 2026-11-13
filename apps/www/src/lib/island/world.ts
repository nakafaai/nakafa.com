import { AIR } from "@repo/backend/confect/island/blocks";
import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";

/*
 * The island's world in the browser (ADR 0047, D3): a grid of cells `SPAN`
 * wide, `SPAN` deep and `HEIGHT` high, the sizes the server checks edits
 * against, one block id a cell. `x` runs east, `y` up and `z` south.
 */

/** The water's surface: the top of the highest water cell. */
export const SEA_LEVEL = 8;

/** The side of a chunk: the world is meshed and redrawn 16 by 16 columns at a time. */
export const CHUNK = 16;

/** The chunks along one side of the world. */
export const CHUNKS = SPAN / CHUNK;

/** A world's cells, one block id each, in the order of `cellOf`. */
export type Cells = Uint8Array;

/** A new world with nothing in it. */
export function emptyCells(): Cells {
  return new Uint8Array(SPAN * HEIGHT * SPAN);
}

/** Whether a cell lies inside the world. */
export function isInside(x: number, y: number, z: number) {
  return x >= 0 && x < SPAN && y >= 0 && y < HEIGHT && z >= 0 && z < SPAN;
}

/** The index of a cell inside the world: rows of `x`, then `z`, then layers of `y`. */
export function cellOf(x: number, y: number, z: number) {
  return (y * SPAN + z) * SPAN + x;
}

/** The block of a cell, air outside the world. */
export function blockAt(cells: Cells, x: number, y: number, z: number) {
  return isInside(x, y, z) ? cells[cellOf(x, y, z)] : AIR;
}
