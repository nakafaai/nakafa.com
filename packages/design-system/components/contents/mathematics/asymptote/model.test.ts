import { describe, expect, it } from "@effect/vitest";
import { evaluateAsymptoteProbe } from "@repo/design-system/components/contents/mathematics/asymptote/model";

describe("asymptote behavior model", () => {
  it("diverges near poles and approaches horizontal or oblique asymptotes far out", () => {
    const posPole = evaluateAsymptoteProbe("reciprocalPole", 0.02);
    const negPole = evaluateAsymptoteProbe("reciprocalPole", -0.02);
    const horiz = evaluateAsymptoteProbe("rationalHorizontal", 2.5);
    const slant = evaluateAsymptoteProbe("obliqueSlant", 2.0);

    expect(posPole.valueY).toBeGreaterThan(2);
    expect(negPole.valueY).toBeLessThan(-2);
    expect(Math.abs(horiz.valueY - horiz.horizontalY)).toBeLessThan(0.5);
    expect(Math.abs(slant.valueY - slant.horizontalY)).toBeLessThan(0.25);
  });
});
