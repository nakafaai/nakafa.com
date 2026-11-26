import { describe, expect, it } from "@effect/vitest";
import { evaluateCalorimeter } from "@repo/design-system/components/contents/chemistry/enthalpy/model";

describe("calorimeter enthalpy model", () => {
  it("raises temperature for exothermic reactions and cools for endothermic dissolution", () => {
    const neut = evaluateCalorimeter("neutralisation", 0.05);
    const disp = evaluateCalorimeter("displacement", 0.05);
    const comb = evaluateCalorimeter("combustion", 0.02);
    const diss = evaluateCalorimeter("dissolution", 0.05);

    expect(neut.exothermic).toBe(true);
    expect(neut.tempChangeC).toBeGreaterThan(0);
    expect(disp.tempChangeC).toBeGreaterThan(neut.tempChangeC);
    expect(comb.exothermic).toBe(true);
    expect(diss.exothermic).toBe(false);
    expect(diss.tempChangeC).toBeLessThan(0);
  });
});
