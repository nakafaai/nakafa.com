import { describe, expect, it } from "@effect/vitest";
import { proratedPrice, termOf } from "@repo/backend/confect/billing/term";

const DAY = 24 * 60 * 60 * 1000;

describe("billing/term", () => {
  it("bills an Indonesian school by its school year from July and its semesters in Jakarta", () => {
    // 26 Oct 2026, 12:00 in Jakarta.
    const now = Date.UTC(2026, 9, 26, 5, 0, 0);
    expect(termOf("school.seat.year", "ID", now)).toStrictEqual({
      start: Date.UTC(2026, 5, 30, 17, 0, 0),
      end: Date.UTC(2027, 5, 30, 17, 0, 0),
    });
    expect(termOf("school.seat.semester", "ID", now)).toStrictEqual({
      start: Date.UTC(2026, 5, 30, 17, 0, 0),
      end: Date.UTC(2026, 11, 31, 17, 0, 0),
    });
    // 15 Feb 2027 is in the second semester of the school year 2026/2027.
    expect(
      termOf("school.seat.semester", "ID", Date.UTC(2027, 1, 15))
    ).toStrictEqual({
      start: Date.UTC(2026, 11, 31, 17, 0, 0),
      end: Date.UTC(2027, 5, 30, 17, 0, 0),
    });
  });

  it("runs the school year of a country without a profile from January in UTC", () => {
    expect(
      termOf("school.seat.year", "NL", Date.UTC(2026, 9, 26))
    ).toStrictEqual({
      start: Date.UTC(2026, 0, 1),
      end: Date.UTC(2027, 0, 1),
    });
  });

  it("charges the share of the days still to run, rounded up, and the whole price from the start", () => {
    const term = { start: 0, end: 10 * DAY };
    expect(proratedPrice(100_000, term, 0)).toBe(100_000);
    expect(proratedPrice(100_000, term, -DAY)).toBe(100_000);
    expect(proratedPrice(100_000, term, 7 * DAY)).toBe(30_000);
    expect(proratedPrice(60_000, term, 7 * DAY + 1)).toBe(18_000);
    expect(proratedPrice(100, { start: 0, end: 3 * DAY }, DAY)).toBe(67);
  });
});
