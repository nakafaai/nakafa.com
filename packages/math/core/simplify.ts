import { formatExpression, getErrorMessage } from "@repo/math/core/format";
import { parseExpression } from "@repo/math/core/parse";
import { MathUnsupportedError } from "@repo/math/errors";
import type { MathSimplifyInput, MathSimplifyResult } from "@repo/math/schema";
import { Effect } from "effect";
import * as math from "mathjs";

/** Simplifies a symbolic expression through Math.js algebra rules. */
export const simplify = Effect.fn("Math.simplify")(function* (
  input: MathSimplifyInput
) {
  const node = yield* parseExpression(input.expression);
  const output = yield* Effect.try({
    try: () => math.simplify(node, {}, { exactFractions: true }),
    catch: (error) =>
      new MathUnsupportedError({
        expression: input.expression,
        message: `The expression could not be simplified: ${getErrorMessage(error)}`,
      }),
  });

  const result = {
    input: formatExpression(node),
    output: formatExpression(output),
  } satisfies MathSimplifyResult;

  return result;
});
