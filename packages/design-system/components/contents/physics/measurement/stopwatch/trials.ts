import { Array as Arr } from "effect";

/**
 * Timing ten swings of a pendulum by hand, again and again. The pendulum
 * keeps perfect time, but the thumb that starts the stopwatch and the thumb
 * that stops it each react a little early or late, so the readings scatter
 * around the true time. Their mean settles as trials pile up, their spread
 * stays, and the uncertainty of the mean shrinks with the square root of
 * the number of trials.
 */

/** The pendulum's length, in metres. */
export const PENDULUM_LENGTH = 0.8;

/** Gravitational acceleration at the bench, in metres per second squared. */
export const GRAVITY = 9.81;

/** How many swings each trial times. */
export const SWINGS = 10;

/** The pendulum's true period, in seconds. */
export const PERIOD = 2 * Math.PI * Math.sqrt(PENDULUM_LENGTH / GRAVITY);

/** The true time of ten swings, in seconds. */
export const TRUE_TIME = SWINGS * PERIOD;

/** The spread of one press of the stopwatch button, in seconds. */
export const PRESS_SPREAD = 0.08;

/** The stopwatch's resolution, in seconds. */
export const STOPWATCH_STEP = 0.01;

/** The most trials the lab records. */
export const MAX_TRIALS = 20;

/** The seed of the trials, so every learner sees the same readings. */
const SEED = 42_424_242;

/** The modulus of the Lehmer generator, the Mersenne prime 2^31 - 1. */
const MODULUS = 2_147_483_647;

/** The Lehmer generator's multiplier (Park and Miller, 1993). */
const MULTIPLIER = 48_271;

/**
 * A stream of evenly spread numbers in (0, 1) from a seed, by the Lehmer
 * generator, so the scatter is the same on every visit. Every product stays
 * below 2^53, so plain number arithmetic keeps it exact.
 */
function uniforms(count: number) {
  let state = SEED;
  return Arr.makeBy(count, () => {
    state = (state * MULTIPLIER) % MODULUS;
    return state / MODULUS;
  });
}

/**
 * The stopwatch readings of the first `count` trials, in seconds: the true
 * time, plus the stopping thumb's error, less the starting thumb's, each a
 * normal error drawn by the Box-Muller method, rounded to the stopwatch's
 * hundredth of a second.
 */
export function trialTimes(count: number) {
  const draws = uniforms(MAX_TRIALS * 2);
  return Arr.makeBy(count, (trial) => {
    const first = Arr.getUnsafe(draws, trial * 2);
    const second = Arr.getUnsafe(draws, trial * 2 + 1);
    const radius = Math.sqrt(-2 * Math.log(1 - first));
    const stop = radius * Math.cos(2 * Math.PI * second) * PRESS_SPREAD;
    const start = radius * Math.sin(2 * Math.PI * second) * PRESS_SPREAD;
    return (
      Math.round((TRUE_TIME + stop - start) / STOPWATCH_STEP) /
      Math.round(1 / STOPWATCH_STEP)
    );
  });
}

/**
 * The mean of the readings, their sample standard deviation with N - 1, and
 * the standard uncertainty of the mean, s over the square root of N.
 */
export function timingSpread(times: readonly number[]) {
  const count = times.length;
  const mean = Arr.reduce(times, 0, (sum, time) => sum + time) / count;
  const squares = Arr.reduce(times, 0, (sum, time) => sum + (time - mean) ** 2);
  const spread = count > 1 ? Math.sqrt(squares / (count - 1)) : 0;
  return { mean, spread, uncertainty: spread / Math.sqrt(count) };
}
