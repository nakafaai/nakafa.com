import { describe, expect, it } from "@effect/vitest";
import {
  reachedKktp,
  squaredError,
  verdictOf,
} from "@repo/backend/confect/insight/calibration";

describe("insight/calibration", () => {
  it("counts a student at the KKTP as reaching it", () => {
    expect(reachedKktp(70, 100, 70)).toBe(true);
    expect(reachedKktp(69, 100, 70)).toBe(false);
  });

  it("charges a forecast the square of its distance from what happened", () => {
    expect(squaredError(0.75, true)).toBe(0.0625);
    expect(squaredError(0.75, false)).toBe(0.5625);
  });

  it("passes a forecast that beats the month's base rate", () => {
    expect(verdictOf({ count: 400, errors: 40, reached: 200 })).toEqual({
      baseline: 0.25,
      brier: 0.1,
      count: 400,
      passed: true,
    });
  });

  it("fails a forecast no better than the month's base rate", () => {
    expect(verdictOf({ count: 400, errors: 100, reached: 200 }).passed).toBe(
      false
    );
  });

  it("does not fail a month with too few forecasts to say", () => {
    expect(verdictOf({ count: 199, errors: 199, reached: 100 }).passed).toBe(
      true
    );
  });
});
