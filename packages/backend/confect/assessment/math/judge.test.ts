import { describe, expect, it } from "@effect/vitest";
import type { MathOutcome } from "@repo/backend/confect/assessment/math/judge";
import { judgeMath } from "@repo/backend/confect/assessment/math/judge";
import { Array as Arr, Option } from "effect";

/** f(x) = x^3 - 2x^2, the function of the Feststellungsprüfung part the keys below come from. */
const DERIVATIVE = "3x^2-4x";
const SECOND = "6x-4";

/** Judges an answer and reads the outcome, for a key the grader reads. */
const outcomeOf = (key: string, answer: string) =>
  Option.getOrThrow(judgeMath(key, answer));

/** Expects every pair of a table to reach its outcome. */
const expectOutcomes = (
  pairs: readonly (readonly [string, string, MathOutcome])[]
) => {
  for (const [key, answer, outcome] of pairs) {
    expect([key, answer, outcomeOf(key, answer)]).toEqual([
      key,
      answer,
      outcome,
    ]);
  }
};

describe("assessment/math judgeMath", () => {
  it("proves the forms a learner writes of one polynomial, in LaTeX, on a keyboard, or on a phone", () => {
    expectOutcomes([
      [DERIVATIVE, "3x^2-4x", "proven"],
      [DERIVATIVE, "3x^{2}-4x", "proven"],
      [DERIVATIVE, "x(3x-4)", "proven"],
      [DERIVATIVE, "(3x-4)x", "proven"],
      [DERIVATIVE, "x\\left(3x-4\\right)", "proven"],
      [DERIVATIVE, "x\\cdot(3x-4)", "proven"],
      [DERIVATIVE, "-4x+3x^2", "proven"],
      [DERIVATIVE, "3*x^2 - 4*x", "proven"],
      [DERIVATIVE, "3x\\cdot x-4x", "proven"],
      [DERIVATIVE, "3x²−4x", "proven"],
      [DERIVATIVE, "f'(x)=3x^2-4x", "proven"],
      [DERIVATIVE, "y = x(3x - 4)", "proven"],
      [SECOND, "2(3x-2)", "proven"],
      [SECOND, "-4+6x", "proven"],
    ]);
  });

  it("proves a fraction and its decimal exactly, with either decimal point", () => {
    expectOutcomes([
      ["\\frac{1}{2}x", "0.5x", "proven"],
      ["\\frac{1}{2}x", "0{,}5x", "proven"],
      ["\\frac{1}{2}x", "0,5x", "proven"],
      ["\\frac{1}{2}x", "\\frac{x}{2}", "proven"],
      ["\\frac{1}{2}x", "x/2", "proven"],
      ["\\frac{1}{2}x", "\\frac12x", "proven"],
      ["\\frac{3}{2}x^2", "1.5x^2", "proven"],
      ["\\frac{8}{3}", "\\frac{16}{6}", "proven"],
    ]);
  });

  it("refuses every near miss: a sign, an exponent, a lost term, a rounded decimal, another variable", () => {
    expectOutcomes([
      [DERIVATIVE, "3x^2+4x", "none"],
      [DERIVATIVE, "-3x^2-4x", "none"],
      [DERIVATIVE, "3x^3-4x", "none"],
      [DERIVATIVE, "3x^2-4", "none"],
      [DERIVATIVE, "3x^2-4x+1", "none"],
      [DERIVATIVE, SECOND, "none"],
      [DERIVATIVE, "x^3-2x^2", "none"],
      [DERIVATIVE, "3t^2-4t", "none"],
      [SECOND, "6x+4", "none"],
      [SECOND, "6x", "none"],
      ["\\frac{1}{3}x", "0.333x", "none"],
      ["\\frac{1}{3}x", "0.3333333333x", "none"],
      ["\\frac{8}{3}", "2.67", "none"],
      ["x^2", "2x", "none"],
    ]);
  });

  it("proves functions whose canonical forms agree, and samples identities no form shows", () => {
    expectOutcomes([
      ["\\frac{1}{x}", "x^{-1}", "proven"],
      ["\\frac{1}{x}", "1/x", "proven"],
      ["e^{x}", "\\exp(x)", "proven"],
      ["e^{x}", "\\mathrm{e}^x", "proven"],
      ["2xe^{x^2}", "e^{x^2}\\cdot 2x", "proven"],
      ["xe^{x}+e^{x}", "(x+1)e^x", "proven"],
      ["\\frac{1}{2\\sqrt{x}}", "\\frac{1}{2}x^{-\\frac{1}{2}}", "proven"],
      ["\\frac{1}{2\\sqrt{x}}", "0.5x^{-0.5}", "proven"],
      ["\\frac{3}{x^2+1}", "3(x^2+1)^{-1}", "proven"],
      ["\\ln(x)+1", "1+\\ln x", "proven"],
      ["\\cos(x)", "\\cos x", "proven"],
      ["\\frac{1}{x\\ln(2)}", "\\frac{1}{\\ln 2}\\cdot\\frac{1}{x}", "proven"],
      ["e^{2x}", "(e^x)^2", "sampled"],
      ["e^{2x}", "e^{x}e^{x}", "sampled"],
      ["\\frac{1}{2\\sqrt{x}}", "\\frac{\\sqrt{x}}{2x}", "sampled"],
      ["\\cos(x)", "\\sin(x+\\frac{\\pi}{2})", "sampled"],
      ["2\\sin(x)\\cos(x)", "\\sin(2x)", "sampled"],
      ["\\sin^2(x)+\\cos^2(x)", "1", "sampled"],
      ["\\ln(x^2)", "2\\ln(x)", "sampled"],
      ["\\tan(x)", "\\frac{\\sin x}{\\cos x}", "sampled"],
      ["\\sqrt{x^2}", "|x|", "sampled"],
      ["\\sqrt[3]{x}", "x^{\\frac{1}{3}}", "sampled"],
    ]);
  });

  it("refuses a wrong function, a wrong base, and a wrong root", () => {
    expectOutcomes([
      ["e^{2x}", "2e^{x}", "none"],
      ["e^{2x}", "e^{x^2}", "none"],
      ["\\frac{1}{2\\sqrt{x}}", "\\frac{1}{\\sqrt{2x}}", "none"],
      ["\\cos(x)", "-\\cos(x)", "none"],
      ["\\cos(x)", "\\sin(x)", "none"],
      ["\\ln(x)", "\\log(x)", "none"],
      ["\\sqrt{x^2}", "x", "none"],
    ]);
  });

  it("compares numbers without a variable exactly, and irrational ones by value", () => {
    expectOutcomes([
      ["e^2-1", "-1+e^{2}", "proven"],
      ["\\ln 4", "2\\ln 2", "proven"],
      ["\\sqrt{8}", "2\\sqrt{2}", "proven"],
      ["\\frac{\\pi}{2}", "\\frac{1}{2}\\pi", "proven"],
      ["e^2-1", "6.389", "none"],
      ["\\frac{\\pi}{4}", "0.785", "none"],
      ["1", "\\frac{1}{0}", "none"],
      ["\\frac{1}{0}", "\\frac{1}{0}", "none"],
    ]);
  });

  it("refuses an answer that is no expression: an equation, a set, an interval, an integral, or text", () => {
    expectOutcomes([
      [DERIVATIVE, "3x^2-4x=0", "none"],
      [DERIVATIVE, "\\{3x^2-4x\\}", "none"],
      [DERIVATIVE, "(-\\infty, 2]", "none"],
      [DERIVATIVE, "\\int 3x^2", "none"],
      [DERIVATIVE, "3x^2-4x \\text{ is correct}", "none"],
      [DERIVATIVE, "   ", "none"],
    ]);
  });

  it("refuses untrusted input at once: huge exponents, deep nesting, long text, and injected markup", () => {
    const nested = `${"(".repeat(150)}x${")".repeat(150)}`;
    const deep = `${"(".repeat(40)}x${")".repeat(40)}`;
    const roots = `${"\\sqrt{".repeat(40)}x${"}".repeat(40)}`;
    const vanishing = `${DERIVATIVE}+(x-0.5)(x-1.5)(x-2.5)(x+0.5)(x+1.5)(x+2.5)(x-3.5)(x+3.5)`;
    const answers = [
      "x^{999999999999999}",
      "2^{2^{2^{2^{2^{2}}}}}",
      "(a+b+c+d+e+f)^{12}",
      "((x+1)^{12})^{12}",
      nested,
      deep,
      roots,
      "x".repeat(10_000),
      vanishing,
      '3x^2-4x"); DROP TABLE responses; --',
      "\\href{javascript:alert(1)}{3x^2-4x}",
      "<script>alert(1)</script>",
      "3x^2-4x\\\\ \\text{correct}",
      "\\placeholder{}",
    ];
    const started = performance.now();
    for (const answer of answers) {
      expect([answer, outcomeOf(DERIVATIVE, answer)]).toEqual([answer, "none"]);
    }
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("leaves an answer to a person when the key itself is no expression the grader reads", () => {
    expect(judgeMath("(-\\infty, 2]", "x")).toEqual(Option.none());
    expect(judgeMath("x \\in [0, 2]", "x")).toEqual(Option.none());
  });

  it("gives the same outcome for the same two texts, every time", () => {
    const pairs = [
      [DERIVATIVE, "x(3x-4)"],
      ["e^{2x}", "(e^x)^2"],
      ["\\cos(x)", "\\sin(x)"],
      ["\\frac{1}{2\\sqrt{x}}", "\\frac{\\sqrt{x}}{2x}"],
    ] as const;
    const first = Arr.map(pairs, ([key, answer]) => judgeMath(key, answer));
    for (const _ of Arr.range(1, 20)) {
      expect(Arr.map(pairs, ([key, answer]) => judgeMath(key, answer))).toEqual(
        first
      );
    }
  });
});
