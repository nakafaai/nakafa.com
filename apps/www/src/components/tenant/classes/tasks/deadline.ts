import { DateTime, Option } from "effect";

/**
 * The instant a deadline field names: its date and time, such as `2026-10-30T23:59`, read on the
 * school's clock, so a device in another zone writes what the class reads. A value that is not a
 * date and time names none.
 */
export const deadlineOf = (local: string, timeZone: string) =>
  Option.map(
    DateTime.makeZoned(local, { adjustForTimeZone: true, timeZone }),
    DateTime.toEpochMillis
  );

/** The value of a deadline field for an instant, on the school's clock, to the minute. */
export const localDeadline = (epoch: number, timeZone: string) =>
  DateTime.formatIsoZoned(DateTime.makeZonedUnsafe(epoch, { timeZone })).slice(
    0,
    16
  );
