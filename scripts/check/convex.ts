import { Array as Arr, HashMap, HashSet, Option } from "effect";
import {
  type BindingElement,
  type Identifier,
  type ImportSpecifier,
  isArrowFunction,
  isAwaitExpression,
  isBindingElement,
  isBlock,
  isCallExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isImportSpecifier,
  isObjectLiteralExpression,
  isParameterDeclaration,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isReturnStatement,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
  isStringLiteral,
  isTypeAliasDeclaration,
  isTypeQueryNode,
  isTypeReferenceNode,
  isVariableDeclaration,
  isYieldExpression,
  type Node,
  type ParameterDeclaration,
  type TypeAliasDeclaration,
  type TypeQueryNode,
  type TypeReferenceNode,
  type VariableDeclaration,
} from "typescript/unstable/ast";
import type { Symbol as NativeSymbol } from "typescript/unstable/sync";
import { children } from "#scripts/check/source";

type Origin = "client" | HashMap.HashMap<string, Origin>;
/**
 * The native symbol each identifier of a module resolves to: one entry per
 * identifier, in the breadth-first order of `descendants`, and one more entry
 * after them for each shorthand property name, holding the symbol of the value
 * that the name reads. Entries match their node by reference, so a lookup never
 * hashes a compiler object's whole tree.
 */
export type Symbols = ReadonlyArray<readonly [Node, NativeSymbol | undefined]>;
const methods = HashSet.make("query", "mutation", "action", "run");
const callbacks = (node: Node) =>
  isArrowFunction(node) ||
  isFunctionExpression(node) ||
  isFunctionDeclaration(node);

/**
 * Returns the native symbol recorded for a node. When several entries name the
 * node, the last one wins, so a shorthand property overrides its name's entry.
 */
export function symbolAt(symbols: Symbols, node: Node) {
  return Option.getOrUndefined(
    Option.flatMap(
      Arr.findLast(symbols, ([key]) => key === node),
      ([, symbol]) => Option.fromNullishOr(symbol)
    )
  );
}

/** Returns the declaration a native symbol names, the last one recorded for it. */
function declarationOf(
  declarations: readonly (readonly [NativeSymbol, Node])[],
  symbol: NativeSymbol
) {
  return Option.getOrUndefined(
    Option.map(
      Arr.findLast(declarations, ([key]) => key.id === symbol.id),
      ([, node]) => node
    )
  );
}

/** Component fixtures expose real convex-test clients, not application adapters. */
const factories = HashMap.fromIterable<string, Origin>([
  ["convex-test:convexTest", "client"],
  ["convex-test:TestConvex", "client"],
  [
    "@repo/backend/confect/test.helpers:createConvexTestWithBetterAuth",
    "client",
  ],
  ["@repo/backend/test/polar:createWebhookTestConvex", "client"],
  [
    "@repo/backend/test/nina:createNinaTest",
    HashMap.fromIterable<string, Origin>([
      ["t", "client"],
      ["owner", "client"],
    ]),
  ],
  [
    "@repo/backend/test/nina/focus:createFocusTest",
    HashMap.fromIterable<string, Origin>([
      ["t", "client"],
      ["owner", "client"],
    ]),
  ],
  [
    "@repo/backend/test/forum/upload:createPendingUpload",
    HashMap.fromIterable<string, Origin>([
      ["t", "client"],
      ["owner", "client"],
    ]),
  ],
  [
    "@repo/backend/test/classes:createClassFixture",
    HashMap.fromIterable<string, Origin>([
      ["t", "client"],
      ["admin", "client"],
      ["student", "client"],
      ["outsider", "client"],
    ]),
  ],
  [
    "@repo/backend/test/onboarding:createOnboardingTest",
    HashMap.fromIterable<string, Origin>([
      ["test", "client"],
      ["authenticated", "client"],
    ]),
  ],
  [
    "@repo/backend/test/tryout/catalog:activateTryoutSetCatalog",
    HashMap.fromIterable<string, Origin>([
      ["t", "client"],
      ["authed", "client"],
    ]),
  ],
]);

function importedName(node: Node) {
  if (!isImportSpecifier(node)) {
    return;
  }
  const declaration = node.parent.parent.parent;
  if (
    !(
      isImportDeclaration(declaration) &&
      isStringLiteral(declaration.moduleSpecifier)
    )
  ) {
    return;
  }
  return `${declaration.moduleSpecifier.text}:${node.propertyName?.text ?? node.name.text}`;
}

function property(origin: Origin | undefined, key: string) {
  return origin && origin !== "client"
    ? Option.getOrUndefined(HashMap.get(origin, key))
    : undefined;
}

/** Resolve lexical client provenance through fixture construction and aliases. */
function resolver(nodes: readonly Node[], symbols: Symbols) {
  const declarations = Arr.flatMap(nodes, (node) => {
    if (
      !(
        isVariableDeclaration(node) ||
        isBindingElement(node) ||
        isImportSpecifier(node) ||
        isFunctionDeclaration(node) ||
        isParameterDeclaration(node) ||
        isTypeAliasDeclaration(node)
      )
    ) {
      return [];
    }
    const symbol =
      node.name && isIdentifier(node.name)
        ? symbolAt(symbols, node.name)
        : undefined;
    return symbol ? [[symbol, node] as const] : [];
  });

  function resolve(
    node: Node | undefined,
    seen: readonly Node[] = []
  ): Origin | undefined {
    if (!node || Arr.some(seen, (entry) => entry === node)) {
      return;
    }
    const next = Arr.append(seen, node);
    if (
      isAwaitExpression(node) ||
      isYieldExpression(node) ||
      isParenthesizedExpression(node)
    ) {
      return resolve(node.expression, next);
    }
    if (
      isIdentifier(node) ||
      isImportSpecifier(node) ||
      isVariableDeclaration(node) ||
      isBindingElement(node)
    ) {
      return resolveBinding(node, next);
    }
    if (
      isParameterDeclaration(node) ||
      isTypeAliasDeclaration(node) ||
      isTypeQueryNode(node) ||
      isTypeReferenceNode(node)
    ) {
      return resolveType(node, next);
    }
    if (isPropertyAccessExpression(node)) {
      return property(resolve(node.expression, next), node.name.text);
    }
    if (isCallExpression(node)) {
      return resolveCall(node, next);
    }
    if (isObjectLiteralExpression(node)) {
      return resolveObject(node, next);
    }
    if (callbacks(node)) {
      return resolveFunction(node, next);
    }
  }

  function resolveBinding(
    node: BindingElement | Identifier | ImportSpecifier | VariableDeclaration,
    next: readonly Node[]
  ): Origin | undefined {
    if (isIdentifier(node)) {
      const symbol = symbolAt(symbols, node);
      return symbol
        ? resolve(declarationOf(declarations, symbol), next)
        : undefined;
    }
    if (isImportSpecifier(node)) {
      return Option.getOrUndefined(
        HashMap.get(factories, importedName(node) ?? "")
      );
    }
    if (isVariableDeclaration(node)) {
      return resolve(node.initializer, next);
    }
    const owner = node.parent.parent;
    const name = node.propertyName ?? node.name;
    return isVariableDeclaration(owner) && name && isIdentifier(name)
      ? property(resolve(owner.initializer, next), name.text)
      : undefined;
  }

  function resolveType(
    node:
      | ParameterDeclaration
      | TypeAliasDeclaration
      | TypeQueryNode
      | TypeReferenceNode,
    next: readonly Node[]
  ): Origin | undefined {
    if (isParameterDeclaration(node) || isTypeAliasDeclaration(node)) {
      return resolve(node.type, next);
    }
    if (isTypeQueryNode(node)) {
      return resolve(node.exprName, next);
    }
    if (
      isIdentifier(node.typeName) &&
      ["Awaited", "ReturnType", "Pick"].includes(node.typeName.text)
    ) {
      return resolve(node.typeArguments?.[0], next);
    }
    return resolve(node.typeName, next);
  }

  function effectMember(node: Node) {
    if (!(isPropertyAccessExpression(node) && isIdentifier(node.expression))) {
      return;
    }
    const symbol = symbolAt(symbols, node.expression);
    const declaration = symbol
      ? declarationOf(declarations, symbol)
      : undefined;
    return declaration && importedName(declaration) === "effect:Effect"
      ? node.name.text
      : undefined;
  }

  function resolveCall(
    node: import("typescript/unstable/ast").CallExpression,
    next: readonly Node[]
  ): Origin | undefined {
    const method = effectMember(node.expression);
    if (method === "promise" || method === "sync") {
      return resolve(node.arguments[0], next);
    }
    if (
      isCallExpression(node.expression) &&
      effectMember(node.expression.expression) === "fn"
    ) {
      return resolve(node.arguments[0], next);
    }
    if (
      isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "withIdentity"
    ) {
      return resolve(node.expression.expression, next) === "client"
        ? "client"
        : undefined;
    }
    return resolve(node.expression, next);
  }

  function resolveObject(
    node: import("typescript/unstable/ast").ObjectLiteralExpression,
    next: readonly Node[]
  ): Origin {
    return HashMap.fromIterable(
      Arr.flatMap(node.properties, (field) => {
        if (isSpreadAssignment(field)) {
          const spread = resolve(field.expression, next);
          return spread && spread !== "client" ? Arr.fromIterable(spread) : [];
        }
        return Arr.fromNullishOr(resolveField(field, next));
      })
    );
  }

  function resolveField(
    field: Node,
    next: readonly Node[]
  ): [string, Origin] | undefined {
    if (
      !(
        (isPropertyAssignment(field) || isShorthandPropertyAssignment(field)) &&
        isIdentifier(field.name)
      )
    ) {
      return;
    }
    const value = resolve(
      isPropertyAssignment(field) ? field.initializer : field.name,
      next
    );
    return value ? [field.name.text, value] : undefined;
  }

  function resolveFunction(
    node:
      | import("typescript/unstable/ast").ArrowFunction
      | import("typescript/unstable/ast").FunctionExpression
      | import("typescript/unstable/ast").FunctionDeclaration,
    next: readonly Node[]
  ): Origin | undefined {
    const body = node.body;
    if (!body) {
      return;
    }
    /** Returns the expressions a statement returns, outside nested callbacks. */
    const returned = (child: Node): Node[] => {
      if (callbacks(child)) {
        return [];
      }
      return isReturnStatement(child) && child.expression
        ? [child.expression]
        : Arr.flatMap(children(child), returned);
    };
    if (isArrowFunction(node) && !isBlock(body)) {
      return resolve(body, next);
    }
    const returns = Arr.flatMap(children(body), returned);
    if (returns.length !== 1) {
      return;
    }
    return resolve(returns[0], next);
  }
  return resolve;
}

/** A Promise runner is legal only where the SDK owns a transaction callback. */
export function convexTestBoundary(
  runner: Node,
  nodes: readonly Node[],
  symbols: Symbols
) {
  if (
    !(
      isPropertyAccessExpression(runner) &&
      ["runPromise", "runPromiseWith"].includes(runner.name.text)
    )
  ) {
    return false;
  }
  let invocation = runner.parent;
  if (!isCallExpression(invocation)) {
    return false;
  }
  if (runner.name.text === "runPromiseWith") {
    invocation = invocation.parent;
    if (!isCallExpression(invocation)) {
      return false;
    }
  }
  let callback: Node | undefined = invocation.parent;
  while (callback && !callbacks(callback)) {
    callback = callback.parent;
  }
  if (!(callback && callbacks(callback))) {
    return false;
  }
  const call = callback.parent;
  if (
    !isCallExpression(call) ||
    call.arguments[0] !== callback ||
    !isPropertyAccessExpression(call.expression) ||
    !HashSet.has(methods, call.expression.name.text)
  ) {
    return false;
  }
  const parameter = callback.parameters[0];
  const context =
    parameter && isIdentifier(parameter.name)
      ? symbolAt(symbols, parameter.name)
      : undefined;
  if (!context) {
    return false;
  }
  let usesContext = false;
  const inspect = (node: Node): void => {
    if (isIdentifier(node) && symbolAt(symbols, node) === context) {
      usesContext = true;
    }
    node.forEachChild(inspect);
  };
  invocation.forEachChild(inspect);
  return (
    usesContext &&
    resolver(nodes, symbols)(call.expression.expression) === "client"
  );
}
