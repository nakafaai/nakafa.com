import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import { readBinaryConstantValue } from "@repo/math/schema/ast/operation";
import { describe, expect, it } from "vitest";

describe("MathAst constant operations", () => {
  it("rejects pi multiple combinations that lose fractional offsets", () => {
    expect(
      readBinaryConstantValue("add", constant(1e16, 1e16), constant(0.5, 0.5))
        .tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue(
        "subtract",
        constant(1e16, 1e16),
        constant(0.5, 0.5)
      ).tag
    ).toBe("InvalidConstant");
  });
});

function constant(value: number, piMultiple?: number): ConstantMathAstValue {
  return {
    isExactZero: value === 0,
    piMultiple,
    value,
  };
}
