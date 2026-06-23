import {
  divideNumericValue,
  finiteNumericValue,
  multiplyNumericValue,
  readNumericLiteralValue,
} from "@repo/math/schema/coordinate/decimal";
import { describe, expect, it } from "vitest";

describe("coordinate decimal literal values", () => {
  it("rejects rounded exact integer spellings and nonfinite products", () => {
    expect(readNumericLiteralValue(".5")?.value).toBe(0.5);
    expect(readNumericLiteralValue("1e308")?.value).toBe(1e308);
    expect(readNumericLiteralValue("-1e308")?.value).toBe(-1e308);
    expect(readNumericLiteralValue("2e20")).toBeUndefined();
    expect(readNumericLiteralValue("9007199254740993e0")).toBeUndefined();
    expect(readNumericLiteralValue(".9007199254740993e16")).toBeUndefined();
    expect(readNumericLiteralValue("0x20000000000000")).toBeUndefined();
    expect(
      multiplyNumericValue(finiteNumericValue(1e308), finiteNumericValue(2))
    ).toBeUndefined();
    expect(
      multiplyNumericValue(
        finiteNumericValue(Number.MAX_SAFE_INTEGER),
        finiteNumericValue(3)
      )
    ).toBeUndefined();
    expect(
      divideNumericValue(
        finiteNumericValue(1e-200, { usesApproximateValue: true }),
        finiteNumericValue(1e200)
      )?.isUnderflow
    ).toBe(true);
  });
});
