import {
  finiteNumericValue,
  multiplyNumericValue,
  readNumericLiteralValue,
} from "@repo/math/schema/coordinate/decimal";
import { describe, expect, it } from "vitest";

describe("coordinate decimal literal values", () => {
  it("rejects rounded exact integer spellings and nonfinite products", () => {
    expect(readNumericLiteralValue(".5")?.value).toBe(0.5);
    expect(readNumericLiteralValue("9007199254740993e0")).toBeUndefined();
    expect(readNumericLiteralValue(".9007199254740993e16")).toBeUndefined();
    expect(readNumericLiteralValue("0x20000000000000")).toBeUndefined();
    expect(
      multiplyNumericValue(finiteNumericValue(1e308), finiteNumericValue(2))
    ).toBeUndefined();
  });
});
