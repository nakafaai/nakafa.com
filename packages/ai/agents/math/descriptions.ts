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
  "Use for symbolic algebra. Send expression for simplify, factor, expand, cancel, together, apart, rationalize, or domain. Send left and right only for compare.";

export const mathEquation =
  "Use for solving equations, systems, inequalities, and polynomial roots. Provide explicit variables when the user names them.";

export const mathCalculus =
  "Use for derivatives, integrals, and limits. Provide the variable, and provide bounds or limit point when needed.";

export const mathSeries =
  "Use for Taylor or asymptotic series, finite or symbolic summations, and finite or symbolic products. Summation and product need expression, lower, and upper.";

export const mathMatrix =
  "Use for linear algebra: determinant, inverse, rank, RREF, eigenvalues, eigenvectors, matrix multiplication, and linear systems. Multiplication needs right_matrix; linear systems need vector.";

export const mathStatistics =
  "Use for descriptive statistics: mean, median, mode, variance, standard deviation, quartiles, and z-score. z-score needs the target expression and the dataset values.";

export const mathProbability =
  "Use for supported probability distributions, including expected value and variance for named distributions.";

export const mathGeometry =
  "Use for coordinate geometry: distance, midpoint, slope, line equations, circle equations, and intersections. Point-based operations need points; equation intersections need expressions.";

export const mathDiscrete =
  "Use for discrete math and number theory: gcd, lcm, prime factorization, primality, modular arithmetic, permutations, and combinations. gcd and lcm need values; modular needs n and modulus; permutation and combination need n and k.";
