import { Array as Arr, Effect, HashSet, Option, Result, Tuple } from "effect";
import {
  type Identifier,
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
import { enclosingFunction, handlerFunctions } from "#scripts/check/handler";
import { candidate } from "#scripts/check/rules";
import type { parseSources } from "#scripts/check/source";
import { unwrapped } from "#scripts/check/wrapper";

/** Resolves identifiers to the bindings they name, as `parseSources` returns it. */
type Bind = Effect.Success<ReturnType<typeof parseSources>>["bind"];

/** The Convex function builders whose options object holds a vanilla handler. */
const CONVEX_BUILDERS = HashSet.make(
  "action",
  "internalAction",
  "internalMutation",
  "internalQuery",
  "mutation",
  "query"
);
/** Convex's generated server module ends every specifier that names it, such as `./_generated/server`. */
const GENERATED_SERVER = "/_generated/server";
const CONVEX_VALUES = "convex/values";
const CONVEX_ERROR = "ConvexError";

/** One call of a Convex builder: the identifier that names the builder, and one handler of its options. */
type BuilderHandler = readonly [callee: Identifier, handler: Node];

/**
 * A throw that a builder's handler raises with a `ConvexError`, with the two
 * identifiers that decide whether the throw is exempt: the builder and the error.
 */
type Probe = readonly [
  node: ThrowStatement,
  callee: Identifier,
  error: Identifier,
];

/**
 * Returns the local names that a module binds to the imports that `matches`
 * accepts, by module specifier and imported name. An aliased import binds its
 * local name, so `import { mutation as m }` yields `m`.
 */
function importedNames(
  sourceFile: SourceFile,
  matches: (specifier: string, imported: string) => boolean
) {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      )
    ) {
      return [];
    }
    const specifier = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    return bindings !== undefined && isNamedImports(bindings)
      ? Arr.flatMap(bindings.elements, (element) =>
          matches(specifier, (element.propertyName ?? element.name).text)
            ? [element.name.text]
            : []
        )
      : [];
  });
}

/**
 * Returns each call among the nodes whose callee is one of the local `builders`
 * names, paired with each handler function of its options object.
 */
function builderHandlers(
  nodes: readonly Node[],
  builders: readonly string[]
): readonly BuilderHandler[] {
  return Arr.flatMap(nodes, (node) => {
    if (!(isCallExpression(node) && isIdentifier(node.expression))) {
      return [];
    }
    const callee = node.expression;
    const [options] = node.arguments;
    return Arr.contains(builders, callee.text) &&
      options !== undefined &&
      isObjectLiteralExpression(options)
      ? Arr.map(handlerFunctions(options), (handler) =>
          Tuple.make(callee, handler)
        )
      : [];
  });
}

/**
 * Returns the probe of a throw that a builder's handler raises directly with a
 * `ConvexError` that the module names. Any other throw has no probe.
 */
function probeOf(
  node: ThrowStatement,
  handlers: readonly BuilderHandler[],
  errors: readonly string[]
): Option.Option<Probe> {
  const thrown = unwrapped(node.expression);
  const owner = enclosingFunction(node);
  const builder = Arr.findFirst(handlers, ([, handler]) => handler === owner);
  return isNewExpression(thrown) &&
    isIdentifier(thrown.expression) &&
    Arr.contains(errors, thrown.expression.text) &&
    Option.isSome(builder)
    ? Option.some(Tuple.make(node, builder.value[0], thrown.expression))
    : Option.none();
}

/**
 * Returns the throws that their probes exempt. A probe is exempt only when its
 * builder and its error class both bind to imports: a local binding of either
 * name makes the throw an ordinary throw.
 */
const exemptThrows = Effect.fn("RepositoryPolicy.exemptThrows")(function* (
  probes: readonly Probe[],
  bind: Bind
) {
  if (Arr.isReadonlyArrayEmpty(probes)) {
    return Arr.empty<ThrowStatement>();
  }
  const callees = yield* bind(Arr.map(probes, ([, callee]) => callee));
  const errors = yield* bind(Arr.map(probes, ([, , error]) => error));
  return Arr.filterMap(
    Arr.zip(probes, Arr.zip(callees, errors)),
    ([[node], [callee, error]]) =>
      callee === "import" && error === "import"
        ? Result.succeed(node)
        : Result.failVoid
  );
});

/**
 * Describes one candidate per throw statement among the runtime nodes, which
 * are the nodes outside browser page functions. A Convex application error that
 * a vanilla Convex handler throws is not a candidate: the handler is the nearest
 * function of the throw, its builder is a Convex builder that the module imports
 * from the generated server, and the error class is `ConvexError` from
 * `convex/values`. Convex aborts the transaction with that error and returns it
 * to the caller as a typed application error, which a vanilla handler has no
 * Effect channel to replace. A throw in a callback that the handler contains is a
 * candidate, because the callback is its own nearest function.
 */
export const failureCandidates = Effect.fn(
  "RepositoryPolicy.failureCandidates"
)(function* (sourceFile: SourceFile, runtime: readonly Node[], bind: Bind) {
  const builders = importedNames(
    sourceFile,
    (specifier, imported) =>
      specifier.endsWith(GENERATED_SERVER) &&
      HashSet.has(CONVEX_BUILDERS, imported)
  );
  const errors = importedNames(
    sourceFile,
    (specifier, imported) =>
      specifier === CONVEX_VALUES && imported === CONVEX_ERROR
  );
  const handlers = builderHandlers(runtime, builders);
  const throws = Arr.filter(runtime, isThrowStatement);
  const probes = Arr.flatMap(throws, (node) =>
    Option.toArray(probeOf(node, handlers, errors))
  );
  const exempt = yield* exemptThrows(probes, bind);
  return Arr.map(
    Arr.filter(throws, (node) => !Arr.some(exempt, (entry) => entry === node)),
    (node) => candidate("throw", sourceFile, node)
  );
});
