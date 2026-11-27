/**
 * Turns the height of a tile into what a renderer lights it with: a normal
 * for every pixel, so the relief bends the light smoothly however close the
 * camera comes, and how much of the sky each pixel sees, so pits and seams
 * sit in their own soft shadow.
 */

/** The height at a pixel of a square tile that repeats past each edge. */
function heightAt(height: Float32Array, size: number, x: number, y: number) {
  const column = ((x % size) + size) % size;
  const row = ((y % size) + size) % size;
  return Number(height[row * size + column]);
}

/**
 * The normals of a height tile as a square image of `size` pixels, four
 * bytes a pixel, in the tangent space a renderer reads: red leans along the
 * tile, green up it, blue stands out of it. `height` holds one number from 0
 * to 1 per pixel, row by row, and `depth` is how tall its full range stands,
 * in tile widths. The slope at each pixel weighs its eight neighbours, so
 * the grid of the pixels does not show in the light.
 */
export function paintNormals(
  height: Float32Array,
  size: number,
  depth: number
) {
  const normals = new Uint8ClampedArray(size * size * 4);
  const steep = (depth * size) / 8;
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const x = pixel % size;
    const y = Math.floor(pixel / size);
    const at = (dx: number, dy: number) =>
      heightAt(height, size, x + dx, y + dy);
    const across =
      at(1, -1) +
      2 * at(1, 0) +
      at(1, 1) -
      at(-1, -1) -
      2 * at(-1, 0) -
      at(-1, 1);
    const up =
      at(-1, 1) +
      2 * at(0, 1) +
      at(1, 1) -
      at(-1, -1) -
      2 * at(0, -1) -
      at(1, -1);
    const leanX = -across * steep;
    const leanY = -up * steep;
    const length = Math.hypot(leanX, leanY, 1);
    normals.set(
      [
        (0.5 + (0.5 * leanX) / length) * 255,
        (0.5 + (0.5 * leanY) / length) * 255,
        (0.5 + 0.5 / length) * 255,
        255,
      ],
      pixel * 4
    );
  }
  return normals;
}

/** The eight directions a pixel looks in for what stands above it. */
const AROUND = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * How open each pixel of a height tile is to the sky, from 0 in a deep pit
 * to 1 in the open, one number per pixel: the more its neighbours `reach`
 * pixels away stand above it, the darker it is, by `strength`.
 */
export function paintOpenness(
  height: Float32Array,
  size: number,
  reach: number,
  strength: number
) {
  const open = new Float32Array(size * size);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const x = pixel % size;
    const y = Math.floor(pixel / size);
    const here = heightAt(height, size, x, y);
    let above = 0;
    for (const [dx, dy] of AROUND) {
      above += Math.max(
        0,
        heightAt(height, size, x + dx * reach, y + dy * reach) - here
      );
    }
    open[pixel] = Math.max(0, 1 - (strength * above) / AROUND.length);
  }
  return open;
}
