// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  activity,
  CARDINAL,
  carbonDioxideOut,
  deadVolume,
  dissolvedCapacity,
  exhaustedAt,
  flowShare,
  gasFlow,
  gasOut,
  glucoseStock,
  madeAt,
  molarVolume,
  plugDepth,
  productionRate,
  yeastMass,
} from "@repo/design-system/components/contents/biology/yeast/ferment";

describe("yeast fermentation", () => {
  it("works fastest at the optimum and not at all outside the cardinal range", () => {
    expect(activity(CARDINAL.optimum)).toBeCloseTo(1, 12);
    expect(activity(CARDINAL.minimum)).toBe(0);
    expect(activity(CARDINAL.maximum)).toBe(0);
    expect(activity(0)).toBe(0);
    expect(activity(60)).toBe(0);
  });

  it("is slow in the cold and falls steeply just below the maximum", () => {
    expect(activity(10)).toBeCloseTo(0.135, 3);
    expect(activity(20)).toBeCloseTo(0.597, 3);
    expect(activity(35)).toBeCloseTo(0.967, 3);
    expect(activity(44)).toBeCloseTo(0.23, 2);
    expect(activity(44)).toBeLessThan(activity(15));
  });

  it("ferments at the assayed capacity of 20.5 mmol per gram an hour at 30 °C", () => {
    expect(yeastMass()).toBe(0.25);
    expect(productionRate(30)).toBeCloseTo((20.5 * 0.25) / 60, 12);
    expect(productionRate(50)).toBe(0);
  });

  it("makes two carbon dioxide for each glucose until the glucose is gone", () => {
    const stock = glucoseStock(5);

    expect(stock).toBeCloseTo((0.75 / 180.156) * 1000, 12);
    expect(madeAt(30, 5, 10)).toBeCloseTo(productionRate(30) * 10, 12);
    expect(exhaustedAt(30, 5)).toBeCloseTo(97.5, 1);
    expect(madeAt(30, 5, 200)).toBeCloseTo(2 * stock, 12);
    expect(exhaustedAt(50, 5)).toBe(Number.POSITIVE_INFINITY);
  });

  it("dissolves carbon dioxide first, and less of it in warm water", () => {
    expect(dissolvedCapacity(25)).toBeCloseTo(
      3.3e-4 * 101_325 * 2e-5 * 1000,
      12
    );
    expect(dissolvedCapacity(40)).toBeLessThan(dissolvedCapacity(20));
    expect(molarVolume(0)).toBeCloseTo(22.414, 3);
  });

  it("lets gas out only once the solution is saturated and while glucose lasts", () => {
    expect(gasOut(30, 5, 5)).toBe(0);
    expect(gasFlow(30, 5, 5)).toBe(0);
    expect(gasOut(30, 5, 20)).toBeCloseTo(
      (madeAt(30, 5, 20) - dissolvedCapacity(30)) * molarVolume(30),
      12
    );
    expect(gasFlow(30, 5, 20)).toBeCloseTo(
      productionRate(30) * molarVolume(30),
      12
    );
    expect(gasFlow(30, 5, 120)).toBe(0);
    expect(gasFlow(10, 5, 60)).toBe(0);
    expect(flowShare(CARDINAL.optimum, 5, 30)).toBeCloseTo(1, 12);
    expect(flowShare(20, 5, 30)).toBeGreaterThan(0);
    expect(flowShare(20, 5, 30)).toBeLessThan(1);
  });

  it("pushes the air above the oil out before carbon dioxide reaches the limewater", () => {
    const dead = deadVolume();

    expect(plugDepth()).toBeCloseTo((0.025 * 0.0013) / 0.003, 12);
    expect(dead).toBeCloseTo(34.3, 1);
    expect(carbonDioxideOut(0)).toBe(0);
    expect(carbonDioxideOut(dead)).toBeCloseTo(dead / Math.E, 12);
    expect(carbonDioxideOut(400)).toBeCloseTo(400 - dead, 2);
  });
});
