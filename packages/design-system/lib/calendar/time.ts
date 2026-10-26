import { parseCalendarDayKey } from "@repo/design-system/lib/calendar/day-key";
import { Array as Arr, Option, Order, Schema, String as Str } from "effect";

/** A time of day on the 24-hour clock to the minute: two digits of the hour, a colon, two of the minute. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/u;

/** A `datetime-local` value: a day key, the letter T, and a time of day. */
const LOCAL_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/u;

/** The minutes of one day. */
const DAY_MINUTES = 24 * 60;

/** The minutes of one hour. */
const HOUR_MINUTES = 60;

/** The two halves of a local time: the day key and the time of day, each empty while not chosen. */
export const LocalTimeParts = Schema.Struct({
  day: Schema.String,
  time: Schema.String,
});

/** The two halves of a local time. */
export type LocalTimeParts = typeof LocalTimeParts.Type;

/** A whole number written with two digits, padded with a zero on the left. */
const twoDigits = (value: number) => Str.padStart(2, "0")(`${value}`);

/** Whether the text is a time of day such as `08:15`. */
export const isTimeOfDay = (text: string) => TIME_OF_DAY.test(text);

/**
 * The times of day every `step` minutes from midnight, such as `00:00`, `00:15` and on for a
 * step of fifteen. A `kept` time of day between two of them joins the list in its place, so a
 * value that the step does not reach still shows as chosen.
 */
export const timeSlots = (step: number, kept: string) => {
  const slots = Arr.makeBy(Math.ceil(DAY_MINUTES / step), (index) => {
    const minutes = index * step;
    return `${twoDigits(Math.floor(minutes / HOUR_MINUTES))}:${twoDigits(minutes % HOUR_MINUTES)}`;
  });

  return isTimeOfDay(kept) && !Arr.contains(slots, kept)
    ? Arr.sort(Arr.append(slots, kept), Order.String)
    : slots;
};

/**
 * The day key and the time of day of a `datetime-local` value such as `2026-10-27T08:15`, or
 * none when the text is not one or names a day or a time that the clock does not have.
 */
export const splitLocalTime = (local: string) =>
  Option.filter(
    Option.map(
      Option.fromNullishOr(LOCAL_TIME.exec(local)),
      ([, day, time]): LocalTimeParts => ({ day, time })
    ),
    (parts) =>
      Option.isSome(parseCalendarDayKey(parts.day)) && isTimeOfDay(parts.time)
  );

/** The `datetime-local` value of a day and a time of day, or none while either half is missing. */
export const joinLocalTime = (parts: LocalTimeParts) =>
  Option.isSome(parseCalendarDayKey(parts.day)) && isTimeOfDay(parts.time)
    ? Option.some(`${parts.day}T${parts.time}`)
    : Option.none();
