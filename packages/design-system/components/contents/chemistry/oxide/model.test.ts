import { describe, expect, it } from "@effect/vitest";
import { evaluatePeriodOxide } from "@repo/design-system/components/contents/chemistry/oxide/model";

describe("period 3 oxide trend model", () => {
  it("transitions from basic ionic Na2O/MgO through amphoteric Al2O3 to acidic covalent oxides", () => {
    expect(evaluatePeriodOxide("na2o").nature).toBe("basic");
    expect(evaluatePeriodOxide("mgo").ph).toBeGreaterThan(7);
    expect(evaluatePeriodOxide("al2o3").nature).toBe("amphoteric");
    expect(evaluatePeriodOxide("sio2").structure).toBe("giantCovalent");
    expect(evaluatePeriodOxide("p4o10").ph).toBeLessThan(3);
    expect(evaluatePeriodOxide("so2").nature).toBe("acidic");
  });
});
