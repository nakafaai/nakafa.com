import {
  divideFiniteDecimalNumbers,
  powerFiniteDecimalNumber,
} from "@repo/math/schema/ast/decimal";
import { describe, expect, it } from "vitest";

describe("MathAst finite decimal arithmetic", () => {
  it("rejects non-integer and negative powers before repeated multiplication", () => {
    expect(powerFiniteDecimalNumber(2, 0.5)).toBeUndefined();
    expect(powerFiniteDecimalNumber(2, -1)).toBeUndefined();
  });

  it("reduces signed and zero decimal quotients exactly", () => {
    expect(divideFiniteDecimalNumbers(-1, 2)).toBe(-0.5);
    expect(divideFiniteDecimalNumbers(1, -2)).toBe(-0.5);
    expect(divideFiniteDecimalNumbers(0, 2)).toBe(0);
  });
});
