import { describe, expect, it } from "@effect/vitest";
import {
  checkFormula,
  drawFormula,
  FormulaInvalid,
  formulaProblem,
} from "@repo/design-system/components/editor/render";
import { MATH_ERROR_COLOR } from "@repo/design-system/lib/prose";
import { Effect, Option } from "effect";

describe("drawFormula", () => {
  it("draws a formula with KaTeX, in the mode it is given", () => {
    expect(drawFormula("x^2", false)).toContain("katex");
    expect(drawFormula("x^2", true)).toContain("katex-display");
  });

  it("draws a formula that does not parse as KaTeX's error, in the lesson's error colour", () => {
    const markup = drawFormula("\\frac{", false);
    expect(markup).toContain("katex-error");
    expect(markup).toContain(MATH_ERROR_COLOR);
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
