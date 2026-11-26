import { describe, expect, it } from "@effect/vitest";
import { evaluateSuccessionStage } from "@repo/design-system/components/contents/biology/succession/model";

describe("ecological succession model", () => {
  it("increases soil depth, canopy height, and biodiversity across succession stages", () => {
    const barePrimary = evaluateSuccessionStage("primary", "bareRock");
    const bareSecondary = evaluateSuccessionStage("secondary", "bareRock");
    const lichen = evaluateSuccessionStage("primary", "lichenMoss");
    const shrub = evaluateSuccessionStage("primary", "grassShrub");
    const woodland = evaluateSuccessionStage("secondary", "youngWoodland");
    const climax = evaluateSuccessionStage("primary", "climaxForest");

    expect(barePrimary.soilDepthCm).toBe(0);
    expect(bareSecondary.soilDepthCm).toBeGreaterThan(0);
    expect(lichen.soilDepthCm).toBeGreaterThan(barePrimary.soilDepthCm);
    expect(shrub.canopyHeightM).toBeGreaterThan(lichen.canopyHeightM);
    expect(woodland.biodiversityIndex).toBeGreaterThan(shrub.biodiversityIndex);
    expect(climax.canopyHeightM).toBeGreaterThan(woodland.canopyHeightM);
  });
});
