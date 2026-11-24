import { describe, expect, it } from "@effect/vitest";
import { evaluatePollinationTraits } from "@repo/design-system/components/contents/biology/flower/model";

describe("flower pollination anatomy model", () => {
  it("contrasts large insect petals against long filaments and feathery wind stigmas", () => {
    const insect = evaluatePollinationTraits("insect");
    const wind = evaluatePollinationTraits("wind");

    expect(insect.petalScale).toBeGreaterThan(wind.petalScale);
    expect(insect.pollenSize).toBeGreaterThan(wind.pollenSize);
    expect(wind.filamentLength).toBeGreaterThan(insect.filamentLength);
    expect(wind.stigmaFeatherSpread).toBeGreaterThan(
      insect.stigmaFeatherSpread
    );
  });
});
