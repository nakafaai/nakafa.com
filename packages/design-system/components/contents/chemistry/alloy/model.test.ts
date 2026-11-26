import { describe, expect, it } from "@effect/vitest";
import { evaluateAlloySlip } from "@repo/design-system/components/contents/chemistry/alloy/model";

describe("alloy slip plane model", () => {
  it("slides pure iron layers easily while alloy atoms lock slip planes", () => {
    const iron = evaluateAlloySlip("pureIron", 80);
    const steel = evaluateAlloySlip("steel", 80);
    const bronze = evaluateAlloySlip("bronze", 80);
    const brass = evaluateAlloySlip("brass", 80);

    expect(iron.hasForeignAtoms).toBe(false);
    expect(iron.layerShift).toBeGreaterThan(steel.layerShift * 4);
    expect(bronze.hasForeignAtoms).toBe(true);
    expect(brass.layerShift).toBeLessThan(iron.layerShift);
  });
});
