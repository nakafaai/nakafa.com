/**
 * The marks laid on a stage's ground as alpha maps: the dashes of a lane
 * line or the sleepers of a railway, and the soft verge where a strip of
 * gravel meets the ground beside it.
 */

/**
 * The dashes of a lane line as one row of `size` pixels, four bytes a pixel:
 * white along the first `dash` share of the row and black after it, as an
 * alpha map reads it.
 */
export function paintDashes(size: number, dash: number) {
  const row = new Uint8ClampedArray(size * 4);
  for (let pixel = 0; pixel < size; pixel += 1) {
    const shown = pixel < size * dash ? 255 : 0;
    row.set([shown, shown, shown, 255], pixel * 4);
  }
  return row;
}

/**
 * A soft verge as one row of `size` pixels, four bytes a pixel: black at both
 * ends and white across the middle, as an alpha map reads it, so a strip laid
 * on the ground has no cut edge.
 */
export function paintVerge(size: number, soft: number) {
  const row = new Uint8ClampedArray(size * 4);
  for (let pixel = 0; pixel < size; pixel += 1) {
    const fromEdge = Math.min(pixel, size - 1 - pixel) / (size - 1);
    const near = Math.min(1, fromEdge / soft);
    const shown = near * near * (3 - 2 * near) * 255;
    row.set([shown, shown, shown, 255], pixel * 4);
  }
  return row;
}
