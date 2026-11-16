import { describe, expect, it } from "@effect/vitest";
import {
  chargeToHover,
  dropVelocity,
  dropWeight,
  ELEMENTARY_CHARGE,
  hoverVoltage,
  nearestDrop,
} from "@repo/design-system/components/contents/chemistry/millikan/drop";

describe("Millikan oil drops", () => {
  it("weighs a 1 micrometre drop of oil at about 3.64e-14 newtons", () => {
    expect(dropWeight()).toBeCloseTo(3.641e-14, 16);
  });

  it("holds a one-charge drop still at about 1136 volts and a two-charge drop at half", () => {
    expect(hoverVoltage(1)).toBeCloseTo(1136.3, 0);
    expect(hoverVoltage(2)).toBeCloseTo(hoverVoltage(1) / 2, 9);
    expect(dropVelocity(2, hoverVoltage(2))).toBeCloseTo(0, 12);
  });

  it("lets a drop fall at about 0.1 mm/s with the plates off", () => {
    expect(dropVelocity(1, 0)).toBeCloseTo(-1.067e-4, 6);
    expect(dropVelocity(3, 1000)).toBeGreaterThan(0);
  });

  it("finds whole numbers of the elementary charge", () => {
    expect(chargeToHover(hoverVoltage(3)) / ELEMENTARY_CHARGE).toBeCloseTo(
      3,
      9
    );
    expect(nearestDrop(560)).toBe(2);
    expect(nearestDrop(1400)).toBe(1);
  });
});
