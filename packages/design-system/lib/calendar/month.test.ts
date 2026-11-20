import { describe, expect, it } from "@effect/vitest";
import { boundedMonth } from "@repo/design-system/lib/calendar/month";

describe("calendar caption", () => {
  it("turns to the chosen month, written as a month key", () => {
    expect(boundedMonth(2026, 3, {})).toBe("2026-03");
    expect(
      boundedMonth(2026, 11, { max: "2027-01-31", min: "2026-01-01" })
    ).toBe("2026-11");
  });

  it("keeps a month before the first day at the first day's month", () => {
    expect(boundedMonth(2026, 1, { min: "2026-03-15" })).toBe("2026-03");
  });

  it("keeps a month after the last day at the last day's month", () => {
    expect(boundedMonth(2027, 9, { max: "2027-06-01" })).toBe("2027-06");
  });
});
