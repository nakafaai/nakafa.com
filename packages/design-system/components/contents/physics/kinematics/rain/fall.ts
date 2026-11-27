/**
 * Where the drops of a steady rain and the car driving through it are at a
 * moment. The rain fills a box of air that travels with the camera, and the
 * car drives a loop of road, so the shower and the drive never end however
 * long a learner watches.
 */

/** The share of a length that is left after whole lengths are taken away. */
function wrap(value: number) {
  return value - Math.floor(value);
}

/**
 * The height of a drop over the road, in metres: it starts at its own share
 * of the way down from the cloud base, falls, and starts again at the top
 * once it reaches the road.
 *
 * @param start - The share of the fall the drop starts at, from 0 to 1
 * @param fallen - How far the rain has fallen so far, in metres
 * @param ceiling - The height the drops start from, in metres
 */
export function dropHeight(start: number, fallen: number, ceiling: number) {
  return ceiling * (1 - wrap(start + fallen / ceiling));
}

/**
 * Where a drop is along the road, in metres: it keeps its own place in the
 * air, and the box of rain the camera sees is laid around the camera, so a
 * drop the camera has left behind is met again ahead.
 *
 * @param start - The drop's own place, as a share of the box from 0 to 1
 * @param centre - Where the middle of the box is along the road, in metres
 * @param span - The length of the box along the road, in metres
 */
export function dropAlong(start: number, centre: number, span: number) {
  return centre + (wrap(start - centre / span) - 0.5) * span;
}

/**
 * Where the car is along its loop of road, in metres from the middle of the
 * loop: it drives off one end and comes in again at the other.
 *
 * @param driven - How far the car has driven so far, in metres
 * @param loop - The length of the loop, in metres
 */
export function carAlong(driven: number, loop: number) {
  return (wrap(driven / loop + 0.5) - 0.5) * loop;
}
