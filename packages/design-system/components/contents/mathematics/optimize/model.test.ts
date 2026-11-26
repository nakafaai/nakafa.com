import { describe, expect, it } from "@effect/vitest";
import { evaluateOptimizationBox } from "@repo/design-system/components/contents/mathematics/optimize/model";

describe("optimization box 3D model", () => {
  it("maximizes folded box volume at stationary cut x* where V'(x*) = 0", () => {
    const sqOpt = evaluateOptimizationBox("squareSheet", 1);
    const sqLow = evaluateOptimizationBox("squareSheet", 0.4);
    const wide = evaluateOptimizationBox("wideSheet", 1.13);
    const tall = evaluateOptimizationBox("tallSheet", 1.21);

    expect(sqOpt.optimalCut).toBe(1);
    expect(sqOpt.derivative).toBe(0);
    expect(sqOpt.volume).toBeGreaterThan(sqLow.volume);
    expect(wide.volume).toBeGreaterThan(sqOpt.volume);
    expect(tall.volume).toBeGreaterThan(wide.volume);
  });
});
