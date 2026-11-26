import { describe, expect, it } from "@effect/vitest";
import { evaluateThoraxMechanics } from "@repo/design-system/components/contents/biology/thorax/model";

describe("thorax and diaphragm ventilation model", () => {
  it("obeys Boyle's law across inhalation, exhalation, and forced exhalation", () => {
    const inhale = evaluateThoraxMechanics("inhalation", 80);
    const exhale = evaluateThoraxMechanics("exhalation", 80);
    const forced = evaluateThoraxMechanics("forcedExhalation", 80);

    expect(inhale.volumeLiters).toBeGreaterThan(exhale.volumeLiters);
    expect(inhale.alveolarPressureDeltaMmHg).toBeLessThan(0);
    expect(exhale.alveolarPressureDeltaMmHg).toBeGreaterThan(0);
    expect(forced.alveolarPressureDeltaMmHg).toBeGreaterThan(
      exhale.alveolarPressureDeltaMmHg
    );
    expect(inhale.diaphragmY).toBeLessThan(exhale.diaphragmY);
  });
});
