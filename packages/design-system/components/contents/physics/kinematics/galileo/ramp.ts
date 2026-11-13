import { Array as Arr, Schema } from "effect";

/**
 * Galileo's inclined plane (Two New Sciences, 1638, Third Day): a ball
 * rolling from rest down a gentle ramp covers distances that grow with the
 * square of the time. Bells placed at 1, 4, 9 and 16 times the first
 * second's distance ring at equal one-second beats, and the gaps between
 * them grow as 1 : 3 : 5 : 7. A solid ball that rolls without slipping
 * speeds up at 5/7 of g sin(angle), because part of the work goes into its
 * spin. Gravity is rounded to 10 m/s², as the lessons do.
 */

/** Gravitational acceleration, in m/s². */
const RAMP_GRAVITY = 10;

/** The angles a learner can tilt the ramp to, in degrees. */
export const RampAngleSchema = Schema.Literals([2, 3, 4]);
export type RampAngle = typeof RampAngleSchema.Type;

/** How many bells stand along the ramp, one for each second. */
export const BELLS = 4;

/** The acceleration of a solid ball rolling down the ramp, in m/s². */
export function rampAcceleration(angle: number) {
  return (5 / 7) * RAMP_GRAVITY * Math.sin((angle * Math.PI) / 180);
}

/** How far down the ramp the ball has rolled after `time` seconds from rest, in metres. */
export function rampDistance(angle: number, time: number) {
  return 0.5 * rampAcceleration(angle) * Math.max(time, 0) ** 2;
}

/** Where each bell stands along the ramp: where the ball is at 1, 2, 3 and 4 s. */
export function bellPlaces(angle: number) {
  return Arr.makeBy(BELLS, (index) => rampDistance(angle, index + 1));
}

/** The gaps between successive bells, from the start, in metres. */
export function bellGaps(angle: number) {
  return Arr.makeBy(
    BELLS,
    (index) => rampDistance(angle, index + 1) - rampDistance(angle, index)
  );
}
