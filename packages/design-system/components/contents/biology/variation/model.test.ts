import { describe, expect, it } from "@effect/vitest";
import { evaluateVariationBars } from "@repo/design-system/components/contents/biology/variation/model";

describe("variation distribution model", () => {
  it("builds a symmetric bell curve for continuous polygenic traits and discrete bars otherwise", () => {
    const continuous = evaluateVariationBars("continuous", 3);
    const discrete = evaluateVariationBars("discontinuous", 3);

    expect(continuous.length).toBe(7);
    expect(continuous[3]?.height).toBe(1);
    expect(continuous[0]?.height).toBe(continuous[6]?.height);
    expect(discrete.length).toBe(4);
  });
});
