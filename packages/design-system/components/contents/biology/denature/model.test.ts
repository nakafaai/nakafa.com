// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  amylaseIntactAt,
  evaluateAmylase,
  evaluatePepsin,
  isDigestedAt,
  OPTIMUM_PH,
  OPTIMUM_TEMPERATURE,
  pepsinIntactAt,
} from "@repo/design-system/components/contents/biology/denature/model";
import { Option } from "effect";

describe("denature lab model", () => {
  it("models reversible cold slowdown and irreversible heat denaturation for amylase", () => {
    expect(amylaseIntactAt(37)).toBe(1);
    expect(amylaseIntactAt(55)).toBeCloseTo(0.5);
    expect(amylaseIntactAt(70)).toBe(0);

    const optimal = evaluateAmylase(OPTIMUM_TEMPERATURE, OPTIMUM_TEMPERATURE);
    expect(optimal.relativeRate).toBe(1);
    expect(optimal.endpoint).toEqual(Option.some(2));
    expect(isDigestedAt(optimal.endpoint, 3)).toBe(true);
    expect(isDigestedAt(optimal.endpoint, 1)).toBe(false);

    const cold = evaluateAmylase(5, 5);
    expect(cold.intactShare).toBe(1);
    expect(cold.relativeRate).toBeLessThan(optimal.relativeRate);

    const denaturedThenCooled = evaluateAmylase(OPTIMUM_TEMPERATURE, 75);
    expect(denaturedThenCooled.intactShare).toBe(0);
    expect(denaturedThenCooled.relativeRate).toBe(0);
    expect(Option.isNone(denaturedThenCooled.endpoint)).toBe(true);
    expect(isDigestedAt(denaturedThenCooled.endpoint, 20)).toBe(false);
  });

  it("models acidic optimum and alkaline denaturation for pepsin", () => {
    expect(pepsinIntactAt(OPTIMUM_PH)).toBe(1);
    expect(pepsinIntactAt(4.7)).toBeCloseTo(0.5);
    expect(pepsinIntactAt(8)).toBe(0);

    const optimal = evaluatePepsin(OPTIMUM_PH, 1);
    expect(optimal.relativeRate).toBe(1);
    expect(optimal.endpoint).toEqual(Option.some(2.5));

    const alkaline = evaluatePepsin(9, 0);
    expect(alkaline.relativeRate).toBe(0);
    expect(Option.isNone(alkaline.endpoint)).toBe(true);
  });
});
