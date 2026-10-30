import { DateTime, Option } from "effect";

/**
 * The instant a deadline field names: its local date and time, such as
 * `2026-10-30T23:59`, read in the browser's own time zone. A value that is not a
 * date and time names none.
 */
export const deadlineOf = (local: string) =>
  Option.map(
    DateTime.makeZoned(local, {
      adjustForTimeZone: true,
      timeZone: DateTime.zoneMakeLocal(),
    }),
    DateTime.toEpochMillis
  );

/** The value of a deadline field for an instant, in the browser's own time zone, to the minute. */
export const localDeadline = (epoch: number) =>
  DateTime.formatIsoZoned(
    DateTime.makeZonedUnsafe(epoch, { timeZone: DateTime.zoneMakeLocal() })
  ).slice(0, 16);
