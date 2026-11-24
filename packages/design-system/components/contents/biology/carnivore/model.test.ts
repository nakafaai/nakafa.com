import { describe, expect, it } from "@effect/vitest";
import { evaluateSpecialNutrition } from "@repo/design-system/components/contents/biology/carnivore/model";

describe("special plant nutrition model", () => {
  it("distinguishes carnivorous, parasitic, and epiphytic nutrient modes", () => {
    const carnivorous = evaluateSpecialNutrition("carnivorous");
    const parasitic = evaluateSpecialNutrition("parasitic");
    const epiphytic = evaluateSpecialNutrition("epiphytic");

    expect(carnivorous.trapsInsects).toBe(true);
    expect(carnivorous.hasChlorophyll).toBe(true);
    expect(parasitic.tapsHostVascular).toBe(true);
    expect(parasitic.hasChlorophyll).toBe(false);
    expect(epiphytic.hasChlorophyll).toBe(true);
    expect(epiphytic.tapsHostVascular).toBe(false);
  });
});
