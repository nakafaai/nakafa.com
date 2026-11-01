import { describe, expect, it } from "@effect/vitest";
import { chanceOf, ratingAfter } from "@repo/backend/confect/insight/mastery";

describe("insight/mastery", () => {
  it("is a plain mean for the first ten answers, then leans on the latest", () => {
    expect(ratingAfter(0, 0, 1)).toBe(1);
    expect(ratingAfter(1, 1, 0)).toBe(0.5);
    expect(ratingAfter(0.5, 9, 1)).toBeCloseTo(0.55);
    expect(ratingAfter(0.5, 40, 1)).toBeCloseTo(0.55);
  });

  it("grows with the points earned, and stays near even with little evidence", () => {
    expect(chanceOf(0, 0, 50)).toBeCloseTo(0.5);
    expect(chanceOf(9, 10, 75)).toBeGreaterThan(0.7);
    expect(chanceOf(3, 9, 75)).toBeLessThan(0.05);
    expect(chanceOf(30, 40, 75)).toBeGreaterThan(chanceOf(3, 4, 75) - 0.2);
  });
});
