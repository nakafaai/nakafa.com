import { describe, expect, it } from "@effect/vitest";
import {
  checkFormula,
  drawFormula,
  FormulaInvalid,
  formulaProblem,
} from "@repo/design-system/components/editor/render";
import { Effect, Option } from "effect";

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
});

describe("checkFormula", () => {
  it.effect("passes a formula that parses", () => checkFormula("x^2"));

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
