import { describe, expect, it } from "@effect/vitest";
import { evaluate } from "@repo/backend/confect/assessment/math/evaluate";
import { parseExpression } from "@repo/backend/confect/assessment/math/parse";
import { Option } from "effect";

/** The value of an expression at a point. */
const valueOf = (latex: string, point: Record<string, number> = {}) =>
  evaluate(Option.getOrThrow(parseExpression(latex)), point);

describe("assessment/math evaluate", () => {
  it.each([
    ["\\sin(\\frac{\\pi}{2})", 1],
    ["\\cos(0)", 1],
    ["\\tan(\\frac{\\pi}{4})", 1],
    ["\\cot(\\frac{\\pi}{4})", 1],
    ["\\sec(0)", 1],
    ["\\csc(\\frac{\\pi}{2})", 1],
    ["\\arcsin(1)", Math.PI / 2],
    ["\\arccos(1)", 0],
    ["\\arctan(1)", Math.PI / 4],
    ["\\sinh(0)", 0],
    ["\\cosh(0)", 1],
    ["\\tanh(0)", 0],
    ["\\ln(e)", 1],
    ["\\log_{2}(8)", 3],
    ["|-3|", 3],
    ["\\sqrt[3]{-8}", -2],
    ["2^{10}", 1024],
    ["3-5", -2],
  ])("computes %s as %d", (latex, value) => {
    expect(valueOf(latex)).toBeCloseTo(value, 12);
  });

  it("reads each variable at the point, and nothing for a variable the point does not hold", () => {
    expect(valueOf("3x^2-4x", { x: 2 })).toBe(4);
    expect(valueOf("xy", { x: 2, y: 3 })).toBe(6);
    expect(valueOf("x+y", { x: 2 })).toBeNaN();
  });

  it("is not finite where the expression is undefined, a zero factor included", () => {
    expect(valueOf("\\ln(-1)")).toBeNaN();
    expect(valueOf("\\sqrt{-1}")).toBeNaN();
    expect(valueOf("\\frac{1}{0}")).toBe(Number.POSITIVE_INFINITY);
    expect(valueOf("0\\cdot\\ln(-1)")).toBeNaN();
  });
});
