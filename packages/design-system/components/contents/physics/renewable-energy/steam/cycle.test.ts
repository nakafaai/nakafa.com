import { describe, expect, it } from "@effect/vitest";
import {
  electricOutput,
  FuelSchema,
  fuelPerHour,
  HEAT_INPUT,
  idealEfficiency,
  wasteHeat,
} from "@repo/design-system/components/contents/physics/renewable-energy/steam/cycle";

describe("steam power plant", () => {
  it("allows hotter steam a higher ideal limit", () => {
    expect(idealEfficiency("coal")).toBeCloseTo(0.6273, 4);
    expect(idealEfficiency("uranium")).toBeCloseTo(0.457, 3);
  });

  it("sends 380 MW out of a coal or gas boiler and 330 MW out of a reactor", () => {
    expect(electricOutput("coal")).toBeCloseTo(380_000_000, 0);
    expect(electricOutput("uranium")).toBeCloseTo(330_000_000, 0);
  });

  it("hands the rest of the heat to the condenser", () => {
    for (const fuel of FuelSchema.literals) {
      expect(electricOutput(fuel) + wasteHeat(fuel)).toBeCloseTo(HEAT_INPUT, 0);
      expect(electricOutput(fuel) / HEAT_INPUT).toBeLessThan(
        idealEfficiency(fuel)
      );
    }
  });

  it("burns 150 t of coal or 72 t of gas an hour, but splits under 1 kg of uranium fuel", () => {
    expect(fuelPerHour("coal")).toBeCloseTo(150_000, 6);
    expect(fuelPerHour("gas")).toBeCloseTo(72_000, 6);
    expect(fuelPerHour("uranium")).toBeCloseTo(0.926, 3);
  });
});
