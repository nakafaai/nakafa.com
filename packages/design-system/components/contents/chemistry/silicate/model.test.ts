import { describe, expect, it } from "@effect/vitest";
import { evaluateSilicateLattice } from "@repo/design-system/components/contents/chemistry/silicate/model";

describe("glass and ceramic silicate model", () => {
  it("distinguishes amorphous soda-lime/borosilicate glass from layered clay and crystalline ceramics", () => {
    expect(evaluateSilicateLattice("sodaLimeGlass").isAmorphous).toBe(true);
    expect(evaluateSilicateLattice("borosilicateGlass").hasBoron).toBe(true);
    expect(evaluateSilicateLattice("traditionalCeramic").isAmorphous).toBe(
      false
    );
    expect(evaluateSilicateLattice("advancedCeramic").orderedCrystals).toBe(
      true
    );
  });
});
