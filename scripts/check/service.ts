import { Array as Arr } from "effect";
import {
  isCallExpression,
  isClassDeclaration,
  isIdentifier,
  isPropertyAccessExpression,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";

/** Whether a node reads `member` of the namespace `owner`, such as `Context.Service`. */
function readsMember(node: Node, owner: string, member: string) {
  return (
    isPropertyAccessExpression(node) &&
    isIdentifier(node.expression) &&
    node.expression.text === owner &&
    node.name.text === member
  );
}

/**
 * Whether a heritage expression is an Effect service class, which is written
 * `Context.Service<Self, Shape>()("Id")`: a call of the call of
 * `Context.Service`.
 */
function isServiceBase(node: Node) {
  return (
    isCallExpression(node) &&
    isCallExpression(node.expression) &&
    readsMember(node.expression.expression, "Context", "Service")
  );
}

/** Returns the names of the classes a module declares as Effect services. */
function serviceClasses(sourceFile: SourceFile) {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (!(isClassDeclaration(statement) && statement.name !== undefined)) {
      return [];
    }
    const extended = Arr.flatMap(statement.heritageClauses ?? [], (clause) =>
      clause.token === SyntaxKind.ExtendsKeyword ? clause.types : []
    );
    return Arr.some(extended, ({ expression }) => isServiceBase(expression))
      ? [statement.name.text]
      : [];
  });
}

/**
 * Whether a module is a service of its own: it declares a `Context.Service`
 * class and builds that class's layer among its `nodes`, as in
 * `Layer.succeed(Service, ...)` or `Layer.effect(Service, ...)`. Such a module
 * is the seam where a capability enters the program.
 */
export function providesOwnService(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const services = serviceClasses(sourceFile);
  return Arr.some(
    nodes,
    (node) =>
      isCallExpression(node) &&
      isPropertyAccessExpression(node.expression) &&
      isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Layer" &&
      Arr.some(
        Arr.take(node.arguments, 1),
        (service) =>
          isIdentifier(service) && Arr.contains(services, service.text)
      )
  );
}
