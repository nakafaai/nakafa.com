// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  DROP_LENGTH,
  dropTravel,
  fillDepth,
  quotient,
  scaleNumbers,
  scaleSpan,
  substrateOf,
  thermometerShare,
} from "@repo/design-system/components/contents/biology/respirometer/gas";

describe("respirometer", () => {
  it("moves the liquid by the oxygen taken in where potassium hydroxide absorbs the carbon dioxide", () => {
    expect(dropTravel("potash", 30, 21, 20, 20)).toBe(30);
    expect(dropTravel("potash", 30, 21, 10, 20)).toBe(15);
  });

  it("moves the liquid by the oxygen less the carbon dioxide over water", () => {
    expect(dropTravel("water", 30, 21, 20, 20)).toBe(9);
    expect(dropTravel("water", 20, 26, 20, 20)).toBe(-6);
  });

  it("names the substrate from the quotient", () => {
    expect(quotient(30, 21)).toBeCloseTo(0.7, 12);
    expect(substrateOf(0.7)).toBe("fat");
    expect(substrateOf(0.9)).toBe("protein");
    expect(substrateOf(1)).toBe("carbohydrate");
    expect(dropTravel("water", 30, 30, 20, 20)).toBe(0);
    expect(substrateOf(quotient(30, 30))).toBe("carbohydrate");
    expect(substrateOf(1.3)).toBe("anaerobic");
  });

  it("runs the scale from behind the 2 cm drop's tail to a round ten past the farthest drop", () => {
    expect(DROP_LENGTH).toBe(20);
    expect(scaleSpan(30, 21)).toEqual({ back: 0, from: -30, to: 40 });
    expect(scaleSpan(20, 26)).toEqual({ back: -6, from: -40, to: 30 });
    expect(scaleSpan(30, 30)).toEqual({ back: 0, from: -30, to: 40 });
  });

  it("numbers the scale from zero, or from behind a drop that backs away", () => {
    expect(scaleNumbers(0, 40, 10)).toEqual([0, 10, 20, 30, 40]);
    expect(scaleNumbers(0, 40, 20)).toEqual([0, 20, 40]);
    expect(scaleNumbers(-6, 30, 10)).toEqual([-10, 0, 10, 20, 30]);
  });

  it("stands 5 cm³ of solution 16.2 mm deep in a boiling tube of 11.3 mm inner radius", () => {
    expect(fillDepth(5e-6, 0.0113)).toBeCloseTo(0.016_231, 6);
  });

  it("stands a little liquid in the round foot as a spherical cap", () => {
    const radius = 0.0113;
    const cap = (Math.PI * 0.005 ** 2 * (3 * radius - 0.005)) / 3;
    expect(fillDepth(cap, radius)).toBeCloseTo(0.005, 9);
  });

  it("fills a third of a −10 to 110 °C thermometer's scale at 30 °C", () => {
    expect(thermometerShare(30)).toBeCloseTo(1 / 3, 12);
    expect(thermometerShare(-10)).toBe(0);
    expect(thermometerShare(110)).toBe(1);
  });
});
