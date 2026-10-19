import { DateTime } from "effect";

/** Writes a calendar date as `YYYY-MM-DD`. */
const civilDate = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * The school year that a day falls in, for a country whose school year starts
 * on the first day of `startMonth`: its name, and its first and last calendar
 * day. A year that starts in January is named by its calendar year, `2027`;
 * any other is named by both years it spans, `2026/2027`, as Indonesia writes
 * its tahun ajaran.
 */
export const schoolYear = (today: DateTime.Zoned, startMonth: number) => {
  const parts = DateTime.toParts(today);
  const first = parts.month >= startMonth ? parts.year : parts.year - 1;
  if (startMonth === 1) {
    return {
      end: civilDate(first, 12, 31),
      name: String(first),
      start: civilDate(first, 1, 1),
    };
  }
  const last = DateTime.toPartsUtc(
    DateTime.subtract(
      DateTime.makeUnsafe({ day: 1, month: startMonth, year: first + 1 }),
      { days: 1 }
    )
  );
  return {
    end: civilDate(last.year, last.month, last.day),
    name: `${first}/${first + 1}`,
    start: civilDate(first, startMonth, 1),
  };
};
