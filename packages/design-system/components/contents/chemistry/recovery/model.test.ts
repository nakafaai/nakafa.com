import { describe, expect, it } from "@effect/vitest";
import { evaluateCatalystRecovery } from "@repo/design-system/components/contents/chemistry/recovery/model";

describe("green catalyst recovery model", () => {
  it("dramatically cuts E-factor waste for recyclable heterogeneous and biocatalysts", () => {
    const stoich = evaluateCatalystRecovery("stoichiometric", 5);
    const homo = evaluateCatalystRecovery("homogeneous", 5);
    const hetero = evaluateCatalystRecovery("heterogeneous", 5);
    const bio = evaluateCatalystRecovery("biocatalyst", 5);

    expect(stoich.recoveredPercent).toBe(0);
    expect(homo.eFactor).toBeLessThan(stoich.eFactor);
    expect(hetero.eFactor).toBeLessThan(homo.eFactor);
    expect(bio.eFactor).toBeLessThan(hetero.eFactor);
  });
});
