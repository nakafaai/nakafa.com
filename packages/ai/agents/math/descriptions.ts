import { createPrompt } from "@repo/ai/prompt/utils";

/**
 * Describes Nina's deterministic math tools.
 *
 * References:
 * - AI SDK tool descriptions:
 *   https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 * - SymPy capabilities:
 *   https://docs.sympy.org/latest/index.html
 */
export const mathArithmetic = createPrompt({
  taskContext: `
    # arithmetic Tool

    Use for exact arithmetic, concrete numeric evaluation, and already-substituted function values.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Required input:
    - Send operation evaluate.
    - Copy the expression from the user.

    Do not use for:
    - Unresolved symbolic equations.
    - Named probability distributions.
    - Expected values or variances.
  `,
});

export const mathAlgebra = createPrompt({
  taskContext: `
    # algebra Tool

    Use for symbolic algebra.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

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
  `,
});

export const mathEquation = createPrompt({
  taskContext: `
    # equation Tool

    Use for solving equations, systems, inequalities, and polynomial roots.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Required input:
    - Send expression for one equation.
    - Send expressions for a system.
    - Provide explicit variables when the user names them.
    - Preserve solve-domain bounds with lower, upper, and inclusivity fields for solve.
    - Use solve instead of roots when bounds restrict which roots are valid.
    - For system solve-domain bounds, set variable to the bounded variable and variables to all solved variables.
  `,
});

export const mathCalculus = createPrompt({
  taskContext: `
    # calculus Tool

    Use for differentiate, integrate, and limit.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    - Send the target mathematical expression copied from the user.
    - Do not wrap expression in operation syntax such as diff(...), integrate(...), or limit(...).
    - Put the requested action only in operation.
    - For second or higher derivatives, keep expression as the original function and set order.
    - For optimization or extrema, differentiate first, solve the critical equation with the stated domain, then call arithmetic evaluate on the original expression after substituting each valid candidate value that will appear in the answer.
    - Treat minimum point and maximum point requests as asking for both the input location and function value unless the user asks only for the input location.
    - Do not finish an extrema value until the substituted original expression is checked.

    Probability routing:
    - Do not use for named probability distribution moments.
    - Expectations, variances, and random-variable moments must be checked by probability first.

    Bounds and variables:
    - Definite or improper integrals must include lower and upper.
    - Include variable when the expression has parameters or more than one symbol.
    - Use variable x when the user does not name another variable.
    - Provide a limit point when needed.
  `,
});

export const mathSeries = createPrompt({
  taskContext: `
    # series Tool

    Use for Taylor series, asymptotic series, finite sums, symbolic sums, finite products, and symbolic products.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    - series: Taylor or asymptotic expansions.
    - summation: finite or symbolic sums.
    - product: finite or symbolic products.
    - Summation and product need expression, lower, and upper.
  `,
});

export const mathMatrix = createPrompt({
  taskContext: `
    # matrix Tool

    Use for linear algebra.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Supported operations:
    - determinant
    - inverse
    - rank
    - rref
    - eigenvalues
    - eigenvectors
    - eigen_analysis
    - matrix_multiply
    - linear_system

    Routing:
    - Use eigen_analysis for eigenspaces, algebraic or geometric multiplicity, diagonalizability, and Jordan-related checks.
    - matrix_multiply needs right_matrix.
    - linear_system needs vector.
  `,
});

export const mathStatistics = createPrompt({
  taskContext: `
    # statistics Tool

    Use for descriptive statistics.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Supported operations:
    - mean
    - median
    - mode
    - variance
    - standard_deviation
    - quartiles
    - z_score

    Required input:
    - Send values as the dataset.
    - z_score also needs the target expression.
  `,
});

export const mathProbability = createPrompt({
  taskContext: `
    # probability Tool

    Use for supported named probability distributions such as normal, binomial, or poisson.
    This is the evidence source for expectations, variances, and moments of random variables.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Routing:
    - Prefer probability over arithmetic or calculus when a distribution and its parameters are given.
    - For named-distribution moments, call probability before any calculus derivation detail.

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
    - Use expected_value for any requested expectation of a random variable or transformed random-variable expression.
    - Use variance_probability for any requested variance of a random variable or transformed random-variable expression.
    - Keep variable as the underlying random variable name, not the transformed expression.
    - Put the requested transform in expression when the moment is about a transformed random variable.
    - The expression must contain exactly one random variable, matching variable when provided.
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
  `,
});

export const mathGeometry = createPrompt({
  taskContext: `
    # geometry Tool

    Use for coordinate geometry.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Supported operations:
    - distance
    - midpoint
    - slope
    - line equations
    - circle equations
    - intersections

    Required input:
    - Send points for point-based operations.
    - Send expressions for equation intersections.
  `,
});

export const mathDiscrete = createPrompt({
  taskContext: `
    # discrete Tool

    Use for discrete math and number theory.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Supported operations:
    - gcd
    - lcm
    - prime_factorization
    - is_prime
    - modular
    - permutation
    - combination

    Required input:
    - gcd and lcm need values.
    - modular needs n and modulus.
    - permutation and combination need n and k.
  `,
});
