import { describe, expect, it } from "@effect/vitest";
import { gridSteps, stepValues } from "@repo/design-system/lib/geometry/step";

describe("grid steps", () => {
  it("rounds the major step up to 1, 2 or 5 times a power of ten, so four to ten numbered lines cross a span", () => {
    expect(gridSteps(4)).toStrictEqual({ digits: 0, major: 1, minor: 0.2 });
    expect(gridSteps(7.6)).toStrictEqual({ digits: 0, major: 2, minor: 0.5 });
    expect(gridSteps(14)).toStrictEqual({ digits: 0, major: 5, minor: 1 });
    expect(gridSteps(30)).toStrictEqual({ digits: 0, major: 10, minor: 2 });
    expect(gridSteps(0.6)).toStrictEqual({
      digits: 1,
      major: 0.2,
      minor: 0.05,
    });
    expect(gridSteps(0.03)).toStrictEqual({
      digits: 2,
      major: 0.01,
      minor: 0.002,
    });
  });

  it("keeps a usable step for a span that has none", () => {
    expect(gridSteps(0)).toStrictEqual({ digits: 0, major: 1, minor: 0.2 });
    expect(gridSteps(Number.NaN).major).toBe(1);
  });
});

describe("step values", () => {
  it("lists the multiples of a step inside a range, leaving out zero and stopping at the limit", () => {
    expect(stepValues({ max: 6, min: -2.5 }, 2, 10)).toStrictEqual([
      -2, 2, 4, 6,
    ]);
    expect(stepValues({ max: 39, min: 35 }, 1, 2)).toStrictEqual([35, 36]);
    expect(stepValues({ max: 0.4, min: 0.1 }, 1, 10)).toStrictEqual([]);
    expect(stepValues({ max: Number.NaN, min: 0 }, 1, 10)).toStrictEqual([]);
  });
});
