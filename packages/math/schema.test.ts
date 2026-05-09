import {
  MathCompareInputSchema,
  MathDataSchema,
  MathDifferentiateInputSchema,
  MathEvaluateInputSchema,
  MathSimplifyInputSchema,
} from "@repo/math/schema";
import { describe, expect, it } from "vitest";

describe("math schemas", () => {
  it("validates operation inputs", () => {
    expect(MathEvaluateInputSchema.parse({ expression: "2 + 2" })).toEqual({
      expression: "2 + 2",
    });
    expect(MathSimplifyInputSchema.parse({ expression: "x + x" })).toEqual({
      expression: "x + x",
    });
    expect(
      MathDifferentiateInputSchema.parse({
        expression: "x^2",
        variable: "x",
      })
    ).toEqual({
      expression: "x^2",
      variable: "x",
    });
    expect(
      MathCompareInputSchema.parse({ left: "x + 1", right: "1 + x" })
    ).toEqual({ left: "x + 1", right: "1 + x" });
  });

  it("validates math data parts", () => {
    expect(
      MathDataSchema.parse({
        kind: "evaluate",
        status: "loading",
        input: { expression: "2 + 2" },
      })
    ).toEqual({
      kind: "evaluate",
      status: "loading",
      input: { expression: "2 + 2" },
    });
  });
});
