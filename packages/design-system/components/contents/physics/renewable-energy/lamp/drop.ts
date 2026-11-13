import { Schema } from "effect";

/**
 * A gravity lamp: a 12 kg bag of sand hangs from a cord that turns a small
 * generator as the bag sinks 1.8 m, and the generator lights an LED. Nothing
 * else feeds the lamp, so the light is the change in the bag's height made
 * visible. With g = 10 m/s² the bag releases m g h = 216 J on its way down.
 */

/** The gravitational field strength, in newtons per kilogram. */
export const GRAVITY = 10;

/** The bag's mass, in kilograms. */
export const BAG_MASS = 12;

/** How far the bag sinks from the lamp to the floor, in metres. */
export const DROP_HEIGHT = 1.8;

/** The energy the sinking bag releases, in joules. */
export const DROP_ENERGY = BAG_MASS * GRAVITY * DROP_HEIGHT;

/** How slowly the gear lets the bag sink. */
export const DescentSchema = Schema.Literals(["fast", "steady", "slow"]);
export type Descent = typeof DescentSchema.Type;

/** The time each descent takes, in minutes. */
export const DESCENT_MINUTES = {
  fast: 10,
  slow: 30,
  steady: 20,
} as const satisfies Record<Descent, number>;

/** The descent's length in seconds. */
export function descentSeconds(descent: Descent) {
  return DESCENT_MINUTES[descent] * 60;
}

/** The power the bag hands to the generator, in watts: its energy over the descent time. */
export function dropPower(descent: Descent) {
  return DROP_ENERGY / descentSeconds(descent);
}

/** How high the bag still hangs above the floor after `seconds`, in metres. */
export function bagHeight(descent: Descent, seconds: number) {
  const share = Math.min(Math.max(seconds / descentSeconds(descent), 0), 1);
  return DROP_HEIGHT * (1 - share);
}

/** The energy released so far, in joules: the weight times the height lost. */
export function releasedEnergy(descent: Descent, seconds: number) {
  return BAG_MASS * GRAVITY * (DROP_HEIGHT - bagHeight(descent, seconds));
}
