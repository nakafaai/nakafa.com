import { Schema } from "effect";

export const mathReasoningOperations = [
  "circle",
  "differentiate",
  "factor",
  "integrate",
  "line",
  "simplify",
  "solve",
] as const;

export const casOnlyMathOperations = [
  "apart",
  "cancel",
  "combination",
  "compare",
  "cumulative_probability",
  "determinant",
  "distance",
  "distribution",
  "domain",
  "eigen_analysis",
  "eigenvalues",
  "eigenvectors",
  "evaluate",
  "expected_value",
  "expand",
  "gcd",
  "intersection",
  "inverse",
  "interval_probability",
  "is_prime",
  "lcm",
  "limit",
  "linear_system",
  "matrix_multiply",
  "mean",
  "median",
  "midpoint",
  "mode",
  "modular",
  "permutation",
  "point_probability",
  "prime_factorization",
  "product",
  "quartiles",
  "rank",
  "rationalize",
  "roots",
  "rref",
  "series",
  "slope",
  "standard_deviation",
  "summation",
  "tail_probability",
  "together",
  "variance",
  "variance_probability",
  "z_score",
] as const;

export const mathOperations = [
  ...casOnlyMathOperations,
  ...mathReasoningOperations,
] as const;

export const MathOperationSchema = Schema.Literal(
  ...mathOperations
).annotations({
  description: "Supported deterministic math operation.",
});

export const MathReasoningOperationSchema = Schema.Literal(
  ...mathReasoningOperations
).annotations({
  description: "First-slice operations planned by MathReasoning.",
});

export type MathOperation = Schema.Schema.Type<typeof MathOperationSchema>;
export type CasOnlyMathOperation = (typeof casOnlyMathOperations)[number];
export type MathReasoningOperation = Schema.Schema.Type<
  typeof MathReasoningOperationSchema
>;
