import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import { readBinaryConstantValue } from "@repo/math/schema/ast/operation";
import { describe, expect, it } from "vitest";

describe("MathAst constant operations", () => {
  it("rejects pi multiple combinations that lose fractional offsets", () => {
    expect(
      readBinaryConstantValue(
        "add",
        constant(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
        constant(0.5, 0.5)
      ).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue(
        "subtract",
        constant(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
        constant(0.5, 0.5)
      ).tag
    ).toBe("InvalidConstant");
  });

  it("rejects pi quotient drift near exact trig sentinels", () => {
    expect(
      readBinaryConstantValue(
        "divide",
        constant(Math.PI * 1e-308, 1e-308),
        constant(1e-309 * 10)
      ).tag
    ).toBe("InvalidConstant");
  });

  it("rejects rounded and nonfinite plain constant arithmetic", () => {
    expect(
      readBinaryConstantValue("add", constant(1e308), constant(1e308)).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue("add", constant(1e20), constant(1)).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue("subtract", constant(1e20), constant(1)).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue("divide", constant(1e308), constant(1e-308)).tag
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
