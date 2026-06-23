import { finiteComputedConstantValue } from "@repo/math/schema/ast/value";
import { describe, expect, it } from "vitest";

describe("MathAst constant value builder", () => {
  it("rejects nonfinite computed values before they become constants", () => {
    expect(finiteComputedConstantValue(Number.POSITIVE_INFINITY).tag).toBe(
      "InvalidConstant"
    );
  });
});
