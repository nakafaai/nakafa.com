import {
  getCalendarDayKey,
  parseCalendarDayKey,
} from "@repo/design-system/lib/calendar/day-key";
import { Array as Arr, Option } from "effect";

/** The first day of a month as a day key, such as `2026-10-01`; `month` counts from 0. */
const firstDayKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-01`;

/** The month a day falls in, written `YYYY-MM`, which sorts as the months do. */
const monthKey = (date: Date) => getCalendarDayKey(date).slice(0, 7);

/**
 * What a calendar's caption offers between two bounds: each month of `year`, with whether it lies outside them, and
 * every year from the first bound's to the last bound's.
 */
export function captionChoices(year: number, start: Date, end: Date) {
  return {
    months: Arr.getSomes(
      Arr.makeBy(12, (month) =>
        Option.map(parseCalendarDayKey(firstDayKey(year, month)), (date) => ({
          date,
          disabled:
            monthKey(date) < monthKey(start) || monthKey(date) > monthKey(end),
          month,
        }))
      )
    ),
    years: Arr.range(start.getFullYear(), end.getFullYear()),
  };
}

/**
 * The first day of the month a caption chose, kept within the bounds: a month before them gives the first bound, and
 * one after them the last.
 */
export function chosenMonth(
  year: number,
  month: number,
  start: Date,
  end: Date
) {
  return Option.map(parseCalendarDayKey(firstDayKey(year, month)), (date) => {
    if (monthKey(date) < monthKey(start)) {
      return start;
    }
    return monthKey(date) > monthKey(end) ? end : date;
  });
}

/** The bounds a caption offers when its calendar names none: ten years on each side of the shown year. */
export function defaultBounds(year: number) {
  return {
    end: parseCalendarDayKey(firstDayKey(year + 10, 11)),
    start: parseCalendarDayKey(firstDayKey(year - 10, 0)),
  };
}
