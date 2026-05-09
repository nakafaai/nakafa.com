import {
  MathEvaluationError,
  MathExpressionParseError,
  MathUnsupportedError,
} from "@repo/math/errors";
import { describe, expect, it } from "vitest";

describe("math errors", () => {
  it("keeps parse errors tagged", () => {
    const error = new MathExpressionParseError({
      cause: "Unexpected end",
      expression: "2 +",
      message: "The expression could not be parsed.",
    });

    expect(error._tag).toBe("MathExpressionParseError");
  });

  it("keeps evaluation errors tagged", () => {
    const error = new MathEvaluationError({
      cause: "Undefined symbol x",
      expression: "x",
      message: "The expression could not be evaluated numerically.",
    });

    expect(error._tag).toBe("MathEvaluationError");
  });

  it("keeps unsupported errors tagged", () => {
    const error = new MathUnsupportedError({
      expression: "solve(x = 1)",
      message: "The operation is not supported.",
    });

    expect(error._tag).toBe("MathUnsupportedError");
  });
});
