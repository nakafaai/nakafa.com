import { Array as Arr } from "effect";

/**
 * Chance for the probability labs. A lab never draws on the live random
 * source: every learner sees the same rolls, draws and bounces, so a lesson
 * can name what the scene shows and a screenshot stays the same. The numbers
 * come from the Lehmer generator of Park and Miller (1993), which spreads its
 * values evenly over (0, 1); every product stays below 2^53, so plain number
 * arithmetic keeps it exact.
 */

/** The modulus of the Lehmer generator, the Mersenne prime 2^31 - 1. */
const MODULUS = 2_147_483_647;

/** The Lehmer generator's multiplier (Park and Miller, 1993). */
const MULTIPLIER = 48_271;

/** The first `count` values in (0, 1) that the generator gives from `seed`. */
export function seededUniforms(seed: number, count: number) {
  let state = seed % MODULUS || 1;
  return Arr.makeBy(count, () => {
    state = (state * MULTIPLIER) % MODULUS;
    return state / MODULUS;
  });
}

/**
 * The first `count` picks among `choices` equally likely outcomes, numbered
 * from 0, from the generator's stream at `seed`.
 */
export function seededPicks(seed: number, count: number, choices: number) {
  return Arr.map(seededUniforms(seed, count), (value) =>
    Math.min(choices - 1, Math.floor(value * choices))
  );
}
