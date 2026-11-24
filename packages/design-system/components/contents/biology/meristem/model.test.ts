import { describe, expect, it } from "@effect/vitest";
import {
  evaluatePrimaryZone,
  evaluateSecondaryGrowth,
} from "@repo/design-system/components/contents/biology/meristem/model";

describe("meristem growth model", () => {
  it("classifies primary growth zones along the root or shoot axis", () => {
    expect(evaluatePrimaryZone(-10)).toEqual({
      axisY: 0.24,
      position: 0,
      zone: "division",
    });
    expect(evaluatePrimaryZone(50).zone).toBe("elongation");
    expect(evaluatePrimaryZone(120)).toEqual({
      axisY: 1.36,
      position: 100,
      zone: "differentiation",
    });
  });

  it("clamps stem years and expands xylem radius with annual rings", () => {
    const young = evaluateSecondaryGrowth(0);
    const mature = evaluateSecondaryGrowth(6);
    const capped = evaluateSecondaryGrowth(15);

    expect(young.ringCount).toBe(1);
    expect(mature.ringCount).toBe(6);
    expect(mature.xylemRadius).toBeGreaterThan(young.xylemRadius);
    expect(mature.outerRadius).toBeGreaterThan(mature.xylemRadius);
    expect(capped.ringCount).toBe(10);
  });
});
