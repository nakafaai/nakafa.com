import { constructFilterFn } from "@tanstack/react-table";
import {
  Array as Arr,
  DateTime,
  Option,
  Order,
  Record as Rec,
  Schema,
} from "effect";

/** A civil day as its key, such as `2026-10-31`. */
const DayKey = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u));

/**
 * The days that a date column keeps, as its head chooses them and the page's filters hold them: the first day and the
 * last, each as its key, the first never after the last.
 */
const DayRange = Schema.Tuple([DayKey, DayKey]);

/** The day that a moment falls on in a time zone, as its key: the day the school's clock shows for it. */
export const dayOfMoment = (at: number, timeZone: string) =>
  DateTime.formatIsoDate(DateTime.makeZonedUnsafe(at, { timeZone }));

/** Two chosen days as a range in their order, so a range picked from its end still reads first to last. */
export const dayRangeOf = (first: string, last: string) =>
  Arr.sort([first, last], Order.String);

/** The days a date column keeps, as the page's filters hold them under the column's ID, or none while it keeps all. */
export const chosenDays = (
  chosen: Readonly<Record<string, readonly string[]>>,
  column: string
) => Option.filter(Rec.get(chosen, column), Schema.is(DayRange));

/** Whether a column's choice holds no range of days, so it filters nothing and the table drops it. */
export const holdsNoDays = (chosen: unknown) => !Schema.is(DayRange)(chosen);

/**
 * Whether a cell's moment falls on one of the chosen days, as the school's clock in `timeZone` shows it, so a row is
 * kept for the day the table prints for it.
 */
export const fallsOnDaysIn =
  (timeZone: string) => (value: unknown, chosen: unknown) => {
    if (!(Schema.is(Schema.Finite)(value) && Schema.is(DayRange)(chosen))) {
      return false;
    }
    const day = dayOfMoment(value, timeZone);
    return chosen[0] <= day && day <= chosen[1];
  };

/** Keeps the rows whose moment falls on one of the chosen days in the school's time zone. */
export const withinDays = (timeZone: string) =>
  constructFilterFn({
    autoRemove: holdsNoDays,
    filter: fallsOnDaysIn(timeZone),
  });

/**
 * What a column of moments adds to its definition so its head chooses days as well as sorting: the filter in the
 * school's time zone and the head that chooses them. Before the school's time zone is known, the column only sorts.
 */
export const daysColumn = (timeZone: Option.Option<string>) =>
  Option.match(timeZone, {
    onNone: () => ({}),
    onSome: (zone) => ({
      filterFn: withinDays(zone),
      meta: { filter: "days" as const },
    }),
  });
