import { Array as Arr, HashSet } from "effect";
import {
  isAsyncKeyword,
  isAwaitExpression,
  isBinaryExpression,
  isCallExpression,
  isComputedPropertyName,
  isForOfStatement,
  isFunctionLikeDeclaration,
  isIdentifier,
  isImportDeclaration,
  isMethodDeclaration,
  isNamedImports,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isShorthandPropertyAssignment,
  isSourceFile,
  isStringLiteral,
  isStringLiteralLikeNode,
  isTryStatement,
  isTypeOfExpression,
  type Node,
  type PropertyName,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";
import { boundFunctions, isFunctionValue } from "#scripts/check/scope";

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
/** The option of `workflow.define` that holds a workflow's handler. */
const HANDLER_KEY = "handler";

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

/**
 * Returns the static key that a property name spells: an identifier, a string,
 * or a computed string, such as `handler`, `"handler"`, or `["handler"]`.
 */
function propertyName(name: PropertyName): string | undefined {
  if (isIdentifier(name) || isStringLiteral(name)) {
    return name.text;
  }
  return isComputedPropertyName(name) && isStringLiteral(name.expression)
    ? name.expression.text
    : undefined;
}

/**
 * Returns the functions a handler value names: the function itself when it is
 * written inline, or the function that an identifier binds where it stands.
 */
function handlerFunctions(handler: Node): readonly Node[] {
  if (isFunctionValue(handler)) {
    return [handler];
  }
  return isIdentifier(handler) ? boundFunctions(handler) : [];
}

/**
 * Returns the handler functions that one option of `workflow.define` names: a
 * method called `handler`, the value of a `handler` property, or the variable
 * that a shorthand `handler` reads.
 */
function handlerOptions(option: Node): readonly Node[] {
  if (isMethodDeclaration(option)) {
    return propertyName(option.name) === HANDLER_KEY ? [option] : [];
  }
  if (isPropertyAssignment(option)) {
    return propertyName(option.name) === HANDLER_KEY
      ? handlerFunctions(option.initializer)
      : [];
  }
  if (isShorthandPropertyAssignment(option)) {
    return propertyName(option.name) === HANDLER_KEY
      ? handlerFunctions(option.name)
      : [];
  }
  return [];
}

/**
 * Returns the handler functions of each Confect workflow a module defines: the
 * `handler` option of the object that `workflow.define` receives, where
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
    return Arr.flatMap(options.properties, handlerOptions);
  });
}

/** Whether a node is one of the handler functions or sits inside one. */
function insideHandler(node: Node, handlers: readonly Node[]): boolean {
  if (Arr.some(handlers, (handler) => handler === node)) {
    return true;
  }
  return !isSourceFile(node) && insideHandler(node.parent, handlers);
}

/** Returns the native Promise, module, and failure syntax at one node. */
function syntaxCandidates(
  sourceFile: SourceFile,
  node: Node,
  handlers: readonly Node[]
) {
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
 * Effect replaces: Promise syntax outside Confect workflow handlers, Node module
 * imports, raw failure handling, and hand-rolled narrowing. Array methods are
 * judged by the typed pass in `arrays.ts`.
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
