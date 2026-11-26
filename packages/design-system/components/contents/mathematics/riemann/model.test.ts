import { describe, expect, it } from "@effect/vitest";
import { evaluateRiemannSum } from "@repo/design-system/components/contents/mathematics/riemann/model";

describe("Riemann sum convergence model", () => {
  it("converges toward the exact definite integral across all rules and curves", () => {
    const leftCoarse = evaluateRiemannSum("parabola", "left", 4);
    const leftFine = evaluateRiemannSum("parabola", "left", 32);
    const rightFine = evaluateRiemannSum("sineArch", "right", 24);
    const midFine = evaluateRiemannSum("exponential", "midpoint", 24);
    const trapFine = evaluateRiemannSum("parabola", "trapezoid", 24);

    expect(Math.abs(leftFine.approxArea - leftFine.exactIntegral)).toBeLessThan(
      Math.abs(leftCoarse.approxArea - leftCoarse.exactIntegral)
    );
    expect(
      Math.abs(rightFine.approxArea - rightFine.exactIntegral)
    ).toBeLessThan(0.1);
    expect(Math.abs(midFine.approxArea - midFine.exactIntegral)).toBeLessThan(
      0.05
    );
    expect(Math.abs(trapFine.approxArea - trapFine.exactIntegral)).toBeLessThan(
      0.05
    );
  });
});
