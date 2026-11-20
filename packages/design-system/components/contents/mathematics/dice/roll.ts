import {
  seededPicks,
  seededUniforms,
} from "@repo/design-system/components/contents/mathematics/chance";
import { FACES } from "@repo/design-system/components/contents/mathematics/dice/faces";
import type { DiceCount } from "@repo/design-system/components/contents/mathematics/dice/odds";
import { outcomes } from "@repo/design-system/components/contents/mathematics/dice/odds";
import type { Pose } from "@repo/design-system/components/contents/mathematics/dice/pose";
import {
  gatherPose,
  restPose,
  ThrowSchema,
  tumblePose,
} from "@repo/design-system/components/contents/mathematics/dice/pose";
import { Array as Arr, Option, Schema } from "effect";

/**
 * The run of rolls a lab plays: the same 300 rolls for every learner, from a
 * seeded stream. The first rolls are slow enough to follow one tumble; then
 * each roll takes 30% less time than the one before, down to 25 a second,
 * so hundreds pile up within about 20 seconds.
 */

/** How many rolls one run makes. */
export const ROLLS = 300;

/**
 * The seed of the run, so every learner sees the same rolls. Of the 20,000
 * seeds after 20,261,120 it gives the most typical run: after 300 rolls every
 * outcome's relative frequency, for one die and for two, lies within 0.62
 * standard errors of its probability, so the run shows the law of large
 * numbers as it usually turns out, not a lucky or an unlucky streak.
 */
const SEED = 20_264_576;

/** How many rolls at the start take the full slow time. */
const SLOW_ROLLS = 3;

/** The time of one slow roll, in seconds. */
export const SLOW_SECONDS = 2.2;

/** The time of the fastest roll, in seconds. */
const FASTEST_SECONDS = 0.04;

/** Each roll after the slow ones takes this share of the one before. */
const SPEED_UP = 0.7;

/** The share of a roll's time spent gathering the dice, then tumbling; the rest they lie still. */
const GATHER = 0.16;
const TUMBLE = 0.6;

/** Where a thrown die may stop along the tray, in metres from its middle. */
const REST_FROM = 0;
const REST_SPAN = 0.05;

/**
 * The middle of each die's lane across the tray, and how far a die strays
 * from it, in metres from the tray's middle towards the front. The lanes keep
 * to the back half, so from the camera the front wall never hides a die.
 */
const LANES = { 1: [-0.018], 2: [-0.042, 0.006] } as const;
const STRAY = { 1: 0.024, 2: 0.006 } as const;

/** One roll of the run: when it starts, how long it takes, each die's throw, and the outcome. */
const RollSchema = Schema.Struct({
  outcome: Schema.Int,
  seconds: Schema.Finite,
  start: Schema.Finite,
  throws: Schema.Array(ThrowSchema),
});
export type Roll = typeof RollSchema.Type;

/** How long roll number `index` of the run takes, in seconds. */
export function rollSeconds(index: number) {
  if (index < SLOW_ROLLS) {
    return SLOW_SECONDS;
  }
  return Math.max(
    FASTEST_SECONDS,
    SLOW_SECONDS * SPEED_UP ** (index - SLOW_ROLLS + 1)
  );
}

/** The whole run of `dice` dice, roll by roll. */
export function planRolls(dice: DiceCount): readonly Roll[] {
  const lanes = LANES[dice];
  const faces = seededPicks(SEED, ROLLS * 2, 6);
  const places = seededUniforms(SEED + 1, ROLLS * 8);
  const seconds = Arr.makeBy(ROLLS, rollSeconds);
  const starts = Arr.scan(seconds, 0, (start, time) => start + time);
  return Arr.makeBy(ROLLS, (index) => {
    const throws = Arr.map(lanes, (lane, die) => {
      const place = (step: number) =>
        Arr.getUnsafe(places, index * 8 + die * 4 + step);
      return {
        face: Arr.getUnsafe(FACES, Arr.getUnsafe(faces, index * 2 + die)),
        lane,
        rest: [
          REST_FROM + place(0) * REST_SPAN,
          lane + (2 * place(1) - 1) * STRAY[dice],
        ] as const,
        twist: place(2) < 0.5 ? (-1 as const) : (1 as const),
        yaw: place(3) * 2 * Math.PI,
      };
    });
    return {
      outcome: Arr.reduce(throws, 0, (sum, each) => sum + each.face),
      seconds: Arr.getUnsafe(seconds, index),
      start: Arr.getUnsafe(starts, index),
      throws,
    };
  });
}

/** The time the whole run takes, in seconds. */
export function runSeconds(rolls: readonly Roll[]) {
  return Arr.match(rolls, {
    onEmpty: () => 0,
    onNonEmpty: (all) => {
      const last = Arr.lastNonEmpty(all);
      return last.start + last.seconds;
    },
  });
}

/** How many rolls have come to rest `time` seconds into the run. */
export function settledBy(rolls: readonly Roll[], time: number) {
  return Option.match(
    Arr.findLastIndex(
      rolls,
      (roll) => roll.start + roll.seconds * (GATHER + TUMBLE) <= time
    ),
    { onNone: () => 0, onSome: (index) => index + 1 }
  );
}

/**
 * Where each die is `time` seconds into the run. Before a roll's tumble the
 * dice are gathered up from where the roll before left them; the run's first
 * roll gathers them from where its last one left them, so a run that loops
 * never jumps.
 */
export function posesAt(rolls: readonly Roll[], time: number) {
  const index = Option.getOrElse(
    Arr.findLastIndex(rolls, (roll) => roll.start <= time),
    () => 0
  );
  const roll = Arr.getUnsafe(rolls, index);
  const before = Arr.getUnsafe(
    rolls,
    (index + rolls.length - 1) % rolls.length
  );
  const local = Math.min(1, Math.max(0, (time - roll.start) / roll.seconds));
  const amplitude = roll.seconds / SLOW_SECONDS;
  const tumble = roll.seconds * TUMBLE;
  return Arr.map(roll.throws, (each, die): Pose => {
    if (local >= GATHER) {
      return tumblePose(each, (local - GATHER) / TUMBLE, amplitude, tumble);
    }
    return gatherPose(
      restPose(Arr.getUnsafe(before.throws, die)),
      tumblePose(each, 0, amplitude, tumble),
      local / GATHER
    );
  });
}

/** How many of the first `count` rolls showed each outcome, in the order `outcomes` lists them. */
export function tally(rolls: readonly Roll[], count: number, dice: DiceCount) {
  const done = Arr.take(rolls, count);
  return Arr.map(
    outcomes(dice),
    (outcome) => Arr.filter(done, (roll) => roll.outcome === outcome).length
  );
}

/** How many of the first `count` rolls showed `target`. */
export function hitsOf(rolls: readonly Roll[], count: number, target: number) {
  return Arr.filter(Arr.take(rolls, count), (roll) => roll.outcome === target)
    .length;
}
