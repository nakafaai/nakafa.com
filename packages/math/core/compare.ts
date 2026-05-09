import {
  formatExpression,
  formatValue,
  getErrorMessage,
} from "@repo/math/core/format";
import { parseExpression } from "@repo/math/core/parse";
import {
  evaluateSample,
  getScopes,
  getSymbols,
  valuesMatch,
} from "@repo/math/core/sample";
import { MathUnsupportedError } from "@repo/math/errors";
import type { MathCompareInput, MathCompareResult } from "@repo/math/schema";
import { Effect, Either, Option } from "effect";
import * as math from "mathjs";

/** Compares two expressions and returns verified, contradicted, or inconclusive. */
export const compare = Effect.fn("Math.compare")(function* (
  input: MathCompareInput
) {
  const left = yield* parseExpression(input.left);
  const right = yield* parseExpression(input.right);

  const symbolic = yield* Effect.either(
    Effect.try({
      try: () => math.symbolicEqual(left, right),
      catch: (error) =>
        new MathUnsupportedError({
          expression: `${input.left} = ${input.right}`,
          message: `The expressions could not be checked symbolically: ${getErrorMessage(error)}`,
        }),
    })
  );

  if (Either.isRight(symbolic) && symbolic.right) {
    const result = {
      left: formatExpression(left),
      reason: "Math.js proved the expressions are symbolically equivalent.",
      right: formatExpression(right),
      samples: [],
      status: "verified",
    } satisfies MathCompareResult;

    return result;
  }

  const rational = yield* Effect.either(
    Effect.try({
      try: () => ({
        left: math.rationalize(left),
        right: math.rationalize(right),
      }),
      catch: (error) =>
        new MathUnsupportedError({
          expression: `${input.left} = ${input.right}`,
          message: `The expressions could not be canonicalized: ${getErrorMessage(error)}`,
        }),
    })
  );

  if (
    Either.isRight(rational) &&
    rational.right.left.toString() === rational.right.right.toString()
  ) {
    const result = {
      left: formatExpression(left),
      reason:
        "Math.js canonicalized both expressions to the same rational form.",
      right: formatExpression(right),
      samples: [],
      status: "verified",
    } satisfies MathCompareResult;

    return result;
  }

  for (const scope of getScopes(getSymbols([left, right]))) {
    const leftValue = yield* evaluateSample({ node: left, scope });
    const rightValue = yield* evaluateSample({ node: right, scope });

    if (Option.isNone(leftValue) || Option.isNone(rightValue)) {
      continue;
    }

    if (!valuesMatch(leftValue.value, rightValue.value)) {
      const result = {
        left: formatExpression(left),
        reason: "A deterministic numeric counterexample was found.",
        right: formatExpression(right),
        samples: [
          {
            left: formatValue(leftValue.value),
            right: formatValue(rightValue.value),
            scope,
          },
        ],
        status: "contradicted",
      } satisfies MathCompareResult;

      return result;
    }
  }

  const result = {
    left: formatExpression(left),
    reason:
      "No symbolic proof or numeric counterexample was found by the current engine.",
    right: formatExpression(right),
    samples: [],
    status: "inconclusive",
  } satisfies MathCompareResult;

  return result;
});
