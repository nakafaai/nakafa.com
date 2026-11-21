import type { Fibre } from "@repo/design-system/components/contents/biology/neuron/conduction";
import {
  INTERNODE,
  RISE,
  speed,
} from "@repo/design-system/components/contents/biology/neuron/conduction";
import { Schema } from "effect";

/**
 * Where the drawn axon is cut, and where it ends at the terminals, in drawn
 * spacings from the initial segment. Each spacing is one internode: nodes of
 * Ranvier stand at whole spacings, the initial segment fires at 0, and the
 * electrode records at node 2. The cut stands for all of the axon the
 * drawing leaves out, so the impulse leaves the near stretch at 3.5 and
 * reaches the terminals 2.5 spacings after it comes out of the cut.
 */
export const CUT = 3.5;
export const END = 6;
export const ELECTRODE = 2;

/**
 * How many times slower than life the impulse plays while it crosses the
 * drawn axon: a jump between nodes of a myelinated fibre, 1/60 ms, shows
 * for a sixth of a second.
 */
const SLOW = 10_000;

/** Real milliseconds a displayed second shows in slow motion. */
const RATE = 1000 / SLOW;

/**
 * The displayed seconds of rest before the impulse starts, the time constant
 * in seconds of the fast-forward through the cut and through the recovery,
 * how many milliseconds the recovery lasts after the impulse reaches the
 * terminals, and the seconds the run rests on its last frame.
 */
const LEAD = 0.8;
const RAMP = 0.4;
const TAIL = 6;
const HOLD = 1.2;

/**
 * The micrometres of axon one drawn spacing stands for: the internode of a
 * myelinated fibre as wide as `fibre`. A bare fibre is drawn at the same
 * scale, so its stretch stands for as much axon as a myelinated fibre of its
 * diameter would.
 */
export function spacing(fibre: Fibre) {
  return INTERNODE * fibre.diameter;
}

/** The micrometres of axon the cut leaves out of `length` metres. */
function hidden(fibre: Fibre, length: number) {
  return Math.max(0, length * 1e6 - END * spacing(fibre));
}

/**
 * When the impulse reaches drawn position `place`, in milliseconds after the
 * initial segment fires: its distance along the axon over its speed. A
 * place beyond the cut also lies beyond all the axon the cut leaves out.
 */
export function arrival(fibre: Fibre, length: number, place: number) {
  const beyond = place > CUT ? hidden(fibre, length) : 0;
  return (place * spacing(fibre) + beyond) / speed(fibre) / 1000;
}

/** The displayed seconds a fast-forward takes to cover `span` milliseconds, speeding up from slow motion. */
function rampLength(span: number) {
  return RAMP * Math.log1p(span / (RATE * RAMP));
}

/** The milliseconds a fast-forward has covered after `elapsed` displayed seconds. */
function rampTime(elapsed: number) {
  return RATE * RAMP * Math.expm1(elapsed / RAMP);
}

/**
 * The landmarks of one run: when the impulse leaves the near stretch,
 * emerges from the cut and reaches the terminals, in real ms, and the
 * displayed seconds each part of the run lasts.
 */
const RunSchema = Schema.Struct({
  emerge: Schema.Finite,
  end: Schema.Finite,
  leave: Schema.Finite,
  parts: Schema.Struct({
    far: Schema.Finite,
    gap: Schema.Finite,
    near: Schema.Finite,
    tail: Schema.Finite,
  }),
});
type Run = typeof RunSchema.Type;

/**
 * The run of one impulse along `fibre`, `length` metres long, as the scene
 * plays it: a rest, the jump from the initial segment across the near
 * stretch in slow motion, a fast-forward through the cut, the far stretch
 * and the terminals in slow motion again, a fast-forward through the
 * recovery, and a rest on the last frame. Both fibres play the stretches at
 * the same slow motion, so a bare fibre is seen to crawl. The still frame
 * shows the membrane under the electrode at the peak of its action
 * potential.
 */
export function timeline(fibre: Fibre, length: number) {
  const leave = arrival(fibre, length, CUT);
  const emerge = leave + hidden(fibre, length) / speed(fibre) / 1000;
  const end = arrival(fibre, length, END);
  const parts = {
    far: (end - emerge) / RATE,
    gap: rampLength(emerge - leave),
    near: leave / RATE,
    tail: rampLength(TAIL),
  };
  const run: Run = { emerge, end, leave, parts };
  return {
    ...run,
    period: LEAD + parts.near + parts.gap + parts.far + parts.tail + HOLD,
    still: shownAt(run, arrival(fibre, length, ELECTRODE) + RISE),
  };
}

/**
 * The displayed seconds into the run at which it shows `real` ms after the
 * initial segment fires: the inverse of `realTime` within one loop.
 */
export function shownAt(run: Run, real: number) {
  if (real < run.leave) {
    return LEAD + real / RATE;
  }
  const cut = LEAD + run.parts.near;
  if (real < run.emerge) {
    return cut + rampLength(real - run.leave);
  }
  const far = cut + run.parts.gap;
  if (real < run.end) {
    return far + (real - run.emerge) / RATE;
  }
  return far + run.parts.far + rampLength(Math.min(TAIL, real - run.end));
}

/**
 * The real time, in milliseconds after the initial segment fires, that the
 * run shows `shown` displayed seconds after it starts. It loops; before the
 * impulse starts the time is negative and the axon rests.
 */
export function realTime(run: ReturnType<typeof timeline>, shown: number) {
  let left = (shown % run.period) - LEAD;
  if (left < run.parts.near) {
    return left * RATE;
  }
  left -= run.parts.near;
  if (left < run.parts.gap) {
    return run.leave + rampTime(left);
  }
  left -= run.parts.gap;
  if (left < run.parts.far) {
    return run.emerge + left * RATE;
  }
  left -= run.parts.far;
  return run.end + Math.min(TAIL, rampTime(left));
}
