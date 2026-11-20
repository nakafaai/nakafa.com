// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { axisOf } from "@repo/design-system/components/contents/mathematics/journey/axis";

describe("the scale of an axis", () => {
  it("takes the tidy step nearest the steps asked for, and reaches past the farthest point", () => {
    expect(axisOf(20, 5)).toEqual({
      step: 5,
      ticks: [0, 5, 10, 15, 20],
      top: 20,
    });
    expect(axisOf(90, 6)).toEqual({
      step: 20,
      ticks: [0, 20, 40, 60, 80, 100],
      top: 100,
    });
    expect(axisOf(12, 6).step).toBe(2);
  });

  it("keeps between three and eight steps even when asked for more", () => {
    const crowded = axisOf(9, 40);
    expect(crowded.top / crowded.step).toBeLessThanOrEqual(8);
    expect(axisOf(1, 1).ticks.length - 1).toBeGreaterThanOrEqual(3);
  });

  it("takes the larger step when two are as near, and is not thrown by rounding", () => {
    expect(axisOf(30, 4.5).step).toBe(10);
    expect(axisOf(3, 6)).toEqual({
      step: 0.5,
      ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3],
      top: 3,
    });
  });
});
