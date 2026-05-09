/**
 * Describes the deterministic math operations exposed to Nina.
 *
 * References:
 * - AI SDK tool descriptions:
 *   https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 * - Math.js algebra support:
 *   https://mathjs.org/docs/expressions/algebra.html
 */
export const mathEvaluate =
  "Evaluate a concrete numeric Math.js expression. Use when the expression has no unresolved variables and the user needs a deterministic value.";

export const mathSimplify =
  "Simplify an algebraic Math.js expression. Use for symbolic rewriting, not for proving domain-sensitive equivalence.";

export const mathDifferentiate =
  "Differentiate a Math.js expression with respect to one variable.";

export const mathCompare =
  "Compare two Math.js expressions. Returns verified, contradicted, or inconclusive based on symbolic checks and deterministic numeric counterexamples.";
