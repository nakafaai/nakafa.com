// @vitest-environment node
import { getCalendarDayKey } from "@repo/design-system/lib/calendar/day-key";
import { describe, expect, it } from "vitest";

describe("calendar day key", () => {
  it("serializes local calendar parts as a zero-padded ISO-style key", () => {
    const date = new Date(2026, 0, 5, 23, 59, 59);

    expect(getCalendarDayKey(date)).toBe("2026-01-05");
  });

  it("ignores the time within the same local calendar day", () => {
    const morning = new Date(2026, 10, 15, 0, 0, 1);
    const evening = new Date(2026, 10, 15, 23, 59, 59);

    expect(getCalendarDayKey(morning)).toBe("2026-11-15");
    expect(getCalendarDayKey(evening)).toBe(getCalendarDayKey(morning));
  });
});
