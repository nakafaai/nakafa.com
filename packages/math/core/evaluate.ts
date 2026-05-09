import {
  formatExpression,
  formatValue,
  getErrorMessage,
} from "@repo/math/core/format";
import { parseExpression } from "@repo/math/core/parse";
import { MathEvaluationError } from "@repo/math/errors";
import type { MathEvaluateInput, MathEvaluateResult } from "@repo/math/schema";
import { Effect } from "effect";

/** Evaluates a concrete numeric expression through Math.js. */
export const evaluate = Effect.fn("Math.evaluate")(function* (
  input: MathEvaluateInput
) {
  const node = yield* parseExpression(input.expression);
  const value = yield* Effect.try({
    try: () => node.evaluate(),
    catch: (error) =>
      new MathEvaluationError({
        cause: getErrorMessage(error),
        expression: input.expression,
        message: "The expression could not be evaluated numerically.",
      }),
  });
  const formatted = formatValue(value);

  const result = {
    input: formatExpression(node),
    output: {
      expression: formatted,
      latex: formatted,
      value: formatted,
    },
  } satisfies MathEvaluateResult;

  return result;
});
