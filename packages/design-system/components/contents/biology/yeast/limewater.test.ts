// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  absorbedShare,
  bubbleGrowth,
  bubbleRate,
  bubbleRisen,
  bubbleVolume,
  calcium,
  chalkAt,
  FINE,
  fineRiseSpeed,
  fizzCount,
  isMilky,
  milkiness,
  outletDepth,
  riseSpeed,
  sphereDiameter,
} from "@repo/design-system/components/contents/biology/yeast/limewater";

describe("limewater", () => {
  it("frees a bubble of about 0.09 mL, 5.6 mm across, from a 4 mm bore", () => {
    expect(bubbleVolume()).toBeCloseTo(0.0925, 4);
    expect(sphereDiameter(bubbleVolume())).toBeCloseTo(0.0056, 4);
    expect(bubbleRate(2.3)).toBeCloseTo(2.3 / bubbleVolume(), 12);
  });

  it("raises a millimetre bubble at about 23 cm/s and a fine one at about 7 cm/s", () => {
    expect(riseSpeed(sphereDiameter(bubbleVolume()))).toBeCloseTo(0.231, 3);
    expect(fineRiseSpeed(6e-4)).toBeCloseTo(0.0704, 3);
  });

  it("takes up about a sixth of each bubble's carbon dioxide on its way up", () => {
    expect(outletDepth()).toBeCloseTo(0.0538, 4);
    expect(absorbedShare()).toBeCloseTo(0.171, 3);
  });

  it("precipitates chalk until the calcium is used up", () => {
    expect(calcium()).toBeCloseTo((1.73 / 74.093) * 10, 12);
    expect(chalkAt(1)).toBeCloseTo(absorbedShare(), 12);
    expect(chalkAt(100)).toBe(calcium());
  });

  it("turns milky long before the calcium is gone", () => {
    expect(milkiness(0)).toBe(0);
    expect(isMilky(milkiness(0.002))).toBe(false);
    expect(isMilky(milkiness(0.01))).toBe(true);
    expect(milkiness(calcium())).toBeCloseTo(1, 6);
  });

  it("grows a bubble on the tube's end and sends the last one up", () => {
    expect(bubbleGrowth(20, 7.3)).toBeCloseTo(1.3 / 3, 12);
    expect(bubbleRisen(20, 7.3)).toBeCloseTo(
      1.3 * riseSpeed(sphereDiameter(bubbleVolume())),
      12
    );
    expect(bubbleGrowth(0, 7.3)).toBe(0);
    expect(bubbleRisen(0, 7.3)).toBe(Number.POSITIVE_INFINITY);
  });

  it("shows the fine bubbles of the shell against the glass", () => {
    const each = (Math.PI / 6) * FINE ** 3 * 1e6;
    const expected =
      ((2.1 / 60 / each) * 0.05 * ((2 * FINE) / 0.011)) /
      (2 * fineRiseSpeed(FINE));

    expect(fizzCount(2.1, 0.05, 0.011)).toBeCloseTo(expected, 9);
    expect(fizzCount(2.1, 0.05, 0.011)).toBeCloseTo(12, 1);
    expect(fizzCount(0, 0.05, 0.011)).toBe(0);
  });
});
