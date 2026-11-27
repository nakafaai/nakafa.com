import {
  chanceAt,
  fractalAt,
  warpedAt,
} from "@repo/design-system/components/three/field/noise";

/** The share of a board's width that slopes into the groove at each edge. */
const GROOVE = 0.05;

/** How much darker the darkest board of a floor is than the palest. */
const BOARD_TONES = 0.24;

/** How many growth rings cross one tile of sawn wood. */
export const RINGS = 12;

/** The share of a year's growth, at its end, over which the late wood gives way to the next ring. */
const LINE = 0.06;

/**
 * Sawn wood at a place of the tile, as its `height` and its `shade`: growth
 * rings that run along the board, no two as wide or as dark as each other
 * and none of them straight, each paling slowly through its early wood and
 * ending at the hard line of its late wood; broad bands of heart and sap
 * wood under them; and long pores along the grain.
 */
export function woodAt(x: number, y: number) {
  const bend = warpedAt(x, y, 1, 2, 31, 0.2) - 0.5;
  const drift = fractalAt(x, y, 1, 4, 43, 2) - 0.5;
  const year = y * RINGS + 1.6 * bend + 1.8 * drift;
  const ring = Math.floor(year);
  const grown = year - ring;
  const hard = 0.35 + 0.65 * chanceAt(((ring % RINGS) + RINGS) % RINGS, 0, 53);
  const late =
    hard * Math.max(0, grown * 2 - 1) ** 3 * Math.min(1, (1 - grown) / LINE);
  const pores = fractalAt(x, y, 4, 160, 37, 2);
  const streak = fractalAt(x, y, 2, 40, 47, 3);
  const band = fractalAt(x, y, 1, 3, 39, 2);
  return {
    height: 0.6 + 0.5 * (pores - 0.5) - 0.25 * late,
    shade:
      1.28 -
      0.5 * late -
      0.25 * (1 - pores) -
      0.45 * (1 - band) -
      0.3 * (1 - streak),
  };
}

/**
 * Planks at a place of the tile, as their `height` and their `shade`:
 * `boards` boards of sawn wood laid side by side across the tile, each from
 * its own stretch of the tree and of its own tone, with a groove where two
 * meet.
 */
export function planksAt(x: number, y: number, boards: number) {
  const across = y * boards;
  const board = Math.floor(across);
  const within = across - board;
  const flat = Math.min(1, Math.min(within, 1 - within) / GROOVE);
  const sawn = woodAt(x + 0.37 * board, y + 0.29 * board);
  return {
    height: (0.88 + 0.12 * sawn.height) * flat ** 0.5,
    shade:
      (0.5 + 0.5 * sawn.shade) *
      (1 - BOARD_TONES * chanceAt(board, 0, 151)) *
      (0.35 + 0.65 * flat),
  };
}
