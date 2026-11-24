import { describe, expect, it } from "@effect/vitest";
import { evaluateCultureGrowth } from "@repo/design-system/components/contents/biology/mineral/model";

describe("mineral deficiency culture model", () => {
  it("stunts growth and raises chlorosis when macronutrients are omitted", () => {
    const complete = evaluateCultureGrowth("complete");
    const noN = evaluateCultureGrowth("noNitrogen");
    const noP = evaluateCultureGrowth("noPhosphorus");
    const noK = evaluateCultureGrowth("noPotassium");
    const noMg = evaluateCultureGrowth("noMagnesium");

    expect(complete.chlorosisIndex).toBe(0);
    expect(complete.stemHeight).toBe(1);
    expect(noN.stemHeight).toBeLessThan(complete.stemHeight);
    expect(noN.chlorosisIndex).toBeGreaterThan(0.8);
    expect(noP.rootLength).toBeLessThan(noN.rootLength);
    expect(noK.leafScale).toBeLessThan(complete.leafScale);
    expect(noMg.chlorosisIndex).toBeGreaterThan(0.7);
  });
});
