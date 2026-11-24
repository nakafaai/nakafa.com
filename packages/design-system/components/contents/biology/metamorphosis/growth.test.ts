import { describe, expect, it } from "@effect/vitest";
import {
  clampTime,
  growthAt,
  lengthCurvePoints,
} from "@repo/design-system/components/contents/biology/metamorphosis/growth";

describe("clampTime and growthAt", () => {
  it("progresses grasshopper through egg, stepped nymph instars, and winged adult", () => {
    expect(clampTime(-0.5)).toBe(0);
    expect(clampTime(2)).toBe(1);
    expect(growthAt("grasshopper", 0.02).stage).toBe("egg");
    const early = growthAt("grasshopper", 0.15);
    const late = growthAt("grasshopper", 0.72);
    expect(early.stage).toBe("nymph");
    expect(late.lengthMm).toBeGreaterThan(early.lengthMm);
    expect(late.moults).toBeGreaterThan(early.moults);
    expect(growthAt("grasshopper", 0.95)).toMatchObject({
      moults: 5,
      stage: "adult",
    });
  });

  it("progresses butterfly through egg, larva, pupa, and adult", () => {
    expect(growthAt("butterfly", 0.02).stage).toBe("egg");
    expect(growthAt("butterfly", 0.4).stage).toBe("larva");
    expect(growthAt("butterfly", 0.8).stage).toBe("pupa");
    expect(growthAt("butterfly", 0.96).stage).toBe("adult");
  });
});

describe("lengthCurvePoints", () => {
  it("produces 36 stepped curve vertices for both insects", () => {
    expect(lengthCurvePoints("grasshopper")).toHaveLength(36);
    expect(lengthCurvePoints("butterfly")).toHaveLength(36);
  });
});
