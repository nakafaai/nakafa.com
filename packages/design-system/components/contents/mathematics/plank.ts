import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";

/**
 * The top of a planked hardwood table as a tileable field of shades: boards
 * laid side by side, each sawn from its own stretch of the tree, so every
 * board has its own tone and its growth lines wander on their own, with a
 * dark seam where two boards meet. A material multiplies its colour by the
 * shade, so one field planks maple, oak and walnut alike, and nothing is
 * downloaded.
 */

/** How many boards lie side by side across one tile. */
export const BOARDS = 4;

/** How many growth lines cross one board, and how far the noise bends them. */
const LINES = 5;
const WANDER = 1.6;

/** How many patches of noise bend the lines along a tile, which is also where the noise repeats. */
const BENDS = 4;

/** The share of a board's width its seam darkens at each edge, and how dark the seam is. */
const SEAM = { shade: 0.5, width: 0.022 } as const;

/** The palest board and how much darker the darkest one is. */
const BOARD_TONES = { pale: 1, range: 0.16 } as const;

/** How much the late wood of a growth line and the fine pores darken the early wood. */
const LATE = 0.2;
const PORES = 0.07;

/**
 * The shade in (0, 1] at each texel of a `width` by `height` field, row by
 * row: the boards run along the width and lie side by side down the height.
 */
export function plankShades(width: number, height: number) {
  const field = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const across = (row / height) * BOARDS;
    const board = Math.floor(across);
    const within = across - board;
    const tone = BOARD_TONES.pale - BOARD_TONES.range * hashUnit(board, 17);
    const edge = Math.min(within, 1 - within);
    const seam = edge < SEAM.width ? SEAM.shade : 1;
    for (let column = 0; column < width; column += 1) {
      const along = column / width;
      const bend = valueNoise(
        along * BENDS + board * 7,
        within * 2 + board * 3,
        BENDS
      );
      const line = Math.sin(2 * Math.PI * (within * LINES + WANDER * bend));
      const late = line ** 8;
      const pore = valueNoise(column / 3, row * 2, width / 3);
      field[row * width + column] =
        tone * seam * (1 - LATE * late - PORES * pore);
    }
  }
  return field;
}
