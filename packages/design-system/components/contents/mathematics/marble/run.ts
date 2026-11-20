import { Option, Schema } from "effect";

/**
 * The play clock of the marble lab. The first trials run slowly enough to
 * follow each marble out of the jar and back; then the trials speed up, so
 * hundreds pile up and the share of trials that matched the event settles.
 */

/** How many trials play out marble by marble before the run speeds up. */
export const SLOW_TRIALS = 6;

/** Seconds one slow trial lasts. */
export const TRIAL_SECONDS = 3.2;

/** Trials a second once the run has sped up. */
const FAST_RATE = 40;

/** Trials in a whole run. */
export const RUN_TRIALS = 1000;

/** Seconds a whole run lasts, from the first draw to the last trial. */
export const RUN_SECONDS =
  SLOW_TRIALS * TRIAL_SECONDS + (RUN_TRIALS - SLOW_TRIALS) / FAST_RATE;

/**
 * The moments of a slow trial, in seconds from its start: the first marble
 * rises to the hand and is read, goes back into the jar or onto the dish,
 * then the second marble rises, is read, and both return.
 */
export const STEPS = {
  firstHeld: 0.7,
  firstRead: 1.0,
  firstPlaced: 1.7,
  secondHeld: 2.4,
  secondRead: 2.6,
  returned: 3.2,
} as const;

/** Where the run stands: trials finished, and the slow trial under way, if any, with its own clock. */
const RunMomentSchema = Schema.Struct({
  active: Schema.Option(
    Schema.Struct({ elapsed: Schema.Finite, trial: Schema.Int })
  ),
  finished: Schema.Int,
});
type RunMoment = typeof RunMomentSchema.Type;

/** The trials finished and the slow trial under way at `time` seconds into the run. */
export function runMoment(time: number): RunMoment {
  const slowEnd = SLOW_TRIALS * TRIAL_SECONDS;
  if (time < slowEnd) {
    const trial = Math.floor(Math.max(0, time) / TRIAL_SECONDS);
    return {
      active: Option.some({
        elapsed: Math.max(0, time) - trial * TRIAL_SECONDS,
        trial,
      }),
      finished: trial,
    };
  }
  return {
    active: Option.none(),
    finished: Math.min(
      RUN_TRIALS,
      SLOW_TRIALS + Math.floor((time - slowEnd) * FAST_RATE)
    ),
  };
}

/** Eases a share of a step in and out, so a marble starts and stops gently. */
export function ease(share: number) {
  const clamped = Math.min(1, Math.max(0, share));
  return clamped * clamped * (3 - 2 * clamped);
}

/** How far a step from `from` to `to` seconds has gone at `elapsed`, eased. */
export function progress(elapsed: number, from: number, to: number) {
  return ease((elapsed - from) / (to - from));
}
