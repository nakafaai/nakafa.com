// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { getCalendarDayKey } from "@repo/design-system/lib/calendar/day-key";
import { DateTime } from "effect";

/** Builds a local calendar date in the runtime zone; the month is one based. */
function localDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
) {
  return DateTime.toDateUtc(
    DateTime.makeZonedUnsafe(
      { year, month, day, hour, minute, second },
      { timeZone: DateTime.zoneMakeLocal(), adjustForTimeZone: true }
    )
  );
}

describe("calendar day key", () => {
  it("serializes local calendar parts as a zero-padded ISO-style key", () => {
    const date = localDate(2026, 1, 5, 23, 59, 59);

    expect(getCalendarDayKey(date)).toBe("2026-01-05");
  });

  it("ignores the time within the same local calendar day", () => {
    const morning = localDate(2026, 11, 15, 0, 0, 1);
    const evening = localDate(2026, 11, 15, 23, 59, 59);

    expect(getCalendarDayKey(morning)).toBe("2026-11-15");
    expect(getCalendarDayKey(evening)).toBe(getCalendarDayKey(morning));
  });
});
