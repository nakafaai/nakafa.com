import { describe, expect, it } from "@effect/vitest";
import { evaluateAtomEconomy } from "@repo/design-system/components/contents/chemistry/economy/model";

describe("atom economy reactor model", () => {
  it("gives 100% atom economy for addition and lower economy when byproducts form", () => {
    const add = evaluateAtomEconomy("addition");
    const sub = evaluateAtomEconomy("substitution");
    const elim = evaluateAtomEconomy("elimination");
    const ferm = evaluateAtomEconomy("fermentation");

    expect(add.economyPercent).toBe(100);
    expect(add.wasteSpheres).toBe(0);
    expect(sub.economyPercent).toBeLessThan(100);
    expect(elim.wasteSpheres).toBeGreaterThan(0);
    expect(ferm.economyPercent).toBe(51);
  });
});
