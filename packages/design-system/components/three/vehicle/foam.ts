import {
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";

/**
 * How dense the foam of a boat's wake is at a place of its tile, from 0 for
 * clear water to 1 for white water. `along` runs astern and tiles, so the
 * foam can drift; `across` runs from one edge of the wedge to the other. The
 * foam gathers in the two arms, where the diverging waves break along the
 * wedge's edges, and in the churned wash of the propeller down the middle,
 * and between them the water stays clear.
 *
 * @param along - The place along the wake, from 0 to 1 over one tile
 * @param across - The place across the wedge, from 0 at one edge to 1 at the other
 */
export function foamAt(along: number, across: number) {
  const out = Math.abs(across * 2 - 1);
  const arm = Math.exp(-(((out - 0.84) / 0.11) ** 2));
  const wash = Math.exp(-((out / 0.2) ** 2));
  const crests = ridgedAt(along, across, 5, 9, 11);
  const churn = fractalAt(along, across, 12, 9, 23) ** 1.5;
  return Math.min(1, arm * (0.2 + 1.1 * crests) + wash * (0.15 + 1.6 * churn));
}

/**
 * Paints the wake's foam as one square tile of white pixels whose opacity is
 * the foam's density, row by row across the wedge.
 *
 * @param size - Pixels along each side of the tile
 */
export function paintFoam(size: number) {
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      pixels[(row * size + column) * 4 + 3] =
        255 * foamAt((column + 0.5) / size, (row + 0.5) / size);
    }
  }
  return pixels;
}
