import { describe, expect, it } from "@effect/vitest";
import { evaluateCalorimeter } from "@repo/design-system/components/contents/physics/calorimeter/model";

describe("specific heat calorimeter model", () => {
  it("gives a much smaller temperature rise for water than metals under equal energy", () => {
    const water = evaluateCalorimeter("water", 1, 100, 5);
    const al = evaluateCalorimeter("aluminium", 1, 100, 5);
    const cu = evaluateCalorimeter("copper", 1, 100, 5);
    const fe = evaluateCalorimeter("iron", 1, 100, 5);
    const oil = evaluateCalorimeter("oil", 1, 100, 5);

    expect(water.energyJ).toBe(30_000);
    expect(water.temperatureRiseK).toBeLessThan(oil.temperatureRiseK);
    expect(oil.temperatureRiseK).toBeLessThan(al.temperatureRiseK);
    expect(al.temperatureRiseK).toBeLessThan(fe.temperatureRiseK);
    expect(fe.temperatureRiseK).toBeLessThan(cu.temperatureRiseK);
  });
});
