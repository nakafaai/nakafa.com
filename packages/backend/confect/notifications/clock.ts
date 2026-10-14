import { DateTime, Option, Schema } from "effect";

/**
 * A wall-clock time on the local calendar day of an instant, moved by whole
 * days. The day is read on the clock of the zone the caller passes, so a day
 * offset of -1 is the day before in that zone, whatever its offset is then.
 */
export const LocalClock = Schema.Struct({
  dayOffset: Schema.Int,
  hour: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 23 })),
  minute: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 59 })),
});

/** Quiet hours begin at 21:00 on the clock of the school (ADR 0027). */
const QUIET_START_MINUTE = 21 * 60;
/** Quiet hours end at 06:00, and that minute is outside them. */
const QUIET_END_MINUTE = 6 * 60;
/** The daily digest runs at 17:00 (ADR 0027, a proposal the owner sets). */
const DIGEST_MINUTE = 17 * 60;

/** The minute of the day that a zoned instant shows on its clock, counted from midnight. */
const minuteOfDay = (zoned: DateTime.Zoned): number =>
  DateTime.getPart(zoned, "hour") * 60 + DateTime.getPart(zoned, "minute");

/**
 * The instant of a wall-clock time on the local day of `instant`, moved by
 * `dayOffset` whole days. Effect's `DateTime` moves the calendar day on the
 * clock of `zone`, so 16:00 stays 16:00 on the clock across a change of offset.
 */
export const atLocalClock = (
  instant: DateTime.DateTime,
  zone: DateTime.TimeZone.Named,
  clock: typeof LocalClock.Type
): DateTime.Utc =>
  DateTime.toUtc(
    DateTime.setParts(
      DateTime.add(DateTime.setZone(instant, zone), { days: clock.dayOffset }),
      { hour: clock.hour, minute: clock.minute, second: 0, millisecond: 0 }
    )
  );

/**
 * When quiet hours end, if `instant` falls inside them on the clock of `zone`.
 * Quiet hours run from 21:00 to 06:00 the next morning, so an instant after
 * 21:00 ends the following day, and an instant before 06:00 ends that morning.
 * The instant of 06:00 itself is outside quiet hours and gives `None`.
 */
export const quietHoursEnd = (
  instant: DateTime.DateTime,
  zone: DateTime.TimeZone.Named
): Option.Option<DateTime.Utc> => {
  const minute = minuteOfDay(DateTime.setZone(instant, zone));
  if (minute >= QUIET_START_MINUTE) {
    return Option.some(
      atLocalClock(instant, zone, { dayOffset: 1, hour: 6, minute: 0 })
    );
  }
  if (minute < QUIET_END_MINUTE) {
    return Option.some(
      atLocalClock(instant, zone, { dayOffset: 0, hour: 6, minute: 0 })
    );
  }
  return Option.none();
};

/**
 * The 17:00 digest that carries `instant` on the clock of `zone`: the digest of
 * the same day when `instant` is before 17:00, and the digest of the next day
 * from 17:00 on, so a notice is never sent in a digest that already ran.
 */
export const digestInstant = (
  instant: DateTime.DateTime,
  zone: DateTime.TimeZone.Named
): DateTime.Utc => {
  const dayOffset =
    minuteOfDay(DateTime.setZone(instant, zone)) < DIGEST_MINUTE ? 0 : 1;
  return atLocalClock(instant, zone, { dayOffset, hour: 17, minute: 0 });
};
