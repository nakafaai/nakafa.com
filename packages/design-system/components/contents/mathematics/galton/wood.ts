import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";

/**
 * The grain of sawn hardwood as a tileable field of shades: long growth
 * lines that wander along the board, darker late wood between paler early
 * wood, and fine pores. A material multiplies its colour by the shade, so
 * one field grains walnut, maple and oak alike, and nothing is downloaded.
 */

/** How many growth lines cross the field, and how far the noise bends them. */
const LINES = 9;
const WANDER = 0.9;

/** The palest and the darkest shade of the grain. */
const PALE = 1;
const DARK = 0.68;

/**
 * The shade in [DARK, PALE] at each texel of a `width` × `height` field,
 * row by row, its lines running along the width.
 */
export function woodGrain(width: number, height: number) {
  const field = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const across = row / height;
      const bend = valueNoise((column / width) * 6, across * 3, 6);
      const line = Math.sin(2 * Math.PI * (across * LINES + WANDER * bend));
      const late = line ** 8;
      const pore = valueNoise(column / 2, row / 2, width / 2) * 0.12;
      field[row * width + column] =
        PALE - (PALE - DARK) * Math.min(1, late * 0.85 + pore);
    }
  }
  return field;
}
