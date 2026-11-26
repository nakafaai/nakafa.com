import { Match, Schema } from "effect";

const EpsilonFunctionSchema = Schema.Literals([
  "removableHole",
  "quadraticSmooth",
  "steepLinear",
]);

export type EpsilonFunction = typeof EpsilonFunctionSchema.Type;

const EpsilonDeltaSchema = Schema.Struct({
  delta: Schema.Finite,
  limitL: Schema.Finite,
  targetA: Schema.Finite,
});

/** Compute the maximal valid delta for a given epsilon corridor around x = a. */
export function evaluateEpsilonDelta(
  fn: EpsilonFunction,
  epsilon: number
): typeof EpsilonDeltaSchema.Type {
  const eps = Math.max(0.02, epsilon);
  return Match.value(fn).pipe(
    Match.when("removableHole", () => ({
      delta: Number(eps.toFixed(3)),
      limitL: 1.0,
      targetA: 0,
    })),
    Match.when("quadraticSmooth", () => ({
      delta: Number((Math.sqrt(1 + eps) - 1).toFixed(3)),
      limitL: 1.0,
      targetA: 0,
    })),
    Match.when("steepLinear", () => ({
      delta: Number((eps / 2.5).toFixed(3)),
      limitL: 1.0,
      targetA: 0,
    })),
    Match.exhaustive
  );
}
