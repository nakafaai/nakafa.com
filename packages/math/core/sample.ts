import { formatValue, getErrorMessage } from "@repo/math/core/format";
import { MathEvaluationError } from "@repo/math/errors";
import { Effect, Either, Option } from "effect";
import * as math from "mathjs";

const NUMERIC_SAMPLES = [-3, -2, -1, 0, 1, 2, 3];

/** Collects symbolic variables referenced by a Math.js expression tree. */
export function getSymbols(nodes: math.MathNode[]) {
  const symbols = new Set<string>();

  for (const node of nodes) {
    node.traverse((child) => {
      if (math.isSymbolNode(child)) {
        symbols.add(child.name);
      }
    });
  }

  return [...symbols].sort();
}

/** Builds deterministic numeric scopes for contradiction checks. */
export function getScopes(symbols: string[]) {
  if (symbols.length === 0) {
    return [{}];
  }

  return NUMERIC_SAMPLES.map((sample, sampleIndex) =>
    Object.fromEntries(
      symbols.map((symbol, symbolIndex) => [
        symbol,
        sample + sampleIndex + symbolIndex,
      ])
    )
  );
}

/** Compares evaluated Math.js values when both expressions can run. */
export function valuesMatch(left: math.MathType, right: math.MathType) {
  if (typeof left === "number" && typeof right === "number") {
    return globalThis.Math.abs(left - right) < 1e-10;
  }

  const equal = math.equal(left, right);

  if (typeof equal === "boolean") {
    return equal;
  }

  return formatValue(left) === formatValue(right);
}

/** Runs one scoped evaluation and returns none when the scope is invalid. */
export const evaluateSample = Effect.fn("Math.evaluateSample")(function* ({
  node,
  scope,
}: {
  node: math.MathNode;
  scope: Record<string, number>;
}) {
  const result = yield* Effect.either(
    Effect.try({
      try: () => node.evaluate(scope),
      catch: (error) =>
        new MathEvaluationError({
          cause: getErrorMessage(error),
          expression: node.toString(),
          message: "The expression could not be evaluated for this sample.",
        }),
    })
  );

  if (Either.isLeft(result)) {
    return Option.none();
  }

  return Option.some(result.right);
});
