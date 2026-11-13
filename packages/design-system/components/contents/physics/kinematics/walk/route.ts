import { Array as Arr, Schema } from "effect";

/**
 * A walk through a town, seen from above: straight legs along the streets,
 * east and north in metres, at a steady walking pace. The path length adds
 * every leg; the displacement joins the start to where the walker stands,
 * whatever way they went. Average speed divides the first by the time,
 * average velocity the second.
 */

/** One straight leg: how far east and how far north it goes, in metres (negative for west or south). */
export const LegSchema = Schema.Struct({
  east: Schema.Finite,
  north: Schema.Finite,
});
export type Leg = typeof LegSchema.Type;

/** A walk: its legs in order and the walking pace in m/s. */
export const WalkSchema = Schema.Struct({
  legs: Schema.NonEmptyArray(LegSchema),
  pace: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Walk = typeof WalkSchema.Type;

/** The corners of the walk, from the start, in metres east and north. */
export function walkCorners(walk: Walk) {
  return Arr.scan(walk.legs, { east: 0, north: 0 }, (at, leg) => ({
    east: at.east + leg.east,
    north: at.north + leg.north,
  }));
}

/** The total path length of the walk, in metres. */
export function walkLength(walk: Walk) {
  return Arr.reduce(
    walk.legs,
    0,
    (sum, leg) => sum + Math.hypot(leg.east, leg.north)
  );
}

/** How long the walk takes at its pace, in seconds. */
export function walkDuration(walk: Walk) {
  return walkLength(walk) / walk.pace;
}

/** Where the walker stands after walking `distance` metres along the path. */
export function walkPoint(walk: Walk, distance: number) {
  let left = Math.min(Math.max(distance, 0), walkLength(walk));
  let at = { east: 0, north: 0 };
  for (const leg of walk.legs) {
    const length = Math.hypot(leg.east, leg.north);
    if (left <= length) {
      const part = length === 0 ? 0 : left / length;
      return {
        east: at.east + leg.east * part,
        north: at.north + leg.north * part,
      };
    }
    left -= length;
    at = { east: at.east + leg.east, north: at.north + leg.north };
  }
  return at;
}

/**
 * The readings after `time` seconds: path length walked, the displacement
 * from the start (its size and its bearing, degrees counter-clockwise from
 * east), and the two averages over that time.
 */
export function walkReading(walk: Walk, time: number) {
  const elapsed = Math.min(Math.max(time, 0), walkDuration(walk));
  const walked = elapsed * walk.pace;
  const end = walkPoint(walk, walked);
  const displacement = Math.hypot(end.east, end.north);
  const bearing =
    displacement < 1e-9 ? 0 : (Math.atan2(end.north, end.east) * 180) / Math.PI;
  return {
    averageSpeed: elapsed === 0 ? 0 : walked / elapsed,
    averageVelocity: elapsed === 0 ? 0 : displacement / elapsed,
    bearing,
    displacement,
    elapsed,
    end,
    walked,
  };
}
