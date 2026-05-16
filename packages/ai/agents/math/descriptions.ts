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
  "Use for exact arithmetic and concrete numeric evaluation. Send operation evaluate with expression copied from the user, for example 125 * 48 / 6. Do not use for unresolved symbolic equations, named probability distributions, expected values, or variances.";

export const mathAlgebra =
  "Use for symbolic algebra. Send expression for simplify, factor, expand, cancel, together, apart, rationalize, or domain. Use cancel specifically when the user asks to cancel, coret, mencoret, or membatalkan a common factor in a rational expression. For validity or equivalence questions like A = B, send operation compare with left as A and right as B.";

export const mathEquation =
  "Use for solving equations, systems, inequalities, and polynomial roots. Send expression for one equation, expressions for a system, and provide explicit variables when the user names them.";

export const mathCalculus =
  "Use for derivatives, integrals, and limits. Send expression copied from the user, use variable x when the user does not name another variable, and provide bounds or limit point when needed.";

export const mathSeries =
  "Use for Taylor or asymptotic series, finite or symbolic summations, and finite or symbolic products. Summation and product need expression, lower, and upper.";

export const mathMatrix =
  "Use for linear algebra: determinant, inverse, rank, RREF, eigenvalues, eigenvectors, matrix multiplication, and linear systems. Multiplication needs right_matrix; linear systems need vector.";

export const mathStatistics =
  "Use for descriptive statistics: mean, median, mode, variance, standard deviation, quartiles, and z-score. Send values as the dataset; z-score also needs the target expression.";

export const mathProbability =
  "Use for supported named probability distributions such as normal, binomial, or poisson. Prefer probability over arithmetic or calculus when a distribution and its parameters are given. Send operation distribution, expected_value, variance_probability, point_probability, cumulative_probability, tail_probability, or interval_probability. Always include required parameters: bernoulli p, binomial n and p, normal mean and standard_deviation, poisson lambda, uniform lower and upper. Event operations also need their event value: point_probability needs point, cumulative_probability needs upper, tail_probability needs lower, and interval_probability needs lower and upper in the same call. For fair dice, cards, or any finite equally likely outcome list, use statistics mean or arithmetic over the listed outcomes instead.";

export const mathGeometry =
  "Use for coordinate geometry: distance, midpoint, slope, line equations, circle equations, and intersections. Send points for point-based operations; send expressions for equation intersections.";

export const mathDiscrete =
  "Use for discrete math and number theory: gcd, lcm, prime factorization, primality, modular arithmetic, permutations, and combinations. gcd and lcm need values; modular needs n and modulus; permutation and combination need n and k.";
