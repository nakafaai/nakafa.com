import { Array as Arr, HashSet, Option } from "effect";
import {
  isCallExpression,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import {
  importedNames,
  namedImports,
  readsMember,
  readsOf,
} from "#scripts/check/imports";

/** The Node HTTP module, by both of its specifiers. */
const HTTP_MODULES = HashSet.make("http", "node:http");
/** The function of the HTTP module that creates a server. */
const CREATE_SERVER = "createServer";
/** The package and the module of the platform's HTTP server. */
const PLATFORM_PACKAGE = "@effect/platform-node";
const PLATFORM_SERVER = "NodeHttpServer";
/** The functions of the platform server that take a Node server constructor as their first argument. */
const SERVER_FUNCTIONS = HashSet.make(
  "layer",
  "layerConfig",
  "layerServer",
  "make"
);

/** Whether a node is the first argument of a call of a platform server function. */
function isHandedOver(node: Node, owners: readonly string[]) {
  const call = node.parent;
  return (
    isCallExpression(call) &&
    Option.exists(Arr.head(call.arguments), (first) => first === node) &&
    readsMember(call.expression, owners, (name) =>
      HashSet.has(SERVER_FUNCTIONS, name)
    )
  );
}

/**
 * Returns the import declarations of the Node HTTP module that a platform HTTP
 * server keeps. Effect's `NodeHttpServer.make`, `layer`, `layerConfig`, and
 * `layerServer` take the constructor of a Node server as their first argument
 * and no other way to build the server, so a module that serves with them
 * imports `createServer`. All of these hold:
 * - The import declaration binds `createServer` under that name, and nothing
 *   else at run time.
 * - The module imports `NodeHttpServer` from `@effect/platform-node`.
 * - Every read of `createServer` is the first argument of a call of one of
 *   those four functions, and the module has at least one.
 * Any other load of the HTTP module is still reported.
 */
export function platformServerImports(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const imports = Arr.flatMap(
    namedImports(sourceFile, (specifier) =>
      HashSet.has(HTTP_MODULES, specifier)
    ),
    ([statement, elements]) =>
      Arr.every(
        elements,
        (element) =>
          element.isTypeOnly ||
          (element.propertyName === undefined &&
            element.name.text === CREATE_SERVER)
      )
        ? [statement]
        : []
  );
  const owners = importedNames(sourceFile, PLATFORM_PACKAGE, PLATFORM_SERVER);
  const uses = readsOf(nodes, CREATE_SERVER);
  return Arr.isReadonlyArrayNonEmpty(uses) &&
    Arr.every(uses, (use) => isHandedOver(use, owners))
    ? imports
    : [];
}
