import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  describePlaneObjectLatex,
  formatFormulaLatex,
} from "@/lib/content/renderer/client/base/visual/latex";

const fields = { appearance: "primary" } as const;

describe("formatFormulaLatex", () => {
  it("converts common math functions, powers, roots, constants, and products", () => {
    expect(formatFormulaLatex("sqrt(x^2 + 1)")).toBe("\\sqrt{x^{2} + 1}");
    expect(formatFormulaLatex("abs(x - 2)")).toBe("|x - 2|");
    expect(formatFormulaLatex("2 * sin(pi * x) + 3 * 4")).toBe(
      "2 \\sin(\\pi x) + 3 \\cdot 4"
    );
    expect(formatFormulaLatex("exp(-(x - 1)^2) + ln(x)")).toBe(
      "\\exp(-(x - 1)^{2}) + \\ln(x)"
    );
    expect(formatFormulaLatex("2^(x + 1)")).toBe("2^{x + 1}");
    expect(formatFormulaLatex("1 + log_10(x)")).toBe("1 + \\log_{10}(x)");
    expect(formatFormulaLatex("log_2(x) + log_(1/2)(x) + log(x)")).toBe(
      "\\log_{2}(x) + \\log_{1/2}(x) + \\log(x)"
    );
    expect(
      formatFormulaLatex("cbrt(x) + floor(x) + ceil(x) + asin(x) + sign(x)")
    ).toBe(
      "\\sqrt[3]{x} + \\lfloor x \\rfloor + \\lceil x \\rceil + \\arcsin(x) + \\operatorname{sgn}(x)"
    );
  });
});

describe("describePlaneObjectLatex", () => {
  it("formats lines, quadratics, functions, implicit, polar, and parametric objects", () => {
    expect(
      describePlaneObjectLatex({
        ...fields,
        id: "v",
        kind: "line",
        through: [
          { x: 3, y: 0 },
          { x: 3, y: 4 },
        ],
      })
    ).toStrictEqual(Option.some("x = 3"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        id: "hzero",
        kind: "line",
        through: [
          { x: -2, y: 0 },
          { x: 4, y: 0 },
        ],
      })
    ).toStrictEqual(Option.some("y = 0"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        id: "h",
        kind: "line",
        through: [
          { x: -2, y: 2.5 },
          { x: 4, y: 2.5 },
        ],
      })
    ).toStrictEqual(Option.some("y = 2.5"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        id: "sloped",
        kind: "line",
        through: [
          { x: 0, y: -1 },
          { x: 1, y: 1 },
        ],
      })
    ).toStrictEqual(Option.some("y = 2x - 1"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        id: "neg",
        kind: "line",
        through: [
          { x: 0, y: 0 },
          { x: 1, y: -1 },
        ],
      })
    ).toStrictEqual(Option.some("y = -x"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        coefficients: { a: 1, b: -2, c: 3 },
        domain: { max: 4, min: -2 },
        id: "q",
        inputAxis: "x",
        kind: "quadratic",
      })
    ).toStrictEqual(Option.some("y = x^{2} - 2x + 3"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        coefficients: { a: -1, b: 0, c: 0 },
        domain: { max: 2, min: -2 },
        id: "qy",
        inputAxis: "y",
        kind: "quadratic",
      })
    ).toStrictEqual(Option.some("x = -y^{2}"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        formula: "x^2",
        id: "fx",
        kind: "function",
      })
    ).toStrictEqual(Option.some("y = x^{2}"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        formula: "y^2",
        id: "fy",
        inputAxis: "y",
        kind: "function",
      })
    ).toStrictEqual(Option.some("x = y^{2}"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        equation: "x^2 + y^2 = 9",
        id: "imp",
        kind: "implicit",
      })
    ).toStrictEqual(Option.some("x^{2} + y^{2} = 9"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        angle: { max: 6.28, min: 0 },
        id: "pol",
        kind: "polar",
        radius: "2 cos(theta)",
      })
    ).toStrictEqual(Option.some("r = 2 \\cos(\\theta)"));

    expect(
      describePlaneObjectLatex({
        ...fields,
        id: "par",
        kind: "parametric",
        parameter: { max: 6.28, min: 0 },
        x: "cos(t)",
        y: "sin(t)",
      })
    ).toStrictEqual(Option.some("(\\cos(t), \\sin(t))"));
  });

  it("skips overly long formulas and non-curve objects", () => {
    const longFormula = "sin(x) + cos(x) + tan(x) + exp(x) + ln(x)";
    expect(
      describePlaneObjectLatex({
        ...fields,
        formula: longFormula,
        id: "longf",
        kind: "function",
      })
    ).toStrictEqual(Option.none());
    expect(
      describePlaneObjectLatex({
        ...fields,
        equation: `${longFormula} = 0`,
        id: "longi",
        kind: "implicit",
      })
    ).toStrictEqual(Option.none());
    expect(
      describePlaneObjectLatex({
        ...fields,
        angle: { max: 6, min: 0 },
        id: "longp",
        kind: "polar",
        radius: longFormula,
      })
    ).toStrictEqual(Option.none());
    expect(
      describePlaneObjectLatex({
        ...fields,
        id: "longpar",
        kind: "parametric",
        parameter: { max: 6, min: 0 },
        x: longFormula,
        y: "sin(t)",
      })
    ).toStrictEqual(Option.none());
    expect(
      describePlaneObjectLatex({
        ...fields,
        at: { x: 0, y: 0 },
        id: "pt",
        kind: "point",
      })
    ).toStrictEqual(Option.none());
  });
});
