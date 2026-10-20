import { describe, expect, it } from "@effect/vitest";
import {
  schoolDateTimeText,
  schoolWeekdayTimeText,
} from "@/components/tenant/settings/clock";

/** 17:00 UTC on 18 October 2026: 12:00 AM the next day in Jakarta, and 2:00 AM in Tokyo. */
const AT = Date.UTC(2026, 9, 18, 17, 0);

describe("components/tenant/settings/clock", () => {
  it("writes the weekday and the time of the moment in the time zone of the school", () => {
    expect(
      schoolWeekdayTimeText({
        at: AT,
        locale: "en",
        timeZone: "Asia/Jakarta",
      })
    ).toBe("Mon 12:00 AM");
    expect(
      schoolWeekdayTimeText({ at: AT, locale: "fr", timeZone: "Asia/Jakarta" })
    ).toBeUndefined();
  });

  it("writes the moment in the time zone of the school", () => {
    const jakarta = schoolDateTimeText({
      at: AT,
      locale: "en",
      timeZone: "Asia/Jakarta",
    });
    const tokyo = schoolDateTimeText({
      at: AT,
      locale: "en",
      timeZone: "Asia/Tokyo",
    });
    expect(jakarta).toContain("12:00");
    expect(tokyo).toContain("2:00");
  });

  it("writes nothing for a language that is not an active one", () => {
    expect(
      schoolDateTimeText({ at: AT, locale: "fr", timeZone: "Asia/Jakarta" })
    ).toBeUndefined();
  });

  it("writes nothing for a time zone that is not a known one", () => {
    expect(
      schoolDateTimeText({ at: AT, locale: "en", timeZone: "Mars/Olympus" })
    ).toBeUndefined();
  });
});
