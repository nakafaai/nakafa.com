import { getErrorMessage } from "@repo/math/core/format";
import { MathExpressionParseError } from "@repo/math/errors";
import { Effect } from "effect";
import * as math from "mathjs";

/** Parses a user expression once and keeps Math.js parse failures typed. */
export const parseExpression = Effect.fn("Math.parseExpression")(function* (
  expression: string
) {
  return yield* Effect.try({
    try: () => math.parse(expression),
    catch: (error) =>
      new MathExpressionParseError({
        cause: getErrorMessage(error),
        expression,
        message: "The expression could not be parsed.",
      }),
  });
});
