import { describe, expect, it } from "@effect/vitest";
import {
  evaluateGrowthCurve,
  sampleGrowthCurve,
} from "@repo/design-system/components/contents/biology/growth/model";
import { Array as Arr, Option } from "effect";

describe("plant growth curve model", () => {
  it("models all five sigmoid phases for annual plants", () => {
    expect(evaluateGrowthCurve("annual", 5).phase).toBe("lag");
    expect(evaluateGrowthCurve("annual", 42).phase).toBe("exponential");
    expect(evaluateGrowthCurve("annual", 62).phase).toBe("slowing");
    expect(evaluateGrowthCurve("annual", 78).phase).toBe("stationary");
    expect(evaluateGrowthCurve("annual", 95).phase).toBe("senescence");
  });

  it("models biennial two-season dip and senescence", () => {
    const winter = evaluateGrowthCurve("biennial", 47);
    const secondSurge = evaluateGrowthCurve("biennial", 68);
    const end = evaluateGrowthCurve("biennial", 96);

    expect(secondSurge.dryMass).toBeGreaterThan(winter.dryMass);
    expect(end.phase).toBe("senescence");
  });

  it("models perennial multi-season stepped growth without terminal senescence", () => {
    const start = evaluateGrowthCurve("perennial", 0);
    const mid = evaluateGrowthCurve("perennial", 50);
    const late = evaluateGrowthCurve("perennial", 96);

    expect(mid.dryMass).toBeGreaterThan(start.dryMass);
    expect(late.dryMass).toBeGreaterThan(mid.dryMass);
    expect(late.phase).toBe("stationary");
  });

  it("samples curves monotonically in time with default and minimum step guards", () => {
    const defaultCurve = sampleGrowthCurve("annual");
    expect(defaultCurve).toHaveLength(41);
    const curve = sampleGrowthCurve("annual", 2);
    expect(curve).toHaveLength(5);
    expect(curve[0]?.time).toBe(0);
    expect(Option.getOrUndefined(Arr.last(curve))?.time).toBe(100);
  });
});
