import { describe, expect, it } from "@effect/vitest";
import { evaluateSaponificationStep } from "@repo/design-system/components/contents/chemistry/kettle/model";

describe("saponification kettle model", () => {
  it("progresses from hydrolysis through brine salting out to molded soap bars", () => {
    const hydro = evaluateSaponificationStep("hydrolysis");
    const salt = evaluateSaponificationStep("saltingOut");
    const filt = evaluateSaponificationStep("filtration");
    const mold = evaluateSaponificationStep("molding");

    expect(hydro.hasBrine).toBe(false);
    expect(salt.hasBrine).toBe(true);
    expect(filt.curdHeight).toBeGreaterThan(salt.curdHeight);
    expect(mold.isMolded).toBe(true);
  });
});
