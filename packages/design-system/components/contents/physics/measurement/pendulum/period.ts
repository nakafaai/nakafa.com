import { Schema } from "effect";

/**
 * A simple pendulum's period by dimensional analysis. The period could depend
 * on the bob's mass [M], the string's length [L] and gravity [L][T]^-2. To
 * give [T], mass must appear to the power 0, length to 1/2 and gravity to
 * -1/2: T = k √(l / g). Experiment gives k = 2π, and swapping the bob for a
 * heavier one leaves the period unchanged, as the analysis says.
 */

/** Gravitational acceleration, in metres per second squared. */
export const GRAVITY = 9.81;

/** The shortest and longest string, in metres. */
export const STRING_RANGE = { max: 1.2, min: 0.2 } as const;

/** The bobs, by their mass in kilograms. */
export const BobSchema = Schema.Literals(["wood", "brass", "lead"]);
export const BOBS = { brass: 0.2, lead: 0.5, wood: 0.05 } as const satisfies Record<
  typeof BobSchema.Type,
  number
>;

/**
 * The powers of mass, length and gravity whose product has the dimension of
 * time: for M^a L^b (L T^-2)^c, mass gives a = 0, time gives -2c = 1, and
 * length gives b + c = 0.
 */
export function periodPowers() {
  const gravity = -1 / 2;
  return { gravity, length: -gravity, mass: 0 };
}

/** The period of a pendulum `length` metres long with a bob of any mass, in seconds. */
export function pendulumPeriod(length: number, mass: number) {
  const { gravity, length: power, mass: massPower } = periodPowers();
  return 2 * Math.PI * mass ** massPower * length ** power * GRAVITY ** gravity;
}
