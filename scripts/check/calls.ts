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

/**
 * Array methods that transform or read an array. Some also exist on String, such
 * as `includes` and `slice`, and `join` on a path helper, so the receiver's type
 * decides which calls count.
 */
const ARRAY_METHODS = HashSet.make(
  "concat",
  "entries",
  "every",
  "filter",
  "flat",
  "flatMap",
  "forEach",
  "includes",
  "join",
  "map",
  "reduce",
  "reduceRight",
  "slice",
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
/**
 * Array methods that look up one element or its index, which Effect returns as an
 * Option. `at`, `indexOf`, and `lastIndexOf` also exist on String.
 */
const SEARCH_METHODS = HashSet.make(
  "at",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "indexOf",
  "lastIndexOf"
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
 * Returns the method that a call invokes, the node that spells its name, and its
 * receiver, for a callee written as a property or as an element access with a
 * string literal, such as `rows.map(format)` or `rows["map"](format)`.
 */
function calledMethod(node: Node) {
  if (!isCallExpression(node)) {
    return;
  }
  const callee = unwrapped(node.expression);
  if (isPropertyAccessExpression(callee)) {
    return {
      method: callee.name.text,
      name: callee.name,
      receiver: callee.expression,
    };
  }
  return isElementAccessExpression(callee) &&
    isStringLiteralLikeNode(callee.argumentExpression)
    ? {
        method: callee.argumentExpression.text,
        name: callee.argumentExpression,
        receiver: callee.expression,
      }
    : undefined;
}

/**
 * Returns the array method call that a node is, with the node that names the
 * method, its receiver, and the rule it breaks. A chained call reports the line of
 * its method name, not the line where the chain starts.
 */
export function arrayCall(node: Node) {
  const call = calledMethod(node);
  const rule = call === undefined ? undefined : arrayRule(call.method);
  return call === undefined || rule === undefined
    ? Result.failVoid
    : Result.succeed({
        name: call.name,
        node,
        receiver: call.receiver,
        rule,
      });
}
