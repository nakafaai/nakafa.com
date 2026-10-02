import { Array as Arr, HashSet } from "effect";
import {
  isAsyncKeyword,
  isAwaitExpression,
  isBinaryExpression,
  isCallExpression,
  isForOfStatement,
  isFunctionLikeDeclaration,
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

/** Array methods with no String counterpart, so a call names an array. */
const ARRAY_METHODS = HashSet.make(
  "copyWithin",
  "every",
  "fill",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flat",
  "flatMap",
  "forEach",
  "map",
  "pop",
  "push",
  "reduce",
  "reduceRight",
  "reverse",
  "shift",
  "some",
  "sort",
  "splice",
  "toReversed",
  "toSorted",
  "toSpliced",
  "unshift"
);
const NODE_MODULES = HashSet.make(
  "child_process",
  "fs",
  "fs/promises",
  "node:child_process",
  "node:fs",
  "node:fs/promises",
  "node:path",
  "node:path/posix",
  "node:path/win32",
  "path",
  "path/posix",
  "path/win32"
);
const EQUALITY_OPERATORS = HashSet.make(
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken
);
/** Receivers that are not module imports, so an array method transforms a value. */
const VALUE_BINDINGS: readonly (typeof Binding.Type)[] = ["global", "local"];

/** Returns the receiver of a call to an array method that has no String counterpart. */
function arrayReceiver(node: Node) {
  if (
    !(isCallExpression(node) && isPropertyAccessExpression(node.expression))
  ) {
    return;
  }
  const method = node.expression.name.text;
  return HashSet.has(ARRAY_METHODS, method) ||
    (method === "join" && node.arguments.length <= 1)
    ? node.expression.expression
    : undefined;
}

/** Whether a node declares an async function or waits on a Promise. */
function isPromiseSyntax(node: Node) {
  return (
    (isFunctionLikeDeclaration(node) &&
      Arr.some(node.modifiers ?? [], isAsyncKeyword)) ||
    isAwaitExpression(node) ||
    (isForOfStatement(node) && node.awaitModifier !== undefined)
  );
}

/** Whether a node imports a Node file system, path, or process module at runtime. */
function isNodeModuleImport(node: Node) {
  if (isImportDeclaration(node)) {
    const clause = node.importClause;
    const bindings = clause?.namedBindings;
    const typeOnly =
      clause?.phaseModifier === SyntaxKind.TypeKeyword ||
      (clause?.name === undefined &&
        bindings !== undefined &&
        isNamedImports(bindings) &&
        Arr.every(bindings.elements, ({ isTypeOnly }) => isTypeOnly));
    return (
      !typeOnly &&
      isStringLiteral(node.moduleSpecifier) &&
      HashSet.has(NODE_MODULES, node.moduleSpecifier.text)
    );
  }
  if (
    !(
      isCallExpression(node) &&
      node.expression.kind === SyntaxKind.ImportKeyword
    )
  ) {
    return false;
  }
  const [specifier] = node.arguments;
  return (
    specifier !== undefined &&
    isStringLiteralLikeNode(specifier) &&
    HashSet.has(NODE_MODULES, specifier.text)
  );
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

/** Returns the native array, Promise, module, and failure syntax at one node. */
function syntaxCandidates(sourceFile: SourceFile, node: Node) {
  const receiver = arrayReceiver(node);
  if (receiver !== undefined) {
    return [
      isIdentifier(receiver)
        ? candidate("array-method", sourceFile, node, receiver, VALUE_BINDINGS)
        : candidate("array-method", sourceFile, node),
    ];
  }
  if (isPromiseSyntax(node)) {
    return [candidate("promise", sourceFile, node)];
  }
  if (isNodeModuleImport(node)) {
    return [candidate("node-module", sourceFile, node)];
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
 * an Effect module replaces: array methods, Promise syntax, Node module
 * imports, raw failure handling, and hand-rolled narrowing.
 */
export function nativeCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return Arr.flatMap(nodes, (node) => syntaxCandidates(sourceFile, node));
}
