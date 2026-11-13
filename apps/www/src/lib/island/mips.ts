import { Array as Arr } from "effect";

/**
 * One image at half its side: each pixel the average of the four it covers,
 * colors weighted by how opaque they are, so a leaf's edge does not darken
 * toward the clear pixels around it.
 */
function halve(pixels: Uint8ClampedArray, side: number) {
  const half = side / 2;
  const out = new Uint8ClampedArray(half * half * 4);
  for (let y = 0; y < half; y += 1) {
    for (let x = 0; x < half; x += 1) {
      const corners = [
        (y * 2 * side + x * 2) * 4,
        (y * 2 * side + x * 2 + 1) * 4,
        ((y * 2 + 1) * side + x * 2) * 4,
        ((y * 2 + 1) * side + x * 2 + 1) * 4,
      ];
      const alpha = Arr.reduce(corners, 0, (sum, at) => sum + pixels[at + 3]);
      const at = (y * half + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        out[at + channel] =
          alpha === 0
            ? 0
            : Arr.reduce(
                corners,
                0,
                (sum, corner) =>
                  sum + pixels[corner + channel] * pixels[corner + 3]
              ) / alpha;
      }
      out[at + 3] = alpha / 4;
    }
  }
  return out;
}

/**
 * Every mip level of an atlas of square tiles (ADR 0047, D20), from the full
 * image down to one pixel a tile. A tile's smaller levels hold only its own
 * pixels, never a neighbour's, so a far face reads as its own color instead
 * of the noise of every pixel it once held.
 */
export function mipsOf(pixels: Uint8ClampedArray, side: number, tile: number) {
  let current = pixels;
  let levels: readonly Uint8ClampedArray[] = [pixels];
  for (let size = side, cell = tile; cell > 1; size /= 2, cell /= 2) {
    current = halve(current, size);
    levels = Arr.append(levels, current);
  }
  return levels;
}
