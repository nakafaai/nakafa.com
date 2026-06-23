import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import { readUnaryConstantValue } from "@repo/math/schema/ast/operation";
import { describe, expect, it } from "vitest";

describe("unary MathAst constant operations", () => {
  it("carries pi-squared metadata through sign wrappers and square roots", () => {
    const piSquared = constant(Math.PI * Math.PI, undefined, 1);

    expect(readUnaryConstantValue("negate", piSquared)).toEqual({
      tag: "Constant",
      value: {
        isExactZero: false,
        piSquareMultiple: -1,
        value: -(Math.PI * Math.PI),
      },
    });
    expect(readUnaryConstantValue("abs", piSquared)).toEqual({
      tag: "Constant",
      value: {
        isExactZero: false,
        piSquareMultiple: 1,
        value: Math.PI * Math.PI,
      },
    });
    expect(readUnaryConstantValue("sqrt", piSquared)).toEqual({
      tag: "Constant",
      value: { isExactZero: false, piMultiple: 1, value: Math.PI },
    });
    expect(
      readUnaryConstantValue(
        "sqrt",
        constant(2 * Math.PI * Math.PI, undefined, 2)
      ).tag
    ).toBe("InvalidConstant");
  });

  it("evaluates integer-pi cosine exactly", () => {
    expect(
      readUnaryConstantValue(
        "cos",
        constant(9_007_199_254_740_991, 9_007_199_254_740_991)
      )
    ).toEqual({
      tag: "Constant",
      value: { isExactZero: false, value: -1 },
    });
  });
});

function constant(
  value: number,
  piMultiple?: number,
  piSquareMultiple?: number
): ConstantMathAstValue {
  return {
    isExactZero: value === 0,
    piMultiple,
    piSquareMultiple,
    value,
  };
}
