import { describe, expect, it } from "@effect/vitest";
import { evaluateMeiosisCombinations } from "@repo/design-system/components/contents/biology/meiosis/model";

describe("meiosis shuffling model", () => {
  it("computes 2^n gamete combinations and squares them at random fertilisation", () => {
    const cross = evaluateMeiosisCombinations("crossingOver", 3);
    const assort = evaluateMeiosisCombinations("independentAssortment", 3);
    const fert = evaluateMeiosisCombinations("randomFertilisation", 3);

    expect(cross.gameteCombinations).toBe(8);
    expect(cross.combinationsMath).toBe("> 2^{3}");
    expect(assort.combinationsMath).toBe("2^{3} = 8");
    expect(fert.combinationsMath).toBe("2^{3} \\times 2^{3} = 64");
    expect(fert.zygoteCombinations).toBe(64);
  });
});
