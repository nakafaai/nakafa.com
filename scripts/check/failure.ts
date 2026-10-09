import { Array as Arr, HashSet } from "effect";
import {
  isCallExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNewExpression,
  isObjectLiteralExpression,
  isStringLiteral,
  isThrowStatement,
  type Node,
  type SourceFile,
  type ThrowStatement,
} from "typescript/unstable/ast";
import { handlerFunctions, insideHandler } from "#scripts/check/handler";
import { candidate } from "#scripts/check/rules";
import { unwrapped } from "#scripts/check/wrapper";

/** The Convex function builders whose options object holds a vanilla handler. */
const CONVEX_BUILDERS = HashSet.make(
  "action",
  "internalAction",
  "internalMutation",
  "internalQuery",
  "mutation",
  "query"
);
const CONVEX_VALUES = "convex/values";
const CONVEX_ERROR = "ConvexError";

/**
 * Returns the local names that a module binds to `ConvexError` from
 * `convex/values`, such as `ConvexError` in `import { ConvexError, v } from
 * "convex/values"`.
 */
function convexErrorNames(sourceFile: SourceFile) {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === CONVEX_VALUES
      )
    ) {
      return [];
    }
    const bindings = statement.importClause?.namedBindings;
    return bindings !== undefined && isNamedImports(bindings)
      ? Arr.flatMap(bindings.elements, (element) =>
          (element.propertyName ?? element.name).text === CONVEX_ERROR
            ? [element.name.text]
            : []
        )
      : [];
  });
}

/**
 * Returns the handler functions of each Convex builder call among the nodes: the
 * `handler` option of the options object that `query`, `mutation`, `action`, or
 * their internal forms receive.
 */
function builderHandlers(nodes: readonly Node[]) {
  return Arr.flatMap(nodes, (node) => {
    if (
      !(
        isCallExpression(node) &&
        isIdentifier(node.expression) &&
        HashSet.has(CONVEX_BUILDERS, node.expression.text)
      )
    ) {
      return [];
    }
    const [options] = node.arguments;
    return options !== undefined && isObjectLiteralExpression(options)
      ? handlerFunctions(options)
      : [];
  });
}

/**
 * Whether a throw raises a Convex application error inside a vanilla handler:
 * `throw new ConvexError(...)`, where the module binds that name from
 * `convex/values`, and the throw sits in a handler function. Convex aborts the
 * transaction with that error and returns it to the caller as a typed
 * application error, which a vanilla handler has no Effect channel to replace.
 */
function isConvexAbort(
  node: ThrowStatement,
  errors: readonly string[],
  handlers: readonly Node[]
) {
  const thrown = unwrapped(node.expression);
  return (
    isNewExpression(thrown) &&
    isIdentifier(thrown.expression) &&
    Arr.contains(errors, thrown.expression.text) &&
    insideHandler(node, handlers)
  );
}

/**
 * Describes one candidate per throw statement among the runtime nodes, which
 * are the nodes outside browser page functions. A Convex application error that
 * a vanilla Convex handler throws is not a candidate. A throw leaves the Effect
 * error channel, where a tagged error keeps the failure typed and each caller
 * can handle it by its tag.
 */
export function failureCandidates(
  sourceFile: SourceFile,
  runtime: readonly Node[]
) {
  const errors = convexErrorNames(sourceFile);
  const handlers = builderHandlers(runtime);
  return Arr.map(
    Arr.filter(
      runtime,
      (node) => isThrowStatement(node) && !isConvexAbort(node, errors, handlers)
    ),
    (node) => candidate("throw", sourceFile, node)
  );
}
