import { describe, expect, it } from "@effect/vitest";
import {
  checkFormula,
  drawFormula,
  FormulaInvalid,
  formulaProblem,
  needsChemistry,
} from "@repo/design-system/components/editor/render";
import { Effect, Option } from "effect";
// The formula view loads the mhchem extension on demand; the draw and check cases here load it first.
import "katex/contrib/mhchem";

describe("needsChemistry", () => {
  it("names the formulas that draw chemistry, and no other", () => {
    expect(needsChemistry("\\ce{H2O}")).toBe(true);
    expect(needsChemistry("\\pu{12 kJ}")).toBe(true);
    expect(needsChemistry("\\cell")).toBe(false);
    expect(needsChemistry("x^2")).toBe(false);
  });
});

describe("drawFormula", () => {
  it("draws a formula with KaTeX, in the mode it is given", () => {
    expect(drawFormula("x^2", false)).toContain("katex");
    expect(drawFormula("x^2", true)).toContain("katex-display");
  });

  it("draws a formula that does not parse as KaTeX's error, in the destructive colour", () => {
    const markup = drawFormula("\\frac{", false);
    expect(markup).toContain("katex-error");
    expect(markup).toContain("var(--destructive)");
  });

  it("draws chemistry with the mhchem macros, which parse without an error", () => {
    const markup = drawFormula("\\ce{H2O}", false);
    expect(markup).toContain("katex");
    expect(markup).not.toContain("katex-error");
  });
});

describe("checkFormula", () => {
  it.effect("passes a formula that parses", () => checkFormula("x^2"));

  it.effect("passes chemistry, which parses with the mhchem macros", () =>
    checkFormula("\\ce{H2O}")
  );

  it.effect("fails a formula that does not parse, with KaTeX's reason", () =>
    Effect.gen(function* () {
      const failure = yield* checkFormula("\\frac{").pipe(Effect.flip);
      expect(failure).toBeInstanceOf(FormulaInvalid);
      expect(failure.reason).toContain("KaTeX parse error");
    })
  );
});

describe("formulaProblem", () => {
  it.effect("says no problem for a formula that parses", () =>
    Effect.gen(function* () {
      expect(yield* formulaProblem("x^2")).toEqual(Option.none());
    })
  );

  it.effect("says the reason for a formula that does not parse", () =>
    Effect.gen(function* () {
      const problem = yield* formulaProblem("\\frac{");
      expect(Option.isSome(problem)).toBe(true);
    })
  );
});
