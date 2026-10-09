import { HashSet, Result } from "effect";
import {
  isCallExpression,
  isElementAccessExpression,
  isPropertyAccessExpression,
  isStringLiteralLikeNode,
  type Node,
} from "typescript/unstable/ast";
import type { Rule } from "#scripts/check/rules";
import { unwrapped } from "#scripts/check/wrapper";

/** Array methods that transform, read, or search an array and have no String counterpart. `join` is among them: the receiver's type tells an array's join from the path helper of the same name. */
const ARRAY_METHODS = HashSet.make(
  "every",
  "filter",
  "flat",
  "flatMap",
  "forEach",
  "join",
  "map",
  "reduce",
  "reduceRight",
  "some",
  "toReversed",
  "toSorted",
  "toSpliced"
);
/** Array methods that change their array in place. */
const MUTATION_METHODS = HashSet.make(
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift"
);
/** Array methods that search for one element, which Effect returns as an Option. */
const SEARCH_METHODS = HashSet.make(
  "find",
  "findIndex",
  "findLast",
  "findLastIndex"
);

/** The three rules that judge an array method call by its receiver's type. */
export const ARRAY_RULES: readonly (typeof Rule.Type)[] = [
  "array-method",
  "array-mutation",
  "array-search",
];

/** Returns the rule that a method breaks, or `undefined` when no array rule covers it. */
function arrayRule(method: string): typeof Rule.Type | undefined {
  if (HashSet.has(ARRAY_METHODS, method)) {
    return "array-method";
  }
  if (HashSet.has(MUTATION_METHODS, method)) {
    return "array-mutation";
  }
  return HashSet.has(SEARCH_METHODS, method) ? "array-search" : undefined;
}

/**
 * Returns the method that a call invokes and its receiver, for a callee written
 * as a property or as an element access with a string literal, such as
 * `rows.map(format)` or `rows["map"](format)`.
 */
function calledMethod(node: Node) {
  if (!isCallExpression(node)) {
    return;
  }
  const callee = unwrapped(node.expression);
  if (isPropertyAccessExpression(callee)) {
    return { method: callee.name.text, receiver: callee.expression };
  }
  return isElementAccessExpression(callee) &&
    isStringLiteralLikeNode(callee.argumentExpression)
    ? {
        method: callee.argumentExpression.text,
        receiver: callee.expression,
      }
    : undefined;
}

/** Returns the array method call that a node is, with its receiver and the rule it breaks. */
export function arrayCall(node: Node) {
  const call = calledMethod(node);
  const rule = call === undefined ? undefined : arrayRule(call.method);
  return call === undefined || rule === undefined
    ? Result.failVoid
    : Result.succeed({ node, receiver: call.receiver, rule });
}
