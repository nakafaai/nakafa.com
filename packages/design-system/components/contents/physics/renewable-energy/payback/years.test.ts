import { describe, expect, it } from "@effect/vitest";
import {
  energyBalance,
  INVESTED_ENERGY,
  LIFETIME,
  paybackYears,
  returnRatio,
  yearlyEnergy,
} from "@repo/design-system/components/contents/physics/renewable-energy/payback/years";

describe("solar energy payback", () => {
  it("costs 3900 kWh to make a 3 kWp system", () => {
    expect(INVESTED_ENERGY).toBe(3900);
    expect(yearlyEnergy(1300)).toBe(3900);
  });

  it("repays its energy in one year at 1300 kWh per kWp and later where the sun is weaker", () => {
    expect(paybackYears(1300)).toBe(1);
    expect(paybackYears(900)).toBeCloseTo(1.444, 3);
    expect(paybackYears(1800)).toBeCloseTo(0.722, 3);
  });

  it("starts in debt, crosses zero at the payback, and stops counting after its lifetime", () => {
    expect(energyBalance(1300, -1)).toBe(-INVESTED_ENERGY);
    expect(energyBalance(1300, paybackYears(1300))).toBe(0);
    expect(energyBalance(1300, LIFETIME + 10)).toBe(
      energyBalance(1300, LIFETIME)
    );
  });

  it("gives back its energy 25 times over at 1300 kWh per kWp", () => {
    expect(returnRatio(1300)).toBe(25);
    expect(returnRatio(800)).toBeCloseTo(15.38, 2);
  });
});
