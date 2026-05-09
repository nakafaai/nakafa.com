import { formatExpression, getErrorMessage } from "@repo/math/core/format";
import { parseExpression } from "@repo/math/core/parse";
import { MathUnsupportedError } from "@repo/math/errors";
import type {
  MathDifferentiateInput,
  MathDifferentiateResult,
} from "@repo/math/schema";
import { Effect } from "effect";
import * as math from "mathjs";

/** Differentiates a supported expression with respect to one variable. */
export const differentiate = Effect.fn("Math.differentiate")(function* (
  input: MathDifferentiateInput
) {
  const node = yield* parseExpression(input.expression);
  const output = yield* Effect.try({
    try: () => math.derivative(node, input.variable),
    catch: (error) =>
      new MathUnsupportedError({
        expression: input.expression,
        message: `The derivative could not be computed: ${getErrorMessage(error)}`,
      }),
  });

  const result = {
    input: formatExpression(node),
    output: formatExpression(output),
    variable: input.variable,
  } satisfies MathDifferentiateResult;

  return result;
});
