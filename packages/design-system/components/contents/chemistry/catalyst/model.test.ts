import { describe, expect, it } from "@effect/vitest";
import { evaluateCatalyst } from "@repo/design-system/components/contents/chemistry/catalyst/model";

describe("catalyst pathway model", () => {
  it("lowers activation energy while preserving enthalpy change for exothermic and endothermic reactions", () => {
    const exoNo = evaluateCatalyst("exothermic", "absent");
    const exoYes = evaluateCatalyst("exothermic", "present");
    expect(exoYes.activationEnergyKj).toBeLessThan(exoNo.activationEnergyKj);
    expect(exoYes.enthalpyChangeKj).toBe(exoNo.enthalpyChangeKj);
    expect(exoYes.enthalpyChangeKj).toBeLessThan(0);

    const endoNo = evaluateCatalyst("endothermic", "absent");
    const endoYes = evaluateCatalyst("endothermic", "present");
    expect(endoYes.activationEnergyKj).toBeLessThan(endoNo.activationEnergyKj);
    expect(endoYes.enthalpyChangeKj).toBe(endoNo.enthalpyChangeKj);
    expect(endoYes.enthalpyChangeKj).toBeGreaterThan(0);
  });
});
