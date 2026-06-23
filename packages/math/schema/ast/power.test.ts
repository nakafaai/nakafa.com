import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import {
  hasMultipleSyntacticPiTokens,
  hasPiSquareMultiple,
  readProductPiSquareMultiple,
  readReducedPiSquareMultiple,
  readScaledPiSquareMultiple,
  readScaledPiSquareProduct,
} from "@repo/math/schema/ast/power";
import { describe, expect, it } from "vitest";

describe("pi power metadata", () => {
  it("detects multi-token pi literals", () => {
    expect(hasMultipleSyntacticPiTokens("(pi*pi)/pi")).toBe(true);
    expect(hasMultipleSyntacticPiTokens("pi/2")).toBe(false);
    expect(hasMultipleSyntacticPiTokens("2")).toBe(false);
  });

  it("reads pi-squared products and scaling", () => {
    expect(
      readProductPiSquareMultiple(
        constant(2 * Math.PI, 2),
        constant(3 * Math.PI, 3)
      )
    ).toBe(6);
    expect(
      readProductPiSquareMultiple(constant(2), constant(3 * Math.PI, 3))
    ).toBeUndefined();
    expect(readScaledPiSquareMultiple(2, 3, "multiply")).toBe(6);
    expect(readScaledPiSquareMultiple(2, 4, "divide")).toBe(0.5);
    expect(readScaledPiSquareMultiple(1 / 3, 3, "multiply")).toBeUndefined();
  });

  it("reads pi-squared product scaling from either operand", () => {
    expect(hasPiSquareMultiple(constant(Math.PI * Math.PI, undefined, 1))).toBe(
      true
    );
    expect(hasPiSquareMultiple(constant(2))).toBe(false);
    expect(
      readScaledPiSquareProduct(
        constant(2 * Math.PI * Math.PI, undefined, 2),
        constant(3)
      )
    ).toBe(6);
    expect(
      readScaledPiSquareProduct(
        constant(3),
        constant(2 * Math.PI * Math.PI, undefined, 2)
      )
    ).toBe(6);
    expect(readScaledPiSquareProduct(constant(3), constant(2))).toBeUndefined();
  });

  it("reduces pi-squared numerators by single-pi denominators", () => {
    expect(
      readReducedPiSquareMultiple(
        constant(2 * Math.PI * Math.PI, undefined, 2),
        constant(4 * Math.PI, 4)
      )
    ).toBe(0.5);
    expect(
      readReducedPiSquareMultiple(constant(2), constant(4 * Math.PI, 4))
    ).toBeUndefined();
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
