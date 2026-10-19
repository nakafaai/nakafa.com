import { DateTime, Option, String as Str } from "effect";

/** One quarter of an hour, in milliseconds. */
const QUARTER_HOUR_MS = 15 * 60 * 1000;

/** One minute, in milliseconds. */
const MINUTE_MS = 60 * 1000;

/**
 * A `datetime-local` value: a calendar date, then a time of day to the minute, with no zone.
 * The groups are the year, the month, the day, the hour, and the minute.
 */
const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;

/** A number written with at least `width` digits, padded with zeros on the left. */
const pad = (value: number, width: number) =>
  Str.padStart(width, "0")(`${value}`);

/**
 * Whether the calendar holds these fields. The calendar reads back the same fields only when
 * it has the day and the time, so a day such as the thirtieth of February is refused.
 */
const isCalendarTime = (fields: Partial<DateTime.DateTime.Parts>) => {
  const read = DateTime.toParts(DateTime.makeUnsafe(fields));
  return (
    read.year === fields.year &&
    read.month === fields.month &&
    read.day === fields.day &&
    read.hour === fields.hour &&
    read.minute === fields.minute
  );
};

/**
 * The calendar fields of a `datetime-local` value, or none when the text is not one, or names a
 * time that the calendar does not have.
 */
const localFields = (local: string) =>
  Option.filter(
    Option.map(
      Option.fromNullishOr(LOCAL_TIME.exec(local)),
      ([, year, month, day, hour, minute]) => ({
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute),
        month: Number(month),
        year: Number(year),
      })
    ),
    isCalendarTime
  );

/**
 * The next whole quarter hour strictly after `now`, read on the wall clock of `zone`, as a
 * `datetime-local` value. The quarter hour is taken from the instant, so a daylight-saving gap
 * is skipped rather than named, and the text names a time that the clock shows. Zone offsets are
 * whole quarter hours, so the quarter hours of the instant are the quarter hours of the clock.
 */
export const nextQuarter = (now: DateTime.Utc, zone: DateTime.TimeZone) => {
  const quarter =
    Math.floor(DateTime.toEpochMillis(now) / QUARTER_HOUR_MS) *
      QUARTER_HOUR_MS +
    QUARTER_HOUR_MS;
  const wall = DateTime.toParts(
    DateTime.setZone(DateTime.makeUnsafe(quarter), zone)
  );
  return `${pad(wall.year, 4)}-${pad(wall.month, 2)}-${pad(wall.day, 2)}T${pad(wall.hour, 2)}:${pad(wall.minute, 2)}`;
};

/**
 * The instants that a sitting opens and closes at, for a start read on the wall clock of `zone`
 * and a length in minutes. The length counts real minutes, so a sitting that crosses a
 * daylight-saving change keeps its length. None when the start is not a `datetime-local` value
 * that the calendar holds.
 */
export const sittingTimes = (
  local: string,
  minutes: number,
  zone: DateTime.TimeZone
) =>
  Option.flatMap(localFields(local), (fields) =>
    DateTime.makeZoned(fields, { adjustForTimeZone: true, timeZone: zone })
  ).pipe(
    Option.map((start) => {
      const opensAt = DateTime.toEpochMillis(start);
      return { closesAt: opensAt + minutes * MINUTE_MS, opensAt };
    })
  );
