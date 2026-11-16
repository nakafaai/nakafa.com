import { describe, expect, it } from "@effect/vitest";
import {
  INPUT_ENERGY,
  PlantSchema,
  plantFlow,
  usefulEnergy,
} from "@repo/design-system/components/contents/physics/renewable-energy/flow/stages";
import { Array as Arr } from "effect";

describe("energy flow through a plant", () => {
  it("multiplies the stage shares along each chain", () => {
    expect(usefulEnergy("solar")).toBeCloseTo(19.2, 9);
    expect(usefulEnergy("wind")).toBeCloseTo(40.6125, 9);
    expect(usefulEnergy("hydro")).toBeCloseTo(85.5, 9);
    expect(usefulEnergy("geothermal")).toBeCloseTo(11.4, 9);
    expect(usefulEnergy("biogas")).toBeCloseTo(33.25, 9);
  });

  it("feeds each stage what the stage before it kept", () => {
    const [, stages] = plantFlow("wind");
    expect(stages[0]?.entering).toBe(INPUT_ENERGY);
    expect(stages[1]?.entering).toBeCloseTo(45, 9);
    expect(stages[2]?.entering).toBeCloseTo(42.75, 9);
  });

  it("loses no joule: the useful energy and every loss add back to the input", () => {
    for (const plant of PlantSchema.literals) {
      const [useful, stages] = plantFlow(plant);
      const lost = Arr.reduce(stages, 0, (sum, stage) => sum + stage.lost);
      expect(useful + lost).toBeCloseTo(INPUT_ENERGY, 9);
    }
  });
});
