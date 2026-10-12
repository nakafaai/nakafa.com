import { DateTime, Option, Schema } from "effect";

/**
 * The last moment of the UTC day that `YYYY-MM-DD` names, or nothing when the
 * text is not a real day. A day that a calendar rolls over, such as February
 * 30, is not real.
 */
export function endOfDay(day: string) {
  return DateTime.make(day).pipe(
    Option.filter((date) => DateTime.formatIsoDateUtc(date) === day),
    Option.map((date) => DateTime.toEpochMillis(DateTime.endOf(date, "day")))
  );
}

/**
 * The day a situation ends: a real UTC day written `YYYY-MM-DD`. The Schema
 * refuses any other text, so a situation that reaches a write always has a day
 * that `endOfDay` can read.
 */
export const NinaMemoryDay = Schema.String.check(
  Schema.makeFilter((day) => Option.isSome(endOfDay(day)), {
    message: "Expected a real UTC day written YYYY-MM-DD.",
  })
);
