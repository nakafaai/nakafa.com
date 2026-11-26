import { describe, expect, it } from "@effect/vitest";
import { evaluateQuadratSampling } from "@repo/design-system/components/contents/biology/quadrat/model";

describe("quadrat sampling model", () => {
  it("computes density and percentage cover across species and sampling methods", () => {
    const clover = evaluateQuadratSampling("clover", "random", 10);
    const fern = evaluateQuadratSampling("fern", "beltTransect", 8);
    const moss = evaluateQuadratSampling("moss", "random", 16);

    expect(clover.sampledPlots).toBe(10);
    expect(moss.coveragePercent).toBeGreaterThan(clover.coveragePercent);
    expect(clover.densityPerSqM).toBeGreaterThan(fern.densityPerSqM);
  });
});
