import { describe, expect, it } from "@effect/vitest";
import { evaluateChromosomeMutation } from "@repo/design-system/components/contents/biology/mutation/model";

describe("chromosome mutation model", () => {
  it("models deletion, duplication, inversion, translocation, and trisomy nondisjunction", () => {
    expect(evaluateChromosomeMutation("deletion").bands.length).toBe(3);
    expect(evaluateChromosomeMutation("duplication").bands.length).toBe(5);
    expect(evaluateChromosomeMutation("inversion").bands[1]?.code).toBe("C");
    expect(evaluateChromosomeMutation("translocation").hasNonHomologue).toBe(
      true
    );
    expect(evaluateChromosomeMutation("nondisjunction").copyCount).toBe(3);
  });
});
