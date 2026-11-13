import { describe, expect, it } from "@effect/vitest";
import { boltQuantities } from "@repo/design-system/components/contents/physics/measurement/bolt/quantities";

describe("one bolt, many quantities", () => {
  it("has a 7.85 × 10^-5 m² cross-section and a 3.93 × 10^-6 m³ shank", () => {
    const quantities = boltQuantities();
    expect(quantities.area.value).toBeCloseTo(7.854e-5, 8);
    expect(quantities.volume.value).toBeCloseTo(3.927e-6, 9);
  });

  it("weighs the shank at 30.8 g of steel", () => {
    expect(boltQuantities().mass.value).toBeCloseTo(0.03083, 5);
  });

  it("gives density the dimension of mass over volume", () => {
    const { density, mass, volume } = boltQuantities();
    expect(density.mass).toBe(mass.mass - volume.mass);
    expect(density.length).toBe(mass.length - volume.length);
    expect(mass.value / volume.value).toBeCloseTo(density.value, 6);
  });
});
