import { describe, expect, it } from "@effect/vitest";
import { evaluateGasLaw } from "@repo/design-system/components/contents/physics/gaslaw/model";

describe("gas law thermal model", () => {
  it("obeys Boyle's, Charles's, and Gay-Lussac's proportionalities", () => {
    const boyleCompressed = evaluateGasLaw("boyle", 300, 5);
    const boyleExpanded = evaluateGasLaw("boyle", 300, 20);
    expect(boyleCompressed.pressureKpa).toBeCloseTo(
      boyleExpanded.pressureKpa * 4,
      3
    );

    const charlesHot = evaluateGasLaw("charles", 600, 10);
    expect(charlesHot.pressureKpa).toBeCloseTo(101.3, 3);
    expect(charlesHot.effectiveVolumeL).toBeCloseTo(20, 3);

    const gayHot = evaluateGasLaw("gayLussac", 600, 10);
    expect(gayHot.effectiveVolumeL).toBe(10);
    expect(gayHot.pressureKpa).toBeCloseTo(202.6, 3);
  });
});
