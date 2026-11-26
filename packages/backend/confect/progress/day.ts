import { Clock, DateTime, Effect } from "effect";

/** The current day as an ISO date in the learner's time zone. */
export const todayOf = Effect.fn("progress.day.today")(function* (
  timeZone: DateTime.TimeZone
) {
  const now = yield* Clock.currentTimeMillis;
  return DateTime.formatIsoDate(DateTime.makeZonedUnsafe(now, { timeZone }));
});
