import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import { readUnaryConstantValue } from "@repo/math/schema/ast/operation";
import { describe, expect, it } from "vitest";

describe("unary MathAst constant operations", () => {
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

function constant(value: number, piMultiple?: number): ConstantMathAstValue {
  return {
    isExactZero: value === 0,
    piMultiple,
    value,
  };
}
