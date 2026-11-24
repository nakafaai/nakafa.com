import { describe, expect, it } from "@effect/vitest";
import { evaluateDeBroglie } from "@repo/design-system/components/contents/physics/debroglie/model";

describe("de Broglie matter-wave model", () => {
  it("shortens wavelength and narrows diffraction rings as voltage increases", () => {
    const low = evaluateDeBroglie("electron", 500);
    const high = evaluateDeBroglie("electron", 4000);

    expect(high.wavelengthPm).toBeLessThan(low.wavelengthPm);
    expect(high.momentumUnits).toBeGreaterThan(low.momentumUnits);
    expect(high.diffractionRadius).toBeLessThanOrEqual(low.diffractionRadius);
  });

  it("gives much shorter wavelengths for heavier proton, neutron, and alpha particles", () => {
    const electron = evaluateDeBroglie("electron", 2000);
    const proton = evaluateDeBroglie("proton", 2000);
    const neutron = evaluateDeBroglie("neutron", 2000);
    const alpha = evaluateDeBroglie("alpha", 2000);

    expect(proton.wavelengthPm).toBeLessThan(electron.wavelengthPm);
    expect(neutron.wavelengthPm).toBeLessThan(electron.wavelengthPm);
    expect(alpha.wavelengthPm).toBeLessThan(proton.wavelengthPm);
  });
});
