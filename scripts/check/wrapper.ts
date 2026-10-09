import {
  isAsExpression,
  isNonNullExpression,
  isParenthesizedExpression,
  isSatisfiesExpression,
  type Node,
} from "typescript/unstable/ast";

/**
 * Whether a node only wraps an expression: parentheses, a non-null assertion, a
 * type assertion, or `satisfies`.
 */
function isWrapper(node: Node) {
  return (
    isParenthesizedExpression(node) ||
    isNonNullExpression(node) ||
    isAsExpression(node) ||
    isSatisfiesExpression(node)
  );
}

/** Returns the outermost expression that only wraps `node`, such as `(Object)`. */
export function wrapped(node: Node): Node {
  return isWrapper(node.parent) ? wrapped(node.parent) : node;
}

/**
 * Returns the expression inside every wrapper around `node`, such as `Effect` in
 * `(Effect as typeof Effect)`, so a rule matches the value that a wrapper keeps.
 */
export function unwrapped(node: Node): Node {
  return isWrapper(node) ? unwrapped(node.expression) : node;
}
