import { describe, expect, it } from "@effect/vitest";
import { blockReading } from "@repo/design-system/components/contents/physics/measurement/density/block";

describe("density from four base readings", () => {
  it("gives every block a volume of 50 cubic centimetres", () => {
    expect(blockReading("pine").volume).toBe(50);
  });

  it("weighs pine at 25 g, aluminium at 135 g and brass at 425 g", () => {
    expect(blockReading("pine").mass).toBeCloseTo(25, 9);
    expect(blockReading("aluminium").mass).toBeCloseTo(135, 9);
    expect(blockReading("brass").mass).toBeCloseTo(425, 9);
  });

  it("derives 2.70 g/cm³, 2700 kg/m³, for aluminium", () => {
    const { density, densitySi } = blockReading("aluminium");
    expect(density).toBeCloseTo(2.7, 9);
    expect(densitySi).toBeCloseTo(2700, 6);
  });
});
