import { Array as Arr, HashSet, Tuple } from "effect";
import {
  isCallExpression,
  isClassDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteral,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { loadsImport } from "#scripts/check/kinds";

const EFFECT = "effect";
/** The Node process modules, by both of their specifiers. */
const PROCESS_MODULES = HashSet.make("child_process", "node:child_process");
/** The function of the process module that starts a child. */
const SPAWN = "spawn";
/** The `Layer` constructors that build the layer of the service they are given. */
const LAYER_CONSTRUCTORS = HashSet.make("effect", "succeed", "sync");

/**
 * Returns each import declaration of a module that loads `matches` at run time
 * and binds named imports only, paired with those imports.
 */
function namedImports(
  sourceFile: SourceFile,
  matches: (specifier: string) => boolean
) {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        loadsImport(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        matches(statement.moduleSpecifier.text)
      )
    ) {
      return [];
    }
    const bindings = statement.importClause?.namedBindings;
    return statement.importClause?.name === undefined &&
      bindings !== undefined &&
      isNamedImports(bindings)
      ? [Tuple.make(statement, bindings.elements)]
      : [];
  });
}

/**
 * Returns the local names a module gives to the export `imported` of `effect`,
 * so `import { Layer as L } from "effect"` yields `L` for `Layer`.
 */
function effectNames(sourceFile: SourceFile, imported: string) {
  return Arr.flatMap(
    namedImports(sourceFile, (specifier) => specifier === EFFECT),
    ([, elements]) =>
      Arr.flatMap(elements, (element) =>
        (element.propertyName ?? element.name).text === imported
          ? [element.name.text]
          : []
      )
  );
}

/** Whether a node reads `member` of one of the namespaces `owners`, such as `Context.Service`. */
function readsMember(
  node: Node,
  owners: readonly string[],
  member: (name: string) => boolean
) {
  return (
    isPropertyAccessExpression(node) &&
    isIdentifier(node.expression) &&
    Arr.contains(owners, node.expression.text) &&
    member(node.name.text)
  );
}

/**
 * Returns the names of the classes a module declares as Effect services: a
 * top-level class that extends `Context.Service<Self, Shape>()("Id")`, which is
 * a call of the call of `Context.Service`.
 */
function serviceClasses(sourceFile: SourceFile) {
  const contexts = effectNames(sourceFile, "Context");
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (!(isClassDeclaration(statement) && statement.name !== undefined)) {
      return [];
    }
    const extended = Arr.flatMap(statement.heritageClauses ?? [], (clause) =>
      clause.token === SyntaxKind.ExtendsKeyword ? clause.types : []
    );
    return Arr.some(
      extended,
      ({ expression }) =>
        isCallExpression(expression) &&
        isCallExpression(expression.expression) &&
        readsMember(
          expression.expression.expression,
          contexts,
          (name) => name === "Service"
        )
    )
      ? [statement.name.text]
      : [];
  });
}

/**
 * Whether a module builds the layer of a service class that it declares, as in
 * `Layer.succeed(Service, ...)` or `Layer.effect(Service, ...)`, with `Context`
 * and `Layer` imported from `effect`.
 */
function providesOwnService(sourceFile: SourceFile, nodes: readonly Node[]) {
  const layers = effectNames(sourceFile, "Layer");
  const services = serviceClasses(sourceFile);
  return Arr.some(
    nodes,
    (node) =>
      isCallExpression(node) &&
      readsMember(node.expression, layers, (name) =>
        HashSet.has(LAYER_CONSTRUCTORS, name)
      ) &&
      Arr.some(
        Arr.take(node.arguments, 1),
        (service) =>
          isIdentifier(service) && Arr.contains(services, service.text)
      )
  );
}

/** Whether an options argument is an object literal that sets `detached: true`. */
function isDetached(options: Node) {
  return (
    isObjectLiteralExpression(options) &&
    Arr.some(
      options.properties,
      (property) =>
        isPropertyAssignment(property) &&
        isIdentifier(property.name) &&
        property.name.text === "detached" &&
        property.initializer.kind === SyntaxKind.TrueKeyword
    )
  );
}

/**
 * Whether a module starts children only as leaders of their own process group:
 * it calls `spawn`, and the last argument of each call sets `detached: true`.
 */
function spawnsDetached(nodes: readonly Node[]) {
  const calls = Arr.filter(
    nodes,
    (node) =>
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === SPAWN
  );
  return (
    Arr.isReadonlyArrayNonEmpty(calls) &&
    Arr.every(
      calls,
      (call) =>
        isCallExpression(call) &&
        Arr.some(Arr.takeRight(call.arguments, 1), isDetached)
    )
  );
}

/**
 * Returns the import declarations of the Node process module that a detached
 * process service keeps. Such a module declares a `Context.Service` class,
 * builds that class's layer, imports only `spawn` and types, under that name,
 * and starts every child detached. Effect's spawner signals a child's process group by
 * itself and cannot leave termination to its caller, so a service that owns
 * the termination of a process group starts its child with Node's API behind
 * its own seam. Any other module keeps none.
 */
export function detachedSpawnImports(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const imports = Arr.flatMap(
    namedImports(sourceFile, (specifier) =>
      HashSet.has(PROCESS_MODULES, specifier)
    ),
    ([statement, elements]) =>
      Arr.every(
        elements,
        (element) =>
          element.isTypeOnly ||
          (element.propertyName === undefined && element.name.text === SPAWN)
      )
        ? [statement]
        : []
  );
  return providesOwnService(sourceFile, nodes) && spawnsDetached(nodes)
    ? imports
    : [];
}
