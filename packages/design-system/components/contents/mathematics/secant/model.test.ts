import { describe, expect, it } from "@effect/vitest";
import { evaluateSecantLimit } from "@repo/design-system/components/contents/mathematics/secant/model";

describe("secant to tangent convergence model", () => {
  it("converges secant slope to exact tangent slope as h shrinks across curves", () => {
    const quadWide = evaluateSecantLimit("quadratic", 1.2);
    const quadTight = evaluateSecantLimit("quadratic", 0.05);
    const cubic = evaluateSecantLimit("cubic", 0.05);
    const sine = evaluateSecantLimit("sineWave", 0.05);

    expect(
      Math.abs(quadTight.secantSlope - quadTight.tangentSlope)
    ).toBeLessThan(Math.abs(quadWide.secantSlope - quadWide.tangentSlope));
    expect(Math.abs(cubic.secantSlope - cubic.tangentSlope)).toBeLessThan(0.05);
    expect(Math.abs(sine.secantSlope - sine.tangentSlope)).toBeLessThan(0.05);
  });
});
