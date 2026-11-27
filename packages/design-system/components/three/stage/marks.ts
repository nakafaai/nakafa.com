import { fractalAt } from "@repo/design-system/components/three/field/noise";

/**
 * The marks laid on a stage's ground as alpha maps: the sleepers of a
 * railway, the paint of a road line with the wear traffic leaves on it, the
 * paths wheels polish into asphalt, and the soft verge where a strip of
 * gravel meets the ground beside it.
 */

/** A number held between 0 and 1. */
function held(value: number) {
  return Math.min(1, Math.max(0, value));
}

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

/**
 * The paint of a road line as an image `width` pixels along the line and
 * `height` across it, four bytes a pixel, as an alpha map reads it: painted
 * along the first `dash` share of its length and bare after it, a solid
 * line when `dash` is 1. Traffic and weather have worn it: its edges are
 * eaten unevenly, and flakes have come off where the binder let go. The
 * image repeats along its length without a seam.
 */
export function paintLine(width: number, height: number, dash: number) {
  const image = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const along = (pixel % width) / width;
    const across = (Math.floor(pixel / width) + 0.5) / height;
    const flakes = fractalAt(along, across, 28, 3, 503, 3);
    const eaten = 0.16 * fractalAt(along, across, 40, 2, 509, 2);
    const fromSide = Math.min(across, 1 - across) - eaten;
    const fromEnd = dash >= 1 ? 1 : Math.min(along, dash - along) * 6 - eaten;
    const shown =
      held(fromSide * 9) * held(fromEnd * 9) * held((flakes - 0.3) * 7) * 255;
    image.set([shown, shown, shown, 255], pixel * 4);
  }
  return image;
}

/**
 * The path wheels polish into a lane as a square image of `size` pixels,
 * four bytes a pixel, as an alpha map reads it: strongest along the middle
 * of the path and gone at both sides, and stronger and weaker along its
 * length as the surface took the wear. It repeats along its length without
 * a seam.
 */
export function paintWorn(size: number) {
  const image = new Uint8ClampedArray(size * size * 4);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const along = (pixel % size) / size;
    const across = (Math.floor(pixel / size) + 0.5) / size;
    const middle = Math.sin(Math.PI * across) ** 2;
    const taken = 0.35 + 0.65 * fractalAt(along, across, 6, 2, 521, 3);
    const shown = middle * taken * 255;
    image.set([shown, shown, shown, 255], pixel * 4);
  }
  return image;
}
