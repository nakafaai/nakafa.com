import { describe, expect, it } from "@effect/vitest";
import { evaluatePhytohormone } from "@repo/design-system/components/contents/biology/hormone/model";

describe("phytohormone action model", () => {
  it("distinguishes stem bolting, bud branching, dormancy, and fruit ripening", () => {
    const auxin = evaluatePhytohormone("auxin");
    const ga = evaluatePhytohormone("gibberellin");
    const ck = evaluatePhytohormone("cytokinin");
    const aba = evaluatePhytohormone("abscisicAcid");
    const eth = evaluatePhytohormone("ethylene");

    expect(ga.stemScale).toBeGreaterThan(auxin.stemScale);
    expect(ck.lateralBudScale).toBeGreaterThan(auxin.lateralBudScale);
    expect(aba.leafDroop).toBeGreaterThan(0.4);
    expect(eth.fruitRipeness).toBe(1);
  });
});
