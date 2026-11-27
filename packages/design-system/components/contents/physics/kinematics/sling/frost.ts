import {
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";

/**
 * How frosted a sheet of pond ice is at a place of its tile, from 0 for
 * clear black ice to 1 for white: broad drifts of windblown frost, the fine
 * white cracks that run through thick ice, and the long scuffs that
 * whatever slid over it has left. `x` and `y` run from 0 to 1 over one
 * tile, and the tile repeats.
 *
 * @param x - The place across the tile
 * @param y - The place along the tile
 */
export function frostAt(x: number, y: number) {
  const drift = Math.max(0, (fractalAt(x, y, 4, 4, 71) - 0.4) * 2.4);
  const crack = ridgedAt(x, y, 3, 3, 83, 3) ** 16;
  const scuff = fractalAt(x, y, 46, 3, 89, 2) ** 4;
  return Math.min(1, drift + 0.85 * crack + 0.6 * scuff);
}

/**
 * Paints one square tile of pond ice as opaque grey pixels, dark where the
 * ice is clear and white where it is frosted. Worn as a colour it mottles
 * the ice, and worn as a roughness it leaves the clear ice glossy and the
 * frost dull.
 *
 * @param size - Pixels along each side of the tile
 */
export function paintFrost(size: number) {
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const tone =
        110 + 145 * frostAt((column + 0.5) / size, (row + 0.5) / size);
      const at = (row * size + column) * 4;
      pixels[at] = tone;
      pixels[at + 1] = tone;
      pixels[at + 2] = tone;
    }
  }
  return pixels;
}
