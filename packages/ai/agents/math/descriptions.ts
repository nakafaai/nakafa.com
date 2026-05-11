/**
 * Describes Nina's deterministic math tools.
 *
 * References:
 * - AI SDK tool descriptions:
 *   https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 * - SymPy capabilities:
 *   https://docs.sympy.org/latest/index.html
 */
export const mathArithmetic =
  "Use for exact arithmetic and concrete numeric evaluation. Do not use for unresolved symbolic equations.";

export const mathAlgebra =
  "Use for symbolic algebra: simplify, factor, expand, cancel, combine fractions, partial fractions, rationalize, domain restrictions, and expression equality checks.";

export const mathEquation =
  "Use for solving equations, systems, inequalities, and polynomial roots. Provide explicit variables when the user names them.";

export const mathCalculus =
  "Use for derivatives, integrals, and limits. Provide the variable, and provide bounds or limit point when needed.";

export const mathSeries =
  "Use for Taylor or asymptotic series, finite or symbolic summations, and finite or symbolic products.";

export const mathMatrix =
  "Use for linear algebra: determinant, inverse, rank, RREF, eigenvalues, eigenvectors, matrix multiplication, and linear systems.";

export const mathStatistics =
  "Use for descriptive statistics: mean, median, mode, variance, standard deviation, quartiles, and z-score.";

export const mathProbability =
  "Use for supported probability distributions, including expected value and variance for named distributions.";

export const mathGeometry =
  "Use for coordinate geometry: distance, midpoint, slope, line equations, circle equations, and intersections.";

export const mathDiscrete =
  "Use for discrete math and number theory: gcd, lcm, prime factorization, primality, modular arithmetic, permutations, and combinations.";
