// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { exhaustedAt } from "@repo/design-system/components/contents/biology/yeast/ferment";
import {
  fermentationHeat,
  heatPower,
  riseAt,
  settling,
  steadyRise,
} from "@repo/design-system/components/contents/biology/yeast/warmth";

describe("the warmth of fermentation", () => {
  it("gives off 68.9 kJ for each mole of glucose fermented", () => {
    expect(fermentationHeat()).toBeCloseTo(68.9, 9);
    expect(heatPower(30)).toBeCloseTo(
      (((20.5 * 0.25) / 60 / 2) * 68.9) / 60,
      9
    );
  });

  it("warms the yeast tube only a fifth of a degree above the bath", () => {
    expect(steadyRise(32.27)).toBeCloseTo(0.182, 3);
    expect(steadyRise(10)).toBeLessThan(steadyRise(30));
    expect(settling(30)).toBeCloseTo(5.085, 2);
  });

  it("settles at its rise while fermenting and cools once the glucose is gone", () => {
    expect(riseAt(30, 5, 0)).toBe(0);
    expect(riseAt(30, 5, 60)).toBeCloseTo(steadyRise(30), 4);
    const end = exhaustedAt(30, 1);
    expect(riseAt(30, 1, end + settling(30))).toBeCloseTo(
      riseAt(30, 1, end) / Math.E,
      12
    );
    expect(riseAt(50, 5, 60)).toBe(0);
  });
});
