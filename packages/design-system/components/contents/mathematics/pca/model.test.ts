import { describe, expect, it } from "@effect/vitest";
import { evaluatePcaProjection } from "@repo/design-system/components/contents/mathematics/pca/model";

describe("PCA projection 3D model", () => {
  it("increases variance explained and shrinks MSE as subspace dimension grows", () => {
    const oneD = evaluatePcaProjection("pc1Line", 0.8);
    const twoD = evaluatePcaProjection("pc1Pc2Plane", 0.8);
    const threeD = evaluatePcaProjection("full3D", 0.8);

    expect(twoD.varianceExplainedPercent).toBeGreaterThan(
      oneD.varianceExplainedPercent
    );
    expect(twoD.reconstructionMse).toBeLessThan(oneD.reconstructionMse);
    expect(threeD.varianceExplainedPercent).toBe(100);
    expect(threeD.reconstructionMse).toBe(0);
  });
});
