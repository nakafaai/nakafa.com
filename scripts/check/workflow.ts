import { Array as Arr } from "effect";
import {
  isCallExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isStringLiteral,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { handlerFunctions } from "#scripts/check/handler";

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
export function workflowHandlers(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
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
