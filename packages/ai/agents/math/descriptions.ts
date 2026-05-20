import dedent from "dedent";

/**
 * Describes Nina's deterministic math tools.
 *
 * References:
 * - AI SDK tool descriptions:
 *   https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 * - SymPy capabilities:
 *   https://docs.sympy.org/latest/index.html
 */
export const mathArithmetic = dedent(`
  Use for exact arithmetic, concrete numeric evaluation, and already-substituted function values.

  Required input:
  - Send operation evaluate.
  - Copy the expression from the user, for example 125 * 48 / 6.

  Do not use for:
  - Unresolved symbolic equations.
  - Named probability distributions.
  - Expected values or variances.
`);

export const mathAlgebra = dedent(`
  Use for symbolic algebra.

  Send expression for:
  - simplify
  - factor
  - expand
  - cancel
  - together
  - apart
  - rationalize
  - domain

  Use cancel specifically when the user asks to cancel a common factor in a rational expression.

  For validity or equivalence questions like A = B, send operation compare with left as A and right as B.
`);

export const mathEquation = dedent(`
  Use for solving equations, systems, inequalities, and polynomial roots.

  Required input:
  - Send expression for one equation.
  - Send expressions for a system.
  - Provide explicit variables when the user names them.
  - Preserve solve-domain bounds such as x > 0 with lower, upper, and inclusivity fields for solve.
  - Use solve instead of roots when bounds restrict which roots are valid.
  - For system solve-domain bounds, set variable to the bounded variable and variables to all solved variables.
`);

export const mathCalculus = dedent(`
  Use for differentiate, integrate, and limit.
  Send the target mathematical expression copied from the user.
  Do not wrap expression in operation syntax such as diff(...), integrate(...), or limit(...).
  Put the requested action only in operation.
  For second or higher derivatives, keep expression as the original function and set order.
  For optimization or extrema, differentiate first, solve the critical equation with the stated domain, then call arithmetic evaluate on the original expression after substituting each valid candidate value that will appear in the answer.
  Treat minimum point and maximum point requests as asking for both the input location and function value unless the user asks only for the input location.
  Do not finish an extrema value until the substituted original expression is checked.

  Do not use for named probability distribution moments.
  Expectations, variances, and random-variable moments must be checked by probability first.

  Definite or improper integrals must include lower and upper.
  For example, integral from 0 to infinity uses lower 0 and upper oo.

  Include variable when the expression has parameters or more than one symbol.
  Use variable x when the user does not name another variable.
  Provide a limit point when needed.
`);

export const mathSeries = dedent(`
  Use for:
  - Taylor or asymptotic series.
  - Finite or symbolic summations.
  - Finite or symbolic products.

  Summation and product need expression, lower, and upper.
`);

export const mathMatrix = dedent(`
  Use for linear algebra:
  - determinant
  - inverse
  - rank
  - rref
  - eigenvalues
  - eigenvectors
  - eigen_analysis
  - matrix_multiply
  - linear_system

  Use eigen_analysis for eigenspaces, algebraic or geometric multiplicity, diagonalizability, and Jordan-related checks.
  matrix_multiply needs right_matrix.
  linear_system needs vector.
`);

export const mathStatistics = dedent(`
  Use for descriptive statistics:
  - mean
  - median
  - mode
  - variance
  - standard_deviation
  - quartiles
  - z_score

  Send values as the dataset.
  z_score also needs the target expression.
`);

export const mathProbability = dedent(`
  Use for supported named probability distributions such as normal, binomial, or poisson.
  Prefer probability over arithmetic or calculus when a distribution and its parameters are given.
  For named-distribution moments, call probability before any calculus derivation detail.
  This is the evidence source for expectations, variances, and moments of random variables.

  Supported operations:
  - distribution
  - expected_value
  - variance_probability
  - point_probability
  - cumulative_probability
  - tail_probability
  - interval_probability

  Always include required parameters:
  - bernoulli needs p.
  - binomial needs n and p.
  - normal needs mean and standard_deviation.
  - poisson needs lambda.
  - uniform needs lower and upper.

  Moment operations:
  - For E[X^4], send operation expected_value, variable X, and expression X^4.
  - For Var(X^2), send operation variance_probability, variable X, and expression X^2.
  - Keep variable as the random variable name, not the transformed expression.
  - For derivation requests, check the requested moment here first, then explain the definition, identity, recurrence, or theorem that connects the checked value to the result.
  - Do not reduce a requested derivation to only "known", "given", or the final number.

  Event operations also need their event value:
  - point_probability needs point.
  - cumulative_probability needs upper.
  - tail_probability needs lower.
  - interval_probability needs lower and upper in the same call.

  For fair dice, cards, or any finite equally likely outcome list:
  - Use statistics mean over the listed outcomes.
  - Use arithmetic for direct finite counting.
  - Do not use a named probability distribution.
`);

export const mathGeometry = dedent(`
  Use for coordinate geometry:
  - distance
  - midpoint
  - slope
  - line equations
  - circle equations
  - intersections

  Send points for point-based operations.
  Send expressions for equation intersections.
`);

export const mathDiscrete = dedent(`
  Use for discrete math and number theory:
  - gcd
  - lcm
  - prime_factorization
  - is_prime
  - modular
  - permutation
  - combination

  gcd and lcm need values.
  modular needs n and modulus.
  permutation and combination need n and k.
`);
