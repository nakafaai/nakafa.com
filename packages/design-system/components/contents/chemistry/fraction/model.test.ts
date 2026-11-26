import { describe, expect, it } from "@effect/vitest";
import { evaluatePetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";

describe("fractional distillation column model", () => {
  it("condenses lighter low-boiling fractions higher up the column than heavy residue", () => {
    const gas = evaluatePetroleumFraction("refineryGas");
    const petrol = evaluatePetroleumFraction("petrol");
    const kero = evaluatePetroleumFraction("kerosene");
    const diesel = evaluatePetroleumFraction("diesel");
    const bitumen = evaluatePetroleumFraction("bitumen");

    expect(gas.trayY).toBeGreaterThan(petrol.trayY);
    expect(petrol.trayY).toBeGreaterThan(kero.trayY);
    expect(kero.trayY).toBeGreaterThan(diesel.trayY);
    expect(diesel.trayY).toBeGreaterThan(bitumen.trayY);
    expect(bitumen.boilingC).toBeGreaterThan(gas.boilingC);
  });
});
