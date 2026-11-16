import { Schema } from "effect";

/**
 * A standard 400 m athletics track (World Athletics Track and Field Facilities
 * Manual, 2019: two 84.39 m straights joined by bends of 36.50 m kerb radius,
 * lane 1 measured 0.30 m outside the kerb). A runner starts at the end of the
 * home straight and runs anticlockwise. The path length grows steadily; the
 * displacement from the start grows, shrinks, and is zero after one lap.
 */

/** The length of each straight, in metres. */
export const STRAIGHT = 84.39;

/** One lap of lane 1, in metres. */
export const LAP = 400;

/** The radius of the running line in lane 1, in metres: 36.80, the kerb radius 36.50 m plus 0.30 m, closing the lap at 400 m. */
export const BEND = (LAP - 2 * STRAIGHT) / (2 * Math.PI);

/** The distances a learner can stop the runner at, in metres. */
export const TrackStopSchema = Schema.Literals([100, 200, 300, 400]);
export type TrackStop = typeof TrackStopSchema.Type;

/**
 * Where the runner is after `distance` metres, in metres from the track's
 * centre, x along the straights and y across them, and the direction of
 * running in radians from +x.
 */
export function trackPlace(distance: number) {
  const s = ((distance % LAP) + LAP) % LAP;
  const arc = Math.PI * BEND;
  const half = STRAIGHT / 2;
  if (s < arc) {
    const angle = -Math.PI / 2 + s / BEND;
    return {
      heading: angle + Math.PI / 2,
      x: half + BEND * Math.cos(angle),
      y: BEND * Math.sin(angle),
    };
  }
  if (s < arc + STRAIGHT) {
    return { heading: Math.PI, x: half - (s - arc), y: BEND };
  }
  if (s < 2 * arc + STRAIGHT) {
    const angle = Math.PI / 2 + (s - arc - STRAIGHT) / BEND;
    return {
      heading: angle + Math.PI / 2,
      x: -half + BEND * Math.cos(angle),
      y: BEND * Math.sin(angle),
    };
  }
  return { heading: 0, x: -half + (s - 2 * arc - STRAIGHT), y: -BEND };
}

/** The straight-line distance from the start after running `distance` metres. */
export function trackDisplacement(distance: number) {
  const start = trackPlace(0);
  const here = trackPlace(distance);
  return Math.hypot(here.x - start.x, here.y - start.y);
}
