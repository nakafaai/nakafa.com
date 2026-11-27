import { Array as Arr } from "effect";

/** How finely the cloth is cut along its fly and down its hoist. */
const ALONG = 18;
const DOWN = 6;

/**
 * How far the cloth of a pennant stands out of its own plane at a place, in
 * metres: nothing at the hoist, where it is laced to the pole, and a wave
 * that grows toward the fly and travels along it as the wind does.
 *
 * @param along - The share of the fly, from 0 at the pole to 1 at the point
 * @param time - The wind's time, in seconds
 * @param fly - The length of the pennant, in metres
 */
export function rippleAt(along: number, time: number, fly: number) {
  return (
    fly * 0.09 * along * Math.sin(along * 7.5 - time * 5.2) +
    fly * 0.03 * along * Math.sin(along * 15 - time * 8.1 + 1)
  );
}

/**
 * A triangular pennant as a sheet of triangles, in metres, flat in the
 * plane z = 0: its hoist runs down the pole from the origin and its fly
 * tapers to a point `fly` metres out along +x, level with the middle of the
 * hoist. Every vertex carries how far along the fly it is, so the cloth can
 * be rippled without rebuilding it.
 *
 * @param fly - The length of the pennant, in metres
 * @param hoist - The height of the pennant at the pole, in metres
 */
export function pennantSheet(fly: number, hoist: number) {
  const vertices = Arr.flatMap(Arr.range(0, ALONG), (column) => {
    const along = column / ALONG;
    return Arr.map(Arr.range(0, DOWN), (row) => ({
      along,
      position: [
        fly * along,
        -hoist / 2 - (row / DOWN - 0.5) * hoist * (1 - along),
        0,
      ],
    }));
  });
  return {
    alongs: Arr.map(vertices, (vertex) => vertex.along),
    indices: Arr.flatMap(Arr.range(0, ALONG - 1), (column) =>
      Arr.flatMap(Arr.range(0, DOWN - 1), (row) => {
        const a = column * (DOWN + 1) + row;
        const b = a + DOWN + 1;
        return [a, a + 1, b, b, a + 1, b + 1];
      })
    ),
    positions: Arr.flatMap(vertices, (vertex) => vertex.position),
  };
}
