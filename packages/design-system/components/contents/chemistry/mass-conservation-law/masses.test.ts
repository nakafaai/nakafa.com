// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  airAfterDays,
  COMPOUND,
  CUBIC_INCH,
  calxAfterDays,
  carbonDioxideFrom,
  fizzProgress,
  LAVOISIER,
  mercuryRiseAfterDays,
  molarMass,
  oxygenInCalx,
  oxygenTakenBy,
  precipitateMass,
  saltMass,
} from "@repo/design-system/components/contents/chemistry/mass-conservation-law/masses";

describe("mass conservation models", () => {
  it("adds atomic weights into molar masses", () => {
    expect(molarMass(COMPOUND.nahco3)).toBeCloseTo(84.006, 9);
    expect(molarMass(COMPOUND.co2)).toBeCloseTo(44.009, 9);
    expect(molarMass(COMPOUND.agcl)).toBeCloseTo(143.32, 9);
  });

  it("frees about half the baking soda's mass as carbon dioxide", () => {
    expect(carbonDioxideFrom(2)).toBeCloseTo((2 * 44.009) / 84.006, 12);
    expect(fizzProgress(-1)).toBe(0);
    expect(fizzProgress(4)).toBeCloseTo(1 - Math.exp(-1), 12);
  });

  it("makes burnt iron heavier by the oxygen it takes from the air", () => {
    // 3Fe + 2O₂ → Fe₃O₄: 167.535 g of iron takes 63.996 g of oxygen.
    expect(oxygenTakenBy(3 * 55.845)).toBeCloseTo(4 * 15.999, 9);
  });

  it("keeps the precipitation's mass on both sides of the arrow", () => {
    const before = saltMass(COMPOUND.agno3) + saltMass(COMPOUND.nacl);
    const after = precipitateMass() + saltMass(COMPOUND.nano3);
    expect(after).toBeCloseTo(before, 9);
    expect(precipitateMass()).toBeCloseTo(0.7166, 9);
  });

  it("follows Lavoisier's air and calx from day zero to day twelve", () => {
    expect(airAfterDays(-2)).toBe(LAVOISIER.airBefore);
    expect(airAfterDays(0)).toBe(LAVOISIER.airBefore);
    expect(airAfterDays(12)).toBeCloseTo(LAVOISIER.airAfter, 12);
    expect(airAfterDays(20)).toBeCloseTo(LAVOISIER.airAfter, 12);
    expect(calxAfterDays(0)).toBe(0);
    expect(calxAfterDays(12)).toBeCloseTo(LAVOISIER.calx, 12);
    expect(airAfterDays(4)).toBeLessThan(airAfterDays(2));
    expect(oxygenInCalx()).toBe(3.5);
  });

  it("lifts the mercury in the bell jar by the air it lost", () => {
    expect(CUBIC_INCH).toBeCloseTo(16.387_064e-6, 15);
    expect(mercuryRiseAfterDays(0, 0.06)).toBe(0);
    // 7.5 in³ over a jar 0.06 m in radius: about 1.09 cm.
    expect(mercuryRiseAfterDays(12, 0.06)).toBeCloseTo(
      (7.5 * 16.387_064e-6) / (Math.PI * 0.0036),
      12
    );
  });
});
