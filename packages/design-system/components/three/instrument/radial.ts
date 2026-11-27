import { Array as Arr } from "effect";

/**
 * A machined, rolled or forged part whose surface is not the same all the
 * way round its axis: a thread, a hexagon head, a knurl. The author states
 * how far the surface stands from the x axis at each place along it and
 * each angle around it, and gets the vertices of the real shape, so a
 * thread is a helix that catches the light and a hexagon has true flats. A
 * part that is the same all the way round is a turn of `three/form`.
 */

/** The radius of a part at a place along its axis and an angle around it, from +y toward +z. */
type Radius = (along: number, angle: number) => number;

/**
 * The vertices of a part: one ring of `around` steps at every station along
 * the axis. A station given twice a hair apart makes a shoulder, and a
 * radius of 0 at the first and last stations closes the ends.
 *
 * @param stations - The places along the axis a ring stands at, in order
 * @param around - How many steps one ring takes around the axis
 * @param radius - How far the surface stands from the axis
 */
export function radialSurface(
  stations: readonly number[],
  around: number,
  radius: Radius
) {
  const columns = around + 1;
  const positions = new Float32Array(stations.length * columns * 3);
  const coordinates = new Float32Array(stations.length * columns * 2);
  const faces = new Uint32Array(Math.max(stations.length - 1, 0) * around * 6);
  Arr.forEach(stations, (along, ring) => {
    for (let step = 0; step < columns; step += 1) {
      const angle = (step / around) * 2 * Math.PI;
      const reach = radius(along, angle);
      const vertex = ring * columns + step;
      positions[vertex * 3] = along;
      positions[vertex * 3 + 1] = reach * Math.cos(angle);
      positions[vertex * 3 + 2] = reach * Math.sin(angle);
      coordinates[vertex * 2] = step / around;
      coordinates[vertex * 2 + 1] = along;
    }
  });
  for (let ring = 0; ring < stations.length - 1; ring += 1) {
    for (let step = 0; step < around; step += 1) {
      const corner = ring * columns + step;
      const face = (ring * around + step) * 6;
      faces[face] = corner;
      faces[face + 1] = corner + columns;
      faces[face + 2] = corner + 1;
      faces[face + 3] = corner + 1;
      faces[face + 4] = corner + columns;
      faces[face + 5] = corner + columns + 1;
    }
  }
  return { coordinates, faces, positions };
}

/** Evenly spaced stations from `from` to `to`, both ends included, `steps` apart at most. */
export function stationsBetween(from: number, to: number, steps: number) {
  const count = Math.max(1, Math.ceil(Math.abs(to - from) / steps));
  return Arr.makeBy(count + 1, (index) => from + ((to - from) * index) / count);
}

/**
 * The radius of a hexagon bar at an angle around its axis: `flats` is half
 * the distance across two opposite flats, and a corner stands at angle 0.
 */
export function hexagonRadius(flats: number, angle: number) {
  const sector = Math.PI / 3;
  const within = (((angle % sector) + sector) % sector) - sector / 2;
  return flats / Math.cos(within);
}

/**
 * The radius of a rolled V thread at a place along it and an angle around
 * it: the crest stands at `crest`, the root `depth` below it, and the groove
 * advances one `pitch` every turn, so it winds as a real helix.
 */
export function threadRadius(
  thread: {
    readonly crest: number;
    readonly depth: number;
    readonly pitch: number;
  },
  along: number,
  angle: number
) {
  const turn = along / thread.pitch - angle / (2 * Math.PI);
  const phase = turn - Math.floor(turn);
  return thread.crest - thread.depth * (1 - Math.abs(2 * phase - 1));
}
