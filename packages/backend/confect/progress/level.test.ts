import { describe, expect, it } from "@effect/vitest";
import { growthOf, opensAt } from "@repo/backend/confect/progress/level";

describe("progress/level", () => {
  it("opens a level at its lifetime Stars", () => {
    expect(growthOf(0)).toEqual({ from: 0, level: 1, next: 100 });
    expect(growthOf(99)).toEqual({ from: 0, level: 1, next: 100 });
    expect(growthOf(100)).toEqual({ from: 100, level: 2, next: 250 });
    expect(growthOf(700)).toEqual({ from: 700, level: 5, next: 1000 });
  });

  it("asks for 50 Stars more each level, eighteen times, then 1,000 for good", () => {
    expect(opensAt(19) - opensAt(18)).toBe(950);
    expect(opensAt(20) - opensAt(19)).toBe(1000);
    expect(opensAt(500) - opensAt(499)).toBe(1000);
    expect(growthOf(opensAt(19) - 1).level).toBe(18);
    expect(growthOf(opensAt(19))).toEqual({
      from: 9450,
      level: 19,
      next: 10_450,
    });
  });

  it("never runs out of levels", () => {
    expect(growthOf(1_000_000)).toEqual({
      from: 999_450,
      level: 1009,
      next: 1_000_450,
    });
  });
});
