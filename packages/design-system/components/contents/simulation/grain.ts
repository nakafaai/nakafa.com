/**
 * Deterministic value noise for procedural surfaces: asphalt aggregate,
 * gravel, packed snow. The same coordinates always give the same grain, so a
 * surface looks the same on every visit and in every test, and nothing is
 * downloaded.
 */

/**
 * A well-scattered number in [0, 1) for two integers: the fractional part of
 * a large multiple of a sine, the hash shaders use, taken twice so nearby
 * cells share no pattern.
 */
export function hashUnit(x: number, y: number) {
  const first = Math.sin(x * 127.1 + y * 311.7) * 43_758.545_312_3;
  const second =
    Math.sin((first - Math.floor(first)) * 269.5 + x * 183.3) * 43_758.545_312_3;
  return second - Math.floor(second);
}

/** Smooth value noise in [0, 1) at a point, tiling every `period` cells. */
export function valueNoise(x: number, y: number, period: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wrap = (value: number) => ((value % period) + period) % period;
  const corner = (dx: number, dy: number) =>
    hashUnit(wrap(x0 + dx), wrap(y0 + dy));
  const top = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * sx;
  const bottom = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

/**
 * A tileable grain of `size` × `size` values in [0, 1): three octaves of
 * value noise, coarse patches under fine speckle, as a road's aggregate
 * shows.
 */
export function grainField(size: number) {
  const field = new Float32Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const coarse = valueNoise(column / 32, row / 32, size / 32);
      const middle = valueNoise(column / 8, row / 8, size / 8);
      const fine = hashUnit(column, row);
      field[row * size + column] = 0.5 * coarse + 0.3 * middle + 0.2 * fine;
    }
  }
  return field;
}
