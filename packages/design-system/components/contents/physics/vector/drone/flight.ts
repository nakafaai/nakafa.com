import { Array as Arr, Schema } from "effect";

/**
 * A drone flight from its pad: straight legs east, north and up, in metres.
 * The path length adds every leg; the displacement joins the pad to where
 * the drone hovers, and its three components are the sums of the legs'
 * components. Scaling the flight plan by a number scales every component,
 * so the displacement keeps its line and stretches, shrinks or turns back.
 */

/** One straight leg of the flight: metres east, north and up (negative for west, south and down). */
const HopSchema = Schema.Struct({
  east: Schema.Finite,
  north: Schema.Finite,
  up: Schema.Finite,
});
export type Hop = typeof HopSchema.Type;

/** A flight plan: its legs in order. */
export const HopsSchema = Schema.NonEmptyArray(HopSchema);

/** Every leg of a plan multiplied by a number. */
export function scaleHops(hops: readonly [Hop, ...Hop[]], factor: number) {
  return Arr.map(hops, (hop) => ({
    east: hop.east * factor,
    north: hop.north * factor,
    up: hop.up * factor,
  }));
}

/** The corners of the flight from the pad, in metres. */
export function hopCorners(hops: readonly Hop[]) {
  return Arr.scan(hops, { east: 0, north: 0, up: 0 }, (at, hop) => ({
    east: at.east + hop.east,
    north: at.north + hop.north,
    up: at.up + hop.up,
  }));
}

/** The length of one leg, in metres. */
function hopLength(hop: Hop) {
  return Math.hypot(hop.east, hop.north, hop.up);
}

/** The total path length, in metres. */
export function pathLength(hops: readonly Hop[]) {
  return Arr.reduce(hops, 0, (sum, hop) => sum + hopLength(hop));
}

/** The displacement from the pad to the last corner: its components and its size, in metres. */
export function displacement(hops: readonly Hop[]) {
  const east = Arr.reduce(hops, 0, (sum, hop) => sum + hop.east);
  const north = Arr.reduce(hops, 0, (sum, hop) => sum + hop.north);
  const up = Arr.reduce(hops, 0, (sum, hop) => sum + hop.up);
  return { east, north, size: Math.hypot(east, north, up), up };
}

/** Where the drone is after flying `distance` metres along the path; past the end it hovers at the last corner. */
export function hopPoint(hops: readonly [Hop, ...Hop[]], distance: number) {
  const corners = hopCorners(hops);
  let left = Math.max(distance, 0);
  let index = 0;
  while (index < hops.length - 1 && left > hopLength(hops[index])) {
    left -= hopLength(hops[index]);
    index += 1;
  }
  const hop = hops[index];
  const start = corners[index];
  const length = hopLength(hop);
  const part = length === 0 ? 0 : Math.min(left / length, 1);
  return {
    east: start.east + hop.east * part,
    north: start.north + hop.north * part,
    up: start.up + hop.up * part,
  };
}
