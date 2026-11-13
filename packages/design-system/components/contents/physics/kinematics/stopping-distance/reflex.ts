import { Array as Arr, Number as Num, Option, Schema } from "effect";

/**
 * The shortest and longest wait before the car in front lights its brakes,
 * in seconds. A wait the learner cannot predict keeps the test honest.
 */
export const WAIT_MIN = 1.5;
export const WAIT_MAX = 4;

/** A press faster than this cannot be a reaction to the light, only a guess. */
export const ANTICIPATION_LIMIT = 0.1;

/** The trials a learner's average keeps, newest last. */
export const TRIAL_LIMIT = 5;

/**
 * One trial of the test. `wait` is the seconds before the car in front
 * lights its brakes; `time` is the scene clock since the trial started;
 * `lightsAt` is when the lights first reached the screen, on the page's
 * clock in seconds; `reaction` is the learner's reaction time once known.
 */
export const TrialSchema = Schema.Struct({
  lightsAt: Schema.Option(Schema.Finite),
  reaction: Schema.Option(Schema.Finite),
  time: Schema.Finite,
  wait: Schema.Finite,
});
export type Trial = typeof TrialSchema.Type;

/** Where the test stands: ready to start, driving, braked too early, or done. */
export const PhaseSchema = Schema.Literals([
  "ready",
  "driving",
  "early",
  "done",
]);
export type Phase = typeof PhaseSchema.Type;

/** What one press during a trial means. */
export const PressSchema = Schema.Union([
  Schema.TaggedStruct("early", {}),
  Schema.TaggedStruct("reaction", { seconds: Schema.Finite }),
]);
export type Press = typeof PressSchema.Type;

/**
 * The wait before the brake lights, drawn from `unit`, a uniform random
 * number in [0, 1).
 */
export function waitFrom(unit: number) {
  return WAIT_MIN + (WAIT_MAX - WAIT_MIN) * unit;
}

/**
 * Judges a press at `pressedAt` against the moment the brake lights first
 * showed on screen, both in seconds on one clock. A press before the lights,
 * or too fast to follow them, is early.
 */
export function judgePress(
  lightsAt: Option.Option<number>,
  pressedAt: number
): Press {
  return Option.match(lightsAt, {
    onNone: (): Press => ({ _tag: "early" }),
    onSome: (lights): Press => {
      const seconds = pressedAt - lights;
      if (seconds < ANTICIPATION_LIMIT) {
        return { _tag: "early" };
      }
      return { _tag: "reaction", seconds };
    },
  });
}

/** Keeps the newest trials only, so an old slow start fades out. */
export function keepTrial(trials: readonly number[], seconds: number) {
  return Arr.takeRight(Arr.append(trials, seconds), TRIAL_LIMIT);
}

/** The fastest and the mean reaction time of the kept trials. */
export function summarizeTrials(trials: readonly number[]) {
  return Arr.match(trials, {
    onEmpty: () => Option.none(),
    onNonEmpty: (kept) =>
      Option.some({
        best: Arr.reduce(kept, Number.POSITIVE_INFINITY, Num.min),
        mean: Num.sumAll(kept) / kept.length,
      }),
  });
}
