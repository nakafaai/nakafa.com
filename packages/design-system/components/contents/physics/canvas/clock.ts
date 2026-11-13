/**
 * The clock of a looping physics sketch. A run plays from zero to its
 * duration in simulated seconds, rests on its last frame, and starts again,
 * so a learner who looks away and back always finds the motion going.
 */

/** The longest step one drawn frame may advance, so a slow phone plays in slow motion instead of skipping. */
const MAX_STEP = 0.1;

/**
 * The simulated time after one drawn frame. `elapsed` is the wall time the
 * frame took in seconds and `rate` the simulated seconds per wall second, so
 * a quick motion can play slowed down. Past the rest after the end, the run
 * starts again from zero.
 */
export function advanceRun(
  time: number,
  elapsed: number,
  run: {
    readonly duration: number;
    readonly hold: number;
    readonly rate: number;
  }
) {
  const next = time + Math.min(elapsed, MAX_STEP) * run.rate;
  return next > run.duration + run.hold * run.rate ? 0 : next;
}

/** The moment a run shows: its time, held at the end while it rests. */
export function shownTime(time: number, duration: number) {
  return Math.min(Math.max(time, 0), duration);
}
