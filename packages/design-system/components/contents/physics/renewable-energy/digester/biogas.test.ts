import { describe, expect, it } from "@effect/vitest";
import {
  cookingHours,
  gasEnergy,
  gasVolume,
  methaneVolume,
} from "@repo/design-system/components/contents/physics/renewable-energy/digester/biogas";

describe("biogas digester", () => {
  it("makes 1 m³ of biogas a day from 25 kg of dung", () => {
    expect(gasVolume(25)).toBeCloseTo(1, 9);
    expect(methaneVolume(25)).toBeCloseTo(0.6, 9);
  });

  it("stores 21.6 MJ, 6 kWh, in that day's methane", () => {
    expect(gasEnergy(25)).toBeCloseTo(21_600_000, 3);
    expect(gasEnergy(25) / 3_600_000).toBeCloseTo(6, 9);
  });

  it("keeps a burner lit for 2.5 h, longer with more dung", () => {
    expect(cookingHours(25)).toBeCloseTo(2.5, 9);
    expect(cookingHours(50)).toBeCloseTo(5, 9);
  });
});
