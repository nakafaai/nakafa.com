import { Array as Arr, HashSet } from "effect";
import {
  isBinaryExpression,
  isCallExpression,
  isElementAccessExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isPropertyAccessExpression,
  isStringLiteral,
  isStringLiteralLikeNode,
  isTryStatement,
  isTypeOfExpression,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";
import type { Binding } from "#scripts/check/source";

/** Array methods that return a new value and have no String counterpart. */
const ARRAY_METHODS = HashSet.make(
  "every",
  "filter",
  "flat",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some",
  "toReversed"
);
/** Array methods that change their array in place. */
const MUTATION_METHODS = HashSet.make(
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
/** Receivers that are not module imports, so an array method transforms a value. */
const VALUE_BINDINGS: readonly (typeof Binding.Type)[] = ["global", "local"];
/** Every binding, for a receiver that a repository module exports as a value. */
const ANY_BINDING: readonly (typeof Binding.Type)[] = [
  "global",
  "import",
  "local",
];
/** Relative paths, app and script aliases, and workspace packages name repository modules. */
const REPOSITORY_SPECIFIER_PATTERN = /^(?:\.|@\/|@repo\/|#)/u;

const EQUALITY_OPERATORS = HashSet.make(
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken
);

/**
 * Returns the method a call invokes and its receiver, for a callee written as
 * a property or as an element access with a string literal, such as
 * `rows.map(format)` or `rows["map"](format)`.
 */
function calledMethod(node: Node) {
  if (!isCallExpression(node)) {
    return;
  }
  const callee = node.expression;
  if (isPropertyAccessExpression(callee)) {
    return {
      count: node.arguments.length,
      method: callee.name.text,
      receiver: callee.expression,
    };
  }
  return isElementAccessExpression(callee) &&
    isStringLiteralLikeNode(callee.argumentExpression)
    ? {
        count: node.arguments.length,
        method: callee.argumentExpression.text,
        receiver: callee.expression,
      }
    : undefined;
}

/**
 * Returns the receiver of a call to an array method and the rule it breaks:
 * a method that transforms its array, changes it in place, or searches it. `join` counts
 * with at most one argument, which tells it from the path helper of the same
 * name.
 */
function arrayCall(node: Node) {
  const call = calledMethod(node);
  if (call === undefined) {
    return;
  }
  if (
    HashSet.has(ARRAY_METHODS, call.method) ||
    (call.method === "join" && call.count <= 1)
  ) {
    return { receiver: call.receiver, rule: "array-method" as const };
  }
  if (HashSet.has(MUTATION_METHODS, call.method)) {
    return { receiver: call.receiver, rule: "array-mutation" as const };
  }
  return HashSet.has(SEARCH_METHODS, call.method)
    ? { receiver: call.receiver, rule: "array-search" as const }
    : undefined;
}

/**
 * Whether a module imports `name` as a value from a repository module, by a
 * default or a named import. Such an import is a value like any local one,
 * while a namespace import or a package import may be a module of functions,
 * such as `Arr` from `effect`.
 */
function importsRepositoryValue(sourceFile: SourceFile, name: string) {
  return Arr.some(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        REPOSITORY_SPECIFIER_PATTERN.test(statement.moduleSpecifier.text)
      )
    ) {
      return false;
    }
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    return (
      clause?.name?.text === name ||
      (bindings !== undefined &&
        isNamedImports(bindings) &&
        Arr.some(bindings.elements, (element) => element.name.text === name))
    );
  });
}

/** Whether a node compares a typeof result against the object tag. */
function isTypeofObjectComparison(node: Node) {
  if (
    !(
      isBinaryExpression(node) &&
      HashSet.has(EQUALITY_OPERATORS, node.operatorToken.kind)
    )
  ) {
    return false;
  }
  const { left, right } = node;
  return (
    (isTypeOfExpression(left) &&
      isStringLiteralLikeNode(right) &&
      right.text === "object") ||
    (isTypeOfExpression(right) &&
      isStringLiteralLikeNode(left) &&
      left.text === "object")
  );
}

/** Returns the native array, failure, and narrowing syntax at one node. */
function syntaxCandidates(sourceFile: SourceFile, node: Node) {
  const call = arrayCall(node);
  if (call !== undefined) {
    return [
      isIdentifier(call.receiver)
        ? candidate(
            call.rule,
            sourceFile,
            node,
            call.receiver,
            importsRepositoryValue(sourceFile, call.receiver.text)
              ? ANY_BINDING
              : VALUE_BINDINGS
          )
        : candidate(call.rule, sourceFile, node),
    ];
  }
  if (isTryStatement(node) && node.catchClause !== undefined) {
    return [candidate("try-catch", sourceFile, node)];
  }
  return isTypeofObjectComparison(node)
    ? [candidate("typeof-object", sourceFile, node)]
    : [];
}

/**
 * Returns the native syntax among one module's value-position `nodes` that
 * Effect replaces: array methods, raw failure handling, and hand-rolled
 * narrowing.
 */
export function nativeCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return Arr.flatMap(nodes, (node) => syntaxCandidates(sourceFile, node));
}
