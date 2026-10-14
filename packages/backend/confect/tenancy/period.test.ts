import { describe, expect, it } from "@effect/vitest";
import { parseCivilDate } from "@repo/backend/confect/tenancy/period";
import { Option } from "effect";

describe("tenancy/period parseCivilDate", () => {
  it("reads a calendar date as written, on the clock of any zone", () => {
    expect(Option.getOrNull(parseCivilDate("2026-12-31", "Asia/Jakarta"))).toBe(
      "2026-12-31"
    );
    expect(
      Option.getOrNull(parseCivilDate("2026-12-31", "Pacific/Kiritimati"))
    ).toBe("2026-12-31");
  });

  it("refuses a day that the calendar does not have, whatever the zone rolls it to", () => {
    expect(
      Option.getOrNull(parseCivilDate("2026-02-30", "Asia/Jakarta"))
    ).toBeNull();
    expect(
      Option.getOrNull(parseCivilDate("2025-02-29", "Asia/Jakarta"))
    ).toBeNull();
    expect(Option.getOrNull(parseCivilDate("2028-02-29", "Asia/Jakarta"))).toBe(
      "2028-02-29"
    );
  });

  it("refuses text that is not a calendar date written YYYY-MM-DD", () => {
    expect(
      Option.getOrNull(parseCivilDate("2026-7-1", "Asia/Jakarta"))
    ).toBeNull();
    expect(
      Option.getOrNull(parseCivilDate("2026-07-01T10:00", "Asia/Jakarta"))
    ).toBeNull();
    expect(
      Option.getOrNull(parseCivilDate(" 2026-07-01", "Asia/Jakarta"))
    ).toBeNull();
  });

  it("refuses a time zone that Effect cannot place", () => {
    expect(
      Option.getOrNull(parseCivilDate("2026-07-01", "Mars/Olympus"))
    ).toBeNull();
  });
});
