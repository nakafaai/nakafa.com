import { Schema } from "effect";

/**
 * A road bicycle wheel spinning on a stand. Every point of the wheel turns
 * through the same angle in the same time, so the angular speed is one
 * number; the linear speed of a point grows with its distance from the axle,
 * and so does its centripetal acceleration.
 */

/**
 * Where the two marked points sit, in metres from the axle: the valve on the
 * rim of a 700C wheel (bead seat diameter 622 mm, ISO 5775, so 0.311 m) and
 * a spoke reflector halfway out.
 */
export const VALVE_RADIUS = 0.311;
export const REFLECTOR_RADIUS = 0.155;

/** The periods a learner can spin the wheel at, in seconds per turn. */
export const SpinPeriodSchema = Schema.Literals([2, 1, 0.5]);
export type SpinPeriod = typeof SpinPeriodSchema.Type;

/** The angular speed, and the linear speed and centripetal acceleration of a point at `radius`. */
export function spinAt(period: number, radius: number) {
  const angular = (2 * Math.PI) / period;
  return {
    acceleration: angular * angular * radius,
    angular,
    speed: angular * radius,
  };
}
