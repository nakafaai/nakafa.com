import {
  arrivalOf,
  partAt,
  type Stage,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import { Array as Arr, Option, Schema } from "effect";

/**
 * The lab's clock, in minutes of the journey, and what it is looking at. The
 * learner picks a leg, picks the whole journey, or drags the clock; Play runs
 * the clock from where the learner left it, so the bus, the graph and the
 * readouts always show one minute together.
 */

/** How long Play takes to run a whole journey, in seconds, however many minutes it lasts. */
export const RUN_SECONDS = 12;

/** How long a finished run rests on its last moment before it starts again, in seconds. */
export const REST_SECONDS = 1.6;

/** A running clock: the minute it shows, and how long it has rested at the end, in seconds. */
const ClockSchema = Schema.Struct({
  minute: Schema.Finite,
  rest: Schema.Finite,
});
type Clock = typeof ClockSchema.Type;

/**
 * What the lab shows: the minute on the clock, and the leg in focus, or none
 * for the whole journey.
 */
const FocusSchema = Schema.Struct({
  minute: Schema.Finite,
  part: Schema.Option(Schema.Int),
});
type Focus = typeof FocusSchema.Type;

/** Where Play starts: where the learner left the clock, or the beginning once the journey has ended. */
export function startClock(minute: number, last: number): Clock {
  return { minute: minute >= last ? 0 : minute, rest: 0 };
}

/**
 * The clock `seconds` later: it runs the journey to its `last` minute in
 * `RUN_SECONDS`, rests there for `REST_SECONDS`, then starts again.
 */
export function tickClock(clock: Clock, seconds: number, last: number): Clock {
  if (clock.minute < last) {
    return {
      minute: Math.min(last, clock.minute + (seconds * last) / RUN_SECONDS),
      rest: 0,
    };
  }
  const rest = clock.rest + seconds;
  return rest > REST_SECONDS ? { minute: 0, rest: 0 } : { minute: last, rest };
}

/** The whole journey, seen at its end: the still frame shows the finished graph. */
export function wholeFocus(last: number): Focus {
  return { minute: last, part: Option.none() };
}

/** One leg in focus, seen at its end, where the graph shows the leg whole. */
export function partFocus(
  stages: Arr.NonEmptyReadonlyArray<Stage>,
  part: number
): Focus {
  return {
    minute: Arr.getUnsafe(stages, part).end,
    part: Option.some(part),
  };
}

/** The clock at `minute`, with the leg under way then in focus. */
export function minuteFocus(
  stages: Arr.NonEmptyReadonlyArray<Stage>,
  minute: number
): Focus {
  return { minute, part: Option.some(partAt(stages, minute)) };
}

/** The last minute of the journey: when the later of its travellers arrives. */
export function lastMinute(
  trips: Arr.NonEmptyReadonlyArray<Arr.NonEmptyReadonlyArray<Stage>>
) {
  return Arr.reduce(trips, 0, (latest, stages) =>
    Math.max(latest, arrivalOf(stages))
  );
}
