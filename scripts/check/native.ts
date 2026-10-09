import { Array as Arr, HashSet } from "effect";
import {
  isAsyncKeyword,
  isAwaitExpression,
  isBinaryExpression,
  isCallExpression,
  isCaseClause,
  isExportDeclaration,
  isExternalModuleReference,
  isForOfStatement,
  isFunctionLikeDeclaration,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isNamedImports,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isStringLiteral,
  isStringLiteralLikeNode,
  isSwitchStatement,
  isTryStatement,
  isTypeOfExpression,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { handlerFunctions, insideHandler } from "#scripts/check/handler";
import { loadsExport, loadsImport } from "#scripts/check/kinds";
import { candidate } from "#scripts/check/rules";
import { unwrapped } from "#scripts/check/wrapper";

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
export function isPromiseSyntax(node: Node) {
  return (
    (isFunctionLikeDeclaration(node) &&
      Arr.some(node.modifiers ?? [], isAsyncKeyword)) ||
    isAwaitExpression(node) ||
    (isForOfStatement(node) && node.awaitModifier !== undefined)
  );
}

/** Whether a module specifier names a Node file system, path, or process module. */
function namesNodeModule(specifier: Node | undefined) {
  return (
    specifier !== undefined &&
    isStringLiteralLikeNode(specifier) &&
    HashSet.has(NODE_MODULES, specifier.text)
  );
}

/**
 * Whether a callee is a `createRequire(...)` call, which returns a `require`
 * function, such as `createRequire(import.meta.url)`.
 */
function isRequireFactory(callee: Node) {
  if (!isCallExpression(callee)) {
    return false;
  }
  const factory = unwrapped(callee.expression);
  return (
    (isIdentifier(factory) && factory.text === "createRequire") ||
    (isPropertyAccessExpression(factory) &&
      factory.name.text === "createRequire")
  );
}

/**
 * Whether a node loads a Node file system, path, or process module at runtime:
 * an import, an import assignment, a re-export, a dynamic import, or a call of
 * `require` or of a `createRequire` function, each with a literal module name.
 * The callee of a call is unwrapped first, so `(require)` and `(require as
 * NodeRequire)` are the `require` function.
 */
function isNodeModuleLoad(node: Node) {
  if (isImportDeclaration(node)) {
    return loadsImport(node) && namesNodeModule(node.moduleSpecifier);
  }
  if (isImportEqualsDeclaration(node)) {
    return (
      !node.isTypeOnly &&
      isExternalModuleReference(node.moduleReference) &&
      namesNodeModule(node.moduleReference.expression)
    );
  }
  if (isExportDeclaration(node)) {
    return loadsExport(node) && namesNodeModule(node.moduleSpecifier);
  }
  if (!isCallExpression(node)) {
    return false;
  }
  const callee = unwrapped(node.expression);
  const loader =
    callee.kind === SyntaxKind.ImportKeyword ||
    (isIdentifier(callee) && callee.text === "require") ||
    isRequireFactory(callee);
  const [specifier] = node.arguments;
  return loader && namesNodeModule(specifier);
}

/** Whether a node is the string `"object"`, the tag that `typeof` gives an object. */
function isObjectTag(node: Node) {
  return isStringLiteralLikeNode(node) && node.text === "object";
}

/**
 * Whether a node compares a typeof result against the object tag, or switches on
 * a typeof result with an `object` case. Parentheses and assertions around an
 * operand or a case label do not change what it compares.
 */
function isTypeofObjectComparison(node: Node) {
  if (isSwitchStatement(node)) {
    return (
      isTypeOfExpression(unwrapped(node.expression)) &&
      Arr.some(
        node.caseBlock.clauses,
        (clause) =>
          isCaseClause(clause) && isObjectTag(unwrapped(clause.expression))
      )
    );
  }
  if (
    !(
      isBinaryExpression(node) &&
      HashSet.has(EQUALITY_OPERATORS, node.operatorToken.kind)
    )
  ) {
    return false;
  }
  const left = unwrapped(node.left);
  const right = unwrapped(node.right);
  return (
    (isTypeOfExpression(left) && isObjectTag(right)) ||
    (isTypeOfExpression(right) && isObjectTag(left))
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
    return handlerFunctions(options);
  });
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
  if (isNodeModuleLoad(node)) {
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
