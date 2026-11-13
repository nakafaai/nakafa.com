import { Schema } from "effect";

/**
 * A street running east, with a store at its zero, Rani's house 20 m east of
 * it and a flagpole at 50 m. A cyclist rides from 20 m to 50 m and back to
 * 35 m. Measured from any landmark, the cyclist's position changes by the
 * landmark's own coordinate, while the change of position does not.
 */

/** The landmarks a learner can take as the origin. */
export const LandmarkSchema = Schema.Literals(["store", "house", "pole"]);
export type Landmark = typeof LandmarkSchema.Type;

/** Where each landmark stands, in metres east of the store. */
export const LANDMARKS = {
  house: 20,
  pole: 50,
  store: 0,
} as const satisfies Record<Landmark, number>;

/** The ride: start, the far point, and the end, in metres east of the store; each leg lasts 6 s. */
export const RIDE = { end: 35, far: 50, leg: 6, start: 20 } as const;

/** How long the ride lasts, in seconds. */
export const RIDE_DURATION = 2 * RIDE.leg;

/** Eases one leg so the cyclist sets off and slows down smoothly. */
function ease(fraction: number) {
  return (1 - Math.cos(Math.PI * Math.min(Math.max(fraction, 0), 1))) / 2;
}

/** The cyclist's coordinate east of the store at `time` seconds. */
export function ridePosition(time: number) {
  if (time <= RIDE.leg) {
    return RIDE.start + (RIDE.far - RIDE.start) * ease(time / RIDE.leg);
  }
  return RIDE.far + (RIDE.end - RIDE.far) * ease((time - RIDE.leg) / RIDE.leg);
}

/** A coordinate measured from a landmark: the object stays, only the zero moves. */
export function measuredFrom(landmark: Landmark, coordinate: number) {
  return coordinate - LANDMARKS[landmark];
}

/** The start, the end, and the change of position, measured from a landmark. */
export function rideSummary(landmark: Landmark) {
  const start = measuredFrom(landmark, ridePosition(0));
  const end = measuredFrom(landmark, ridePosition(RIDE_DURATION));
  return { change: end - start, end, start };
}
