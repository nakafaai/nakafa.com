import { AIR } from "@repo/backend/confect/island/blocks";

/**
 * The island's world (ADR 0047, D3): a grid of cells `SPAN` wide, `SPAN` deep
 * and `HEIGHT` high, one block id a cell. The grid keeps the widest footprint
 * at every level, so a cell keeps its coordinates while the island grows
 * around its middle. `x` runs east, `y` up and `z` south.
 */
export const SPAN = 64;

/** The cells from the sea floor to the sky. */
export const HEIGHT = 32;

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

/**
 * The first and last cell, inclusive, of the footprint an island of this side
 * covers: a square in the middle of the world.
 */
export function footprintOf(size: number) {
  const from = (SPAN - size) / 2;
  return { from, to: from + size - 1 };
}
