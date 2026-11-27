/**
 * Wraps a model that came without texture coordinates in a box: each vertex
 * is laid flat on the face of a box its normal leans toward most, so a tiling
 * surface runs across every flat panel at its true size and only the edges
 * of the box seam.
 *
 * @param places - The model's vertices, as x, y and z in turn
 * @param normals - Each vertex's normal, as x, y and z in turn
 * @param tiles - How many tiles of a surface cross one unit of the model
 * @returns Each vertex's texture coordinates, as u and v in turn
 */
export function boxWrap(
  places: ArrayLike<number>,
  normals: ArrayLike<number>,
  tiles: number
) {
  const count = Math.floor(places.length / 3);
  const wrapped = new Float32Array(count * 2);
  for (let vertex = 0; vertex < count; vertex += 1) {
    const at = vertex * 3;
    const x = Number(places[at]) * tiles;
    const y = Number(places[at + 1]) * tiles;
    const z = Number(places[at + 2]) * tiles;
    const leanX = Math.abs(Number(normals[at]));
    const leanY = Math.abs(Number(normals[at + 1]));
    const leanZ = Math.abs(Number(normals[at + 2]));
    const sideways = leanX >= leanY && leanX >= leanZ;
    const upright = !sideways && leanY >= leanZ;
    wrapped[vertex * 2] = sideways ? z : x;
    wrapped[vertex * 2 + 1] = upright ? z : y;
  }
  return wrapped;
}
