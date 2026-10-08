import { Array as Arr, HashSet } from "effect";
import {
  type ArrowFunction,
  type FunctionExpression,
  isArrowFunction,
  isAsyncKeyword,
  isAwaitExpression,
  isBinaryExpression,
  isCallExpression,
  isElementAccessExpression,
  isForOfStatement,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLikeDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSourceFile,
  isStringLiteral,
  isStringLiteralLikeNode,
  isTryStatement,
  isTypeOfExpression,
  isVariableStatement,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { candidate, REPOSITORY_SPECIFIER_PATTERN } from "#scripts/check/rules";
import type { Binding } from "#scripts/check/source";

/** Array methods that return a new array and have no String counterpart, so a call names an array. */
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
/** Every binding, for a receiver that a repository module exports as a value. */
const ANY_BINDING: readonly (typeof Binding.Type)[] = [
  "global",
  "import",
  "local",
];

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

/** The Confect module whose `workflow` export defines durable workflows. */
const WORKFLOW_MODULE = "@repo/backend/confect/workflow";
const WORKFLOW_EXPORT = "workflow";

/**
 * Returns the local names a module binds to the `workflow` export of the
 * Confect workflow module, such as `workflow` in `import { workflow } from ...`.
 */
function workflowNames(sourceFile: SourceFile) {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === WORKFLOW_MODULE
      )
    ) {
      return [];
    }
    const bindings = statement.importClause?.namedBindings;
    return bindings !== undefined && isNamedImports(bindings)
      ? Arr.flatMap(bindings.elements, (element) =>
          (element.propertyName ?? element.name).text === WORKFLOW_EXPORT
            ? [element.name.text]
            : []
        )
      : [];
  });
}

/** Whether a node is an arrow function or a function expression. */
function isFunctionValue(
  node: Node | undefined
): node is ArrowFunction | FunctionExpression {
  return (
    node !== undefined && (isArrowFunction(node) || isFunctionExpression(node))
  );
}

/**
 * Returns the function a handler names: the function itself when it is written
 * inline, or the module's top-level function declaration or function-valued
 * constant of that name.
 */
function handlerFunctions(
  sourceFile: SourceFile,
  handler: Node
): readonly Node[] {
  if (isFunctionValue(handler)) {
    return [handler];
  }
  if (!isIdentifier(handler)) {
    return [];
  }
  return Arr.flatMap(sourceFile.statements, (statement): readonly Node[] => {
    if (isFunctionDeclaration(statement)) {
      return statement.name?.text === handler.text ? [statement] : [];
    }
    return isVariableStatement(statement)
      ? Arr.flatMap(statement.declarationList.declarations, (declaration) =>
          isIdentifier(declaration.name) &&
          declaration.name.text === handler.text &&
          isFunctionValue(declaration.initializer)
            ? [declaration.initializer]
            : []
        )
      : [];
  });
}

/**
 * Returns the handler functions of each Confect workflow a module defines: the
 * value of `handler` in the object that `workflow.define` receives, where
 * `workflow` is bound to the Confect workflow module's export. The Convex
 * workflow engine owns when a handler's steps start, because it starts them in
 * parallel only when their requests are already buffered when it handles the
 * first new one (`@convex-dev/workflow`, `src/client/step.ts`,
 * `StepExecutor.run`). An Effect runtime would start them through its
 * scheduler, so a handler keeps native promise syntax.
 */
function workflowHandlers(sourceFile: SourceFile, nodes: readonly Node[]) {
  const names = workflowNames(sourceFile);
  return Arr.flatMap(nodes, (node) => {
    if (
      !(
        isCallExpression(node) &&
        isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "define" &&
        isIdentifier(node.expression.expression) &&
        Arr.contains(names, node.expression.expression.text)
      )
    ) {
      return [];
    }
    const [options] = node.arguments;
    if (options === undefined || !isObjectLiteralExpression(options)) {
      return [];
    }
    return Arr.flatMap(options.properties, (property) =>
      isPropertyAssignment(property) &&
      isIdentifier(property.name) &&
      property.name.text === "handler"
        ? handlerFunctions(sourceFile, property.initializer)
        : []
    );
  });
}

/** Whether a node is one of the handler functions or sits inside one. */
function insideHandler(node: Node, handlers: readonly Node[]): boolean {
  if (Arr.some(handlers, (handler) => handler === node)) {
    return true;
  }
  return !isSourceFile(node) && insideHandler(node.parent, handlers);
}

/** Returns the native array, Promise, module, and failure syntax at one node. */
function syntaxCandidates(
  sourceFile: SourceFile,
  node: Node,
  handlers: readonly Node[]
) {
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
  if (isPromiseSyntax(node) && !insideHandler(node, handlers)) {
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
 * Effect replaces: array methods, Promise syntax outside Confect workflow
 * handlers, Node module imports, raw failure handling, and hand-rolled
 * narrowing.
 */
export function nativeCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const handlers = workflowHandlers(sourceFile, nodes);
  return Arr.flatMap(nodes, (node) =>
    syntaxCandidates(sourceFile, node, handlers)
  );
}
