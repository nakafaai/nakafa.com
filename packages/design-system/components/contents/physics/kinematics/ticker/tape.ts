import { Array as Arr, Option, Schema } from "effect";

/**
 * A ticker timer on a school bench: a striker hits a carbon disc 50 times a
 * second, printing a dot on the paper tape that the trolley pulls through it.
 * Every five gaps, a tenth of a second, the tape is cut into a strip; laid
 * side by side, the strips make a velocity-time chart.
 */

/** How many dots the timer prints each second. */
export const TICKS_PER_SECOND = 50;

/** How many gaps between dots one cut strip holds. */
export const GAPS_PER_STRIP = 5;

/** How long one strip lasts, in seconds. */
export const STRIP_SECONDS = GAPS_PER_STRIP / TICKS_PER_SECOND;

/** The three motions the trolley can make. */
export const TapeMotionSchema = Schema.Literals([
  "uniform",
  "speeding",
  "slowing",
]);
export type TapeMotion = typeof TapeMotionSchema.Type;

/** One motion: its acceleration, how long it lasts and the velocity it starts with. */
const MotionSchema = Schema.Struct({
  acceleration: Schema.Finite,
  duration: Schema.Finite,
  initialVelocity: Schema.Finite,
});

/**
 * Each motion in metres and seconds. All three cover 0.48 m in 0.8 s, so
 * their average velocity is the same 0.6 m/s and only the spacing of the dots
 * tells them apart.
 */
export const TAPE_MOTIONS = {
  slowing: { acceleration: -1, duration: 0.8, initialVelocity: 1 },
  speeding: { acceleration: 1, duration: 0.8, initialVelocity: 0.2 },
  uniform: { acceleration: 0, duration: 0.8, initialVelocity: 0.6 },
} as const satisfies Record<TapeMotion, typeof MotionSchema.Type>;

/** How far the trolley has moved after `time` seconds, in metres. */
export function tapePosition(motion: TapeMotion, time: number) {
  const { acceleration, initialVelocity } = TAPE_MOTIONS[motion];
  return initialVelocity * time + 0.5 * acceleration * time * time;
}

/** The times the timer strikes during the run, from zero to the end. */
export function tapeTicks(motion: TapeMotion) {
  return Arr.makeBy(
    Math.round(TAPE_MOTIONS[motion].duration * TICKS_PER_SECOND) + 1,
    (tick) => tick / TICKS_PER_SECOND
  );
}

/** The length of each cut strip, in metres: the distance moved in its tenth of a second. */
export function tapeStrips(motion: TapeMotion) {
  return Arr.makeBy(
    Math.round(TAPE_MOTIONS[motion].duration / STRIP_SECONDS),
    (strip) =>
      tapePosition(motion, (strip + 1) * STRIP_SECONDS) -
      tapePosition(motion, strip * STRIP_SECONDS)
  );
}

/**
 * The acceleration the strips show: how much each strip grows on the one
 * before, over a strip's time squared.
 */
export function stripAcceleration(strips: readonly number[]) {
  const first = Option.getOrElse(Arr.head(strips), () => 0);
  const last = Option.getOrElse(Arr.last(strips), () => 0);
  const steps = Math.max(strips.length - 1, 1);
  const acceleration = (last - first) / steps / (STRIP_SECONDS * STRIP_SECONDS);
  // Equal strips differ by rounding alone; a reading of zero is never negative.
  return Math.round(acceleration * 1e9) / 1e9 + 0;
}
