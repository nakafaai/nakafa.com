import { Clock, DateTime, Effect } from "effect";

/**
 * The island's day now: an ISO date in its owner's zone, the day its grants
 * and its watering count in (ADR 0042, D8, D13). The server and the browser
 * read it alike.
 */
export const todayOf = Effect.fn("island.day.today")(function* (
  timeZone: DateTime.TimeZone
) {
  const now = yield* Clock.currentTimeMillis;
  return DateTime.formatIsoDate(DateTime.makeZonedUnsafe(now, { timeZone }));
});
