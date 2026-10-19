import { describe, expect, it } from "@effect/vitest";
import { schoolYear } from "@repo/backend/confect/tenancy/year";
import { DateTime } from "effect";

/** A day on the clock of one zone. */
const day = (iso: string, timeZone: string) =>
  DateTime.makeZonedUnsafe(iso, { adjustForTimeZone: true, timeZone });

describe("tenancy/year", () => {
  it("names an Indonesian tahun ajaran from July to June on either side of the new year", () => {
    const year = {
      end: "2027-06-30",
      name: "2026/2027",
      start: "2026-07-01",
    };
    expect(schoolYear(day("2026-10-18T09:00:00", "Asia/Jakarta"), 7)).toEqual(
      year
    );
    expect(schoolYear(day("2027-03-02T09:00:00", "Asia/Jakarta"), 7)).toEqual(
      year
    );
  });

  it("reads the day on the school's own clock, not in UTC", () => {
    expect(
      schoolYear(day("2026-07-01T05:00:00", "Asia/Jayapura"), 7).name
    ).toBe("2026/2027");
  });

  it("names a year that starts in January by its calendar year", () => {
    expect(schoolYear(day("2026-10-18T09:00:00", "Asia/Singapore"), 1)).toEqual(
      { end: "2026-12-31", name: "2026", start: "2026-01-01" }
    );
  });

  it("ends a year on the last day before the next one starts, a leap day included", () => {
    expect(schoolYear(day("2027-05-10T09:00:00", "Europe/London"), 3)).toEqual({
      end: "2028-02-29",
      name: "2027/2028",
      start: "2027-03-01",
    });
  });
});
