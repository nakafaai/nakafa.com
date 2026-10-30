import { describe, expect, it } from "@effect/vitest";
import {
  getCalendarDayKey,
  parseCalendarDayKey,
} from "@repo/design-system/lib/calendar/day-key";
import {
  captionChoices,
  chosenMonth,
  defaultBounds,
} from "@repo/design-system/lib/calendar/month";
import { Array as Arr, Option } from "effect";

/** The local start of the day a key names, which every key here does. */
const day = (key: string) => Option.getOrThrow(parseCalendarDayKey(key));

/** The months of a caption that lie outside its bounds. */
const disabledMonths = (months: ReturnType<typeof captionChoices>["months"]) =>
  Arr.map(
    Arr.filter(months, (month) => month.disabled),
    (month) => month.month
  );

describe("calendar caption", () => {
  it("offers every month of the year and the years between the bounds, marking the months outside them", () => {
    const choices = captionChoices(2026, day("2026-03-15"), day("2027-06-01"));

    expect(choices.years).toEqual([2026, 2027]);
    expect(Arr.map(choices.months, (month) => month.month)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(disabledMonths(choices.months)).toEqual([0, 1]);
    expect(
      Arr.get(
        Arr.map(choices.months, (month) => getCalendarDayKey(month.date)),
        3
      )
    ).toEqual(Option.some("2026-04-01"));
  });

  it("marks the months after the last bound", () => {
    const choices = captionChoices(2027, day("2026-03-15"), day("2027-06-01"));

    expect(disabledMonths(choices.months)).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it("goes to the first day of the chosen month, kept within the bounds", () => {
    const start = day("2026-03-15");
    const end = day("2027-06-01");
    const key = (month: Option.Option<Date>) =>
      Option.map(month, getCalendarDayKey);

    expect(key(chosenMonth(2026, 9, start, end))).toEqual(
      Option.some("2026-10-01")
    );
    expect(key(chosenMonth(2026, 0, start, end))).toEqual(
      Option.some("2026-03-15")
    );
    expect(key(chosenMonth(2027, 11, start, end))).toEqual(
      Option.some("2027-06-01")
    );
  });

  it("offers ten years on each side of the shown year when the calendar names no bounds", () => {
    const bounds = defaultBounds(2026);

    expect(Option.map(bounds.start, getCalendarDayKey)).toEqual(
      Option.some("2016-01-01")
    );
    expect(Option.map(bounds.end, getCalendarDayKey)).toEqual(
      Option.some("2036-12-01")
    );
  });
});
