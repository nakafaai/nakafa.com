import { Schema } from "effect";

/**
 * A motor hoist on a building site lifts a 20 kg crate onto a platform 5 m up.
 * The crate always gains the same energy, its weight times the height, so a
 * stronger motor only delivers that energy sooner. With g = 10 m/s² the
 * numbers stay round enough to check by hand.
 */

/** The gravitational field strength, in newtons per kilogram. */
const GRAVITY = 10;

/** The crate's mass, in kilograms. */
const CRATE_MASS = 20;

/** How high the platform stands, in metres. */
export const LIFT_HEIGHT = 5;

/** The force the rope must hold, equal to the crate's weight, in newtons. */
export const CRATE_WEIGHT = CRATE_MASS * GRAVITY;

/** The energy the crate gains on the way up, force times distance, in joules. */
export const LIFT_ENERGY = CRATE_WEIGHT * LIFT_HEIGHT;

/** The three motors the hoist can run on. */
export const MotorSchema = Schema.Literals(["small", "medium", "large"]);
export type Motor = typeof MotorSchema.Type;

/** The useful mechanical power of each motor, in watts. */
export const MOTOR_POWER = {
  large: 500,
  medium: 250,
  small: 100,
} as const satisfies Record<Motor, number>;

/** How long a motor takes to lift the crate, in seconds: energy over power. */
export function liftTime(motor: Motor) {
  return LIFT_ENERGY / MOTOR_POWER[motor];
}

/** The steady speed of the rising crate, in metres per second: power over force. */
export function liftSpeed(motor: Motor) {
  return MOTOR_POWER[motor] / CRATE_WEIGHT;
}

/** How high the crate is after `time` seconds, in metres, resting at the platform. */
export function crateHeight(motor: Motor, time: number) {
  return Math.min(Math.max(time, 0) * liftSpeed(motor), LIFT_HEIGHT);
}

/** The work the rope has done on the crate after `time` seconds, in joules. */
export function workDone(motor: Motor, time: number) {
  return CRATE_WEIGHT * crateHeight(motor, time);
}
