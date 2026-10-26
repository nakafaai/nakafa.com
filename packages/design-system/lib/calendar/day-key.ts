import { DateTime, Option } from "effect";

/** A civil day written as its key: the year, the month and the day, zero padded. */
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/u;

/**
 * Serializes a local calendar day without locale-dependent formatting.
 *
 * Calendar dates represent civil days, so this intentionally reads local date
 * parts instead of converting the value to UTC.
 */
export function getCalendarDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The local start of the civil day that a key names, as the calendar draws it, or none when
 * the text is not a day key or names a day the calendar does not have, such as the thirtieth
 * of February: such a day rolls over into the next month, so it no longer writes its key.
 */
export const parseCalendarDayKey = (key: string) =>
  Option.filter(
    Option.map(
      Option.fromNullishOr(DAY_KEY.exec(key)),
      ([, year, month, day]) =>
        DateTime.toDateUtc(
          DateTime.makeZonedUnsafe(
            {
              day: Number(day),
              hour: 0,
              minute: 0,
              month: Number(month),
              second: 0,
              year: Number(year),
            },
            { adjustForTimeZone: true, timeZone: DateTime.zoneMakeLocal() }
          )
        )
    ),
    (date) => getCalendarDayKey(date) === key
  );
