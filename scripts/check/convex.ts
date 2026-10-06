import { Array as Arr } from "effect";
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

type Origin = "client" | ReadonlyMap<string, Origin>;
type Symbols = ReadonlyMap<Node, NativeSymbol | undefined>;
const methods = new Set(["query", "mutation", "action", "run"]);
const callbacks = (node: Node) =>
  isArrowFunction(node) ||
  isFunctionExpression(node) ||
  isFunctionDeclaration(node);

/** Component fixtures expose real convex-test clients, not application adapters. */
const factories = new Map<string, Origin>([
  ["convex-test:convexTest", "client"],
  ["convex-test:TestConvex", "client"],
  [
    "@repo/backend/confect/test.helpers:createConvexTestWithBetterAuth",
    "client",
  ],
  ["@repo/backend/test/polar:createWebhookTestConvex", "client"],
  [
    "@repo/backend/test/nina:createNinaTest",
    new Map([
      ["t", "client"],
      ["owner", "client"],
    ]),
  ],
  [
    "@repo/backend/test/nina/focus:createFocusTest",
    new Map([
      ["t", "client"],
      ["owner", "client"],
    ]),
  ],
  [
    "@repo/backend/test/forum/upload:createPendingUpload",
    new Map([
      ["t", "client"],
      ["owner", "client"],
    ]),
  ],
  [
    "@repo/backend/test/classes:createClassFixture",
    new Map([
      ["t", "client"],
      ["admin", "client"],
      ["student", "client"],
      ["outsider", "client"],
    ]),
  ],
  [
    "@repo/backend/test/onboarding:createOnboardingTest",
    new Map([
      ["test", "client"],
      ["authenticated", "client"],
    ]),
  ],
  [
    "@repo/backend/test/tryout/catalog:activateTryoutSetCatalog",
    new Map([
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
  return origin && origin !== "client" ? origin.get(key) : undefined;
}

/** Resolve lexical client provenance through fixture construction and aliases. */
function resolver(nodes: readonly Node[], symbols: Symbols) {
  const declarations = new Map<NativeSymbol, Node>();
  for (const node of nodes) {
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
      continue;
    }
    const symbol =
      node.name && isIdentifier(node.name) ? symbols.get(node.name) : undefined;
    if (symbol) {
      declarations.set(symbol, node);
    }
  }

  function resolve(
    node: Node | undefined,
    seen: ReadonlySet<Node> = new Set()
  ): Origin | undefined {
    if (!node || seen.has(node)) {
      return;
    }
    const next = new Set(seen).add(node);
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
    next: ReadonlySet<Node>
  ): Origin | undefined {
    if (isIdentifier(node)) {
      const symbol = symbols.get(node);
      return symbol ? resolve(declarations.get(symbol), next) : undefined;
    }
    if (isImportSpecifier(node)) {
      return factories.get(importedName(node) ?? "");
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
    next: ReadonlySet<Node>
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
    const symbol = symbols.get(node.expression);
    const declaration = symbol ? declarations.get(symbol) : undefined;
    return declaration && importedName(declaration) === "effect:Effect"
      ? node.name.text
      : undefined;
  }

  function resolveCall(
    node: import("typescript/unstable/ast").CallExpression,
    next: ReadonlySet<Node>
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
    next: ReadonlySet<Node>
  ): Origin {
    const fields = new Map<string, Origin>();
    for (const field of node.properties) {
      if (isSpreadAssignment(field)) {
        const spread = resolve(field.expression, next);
        if (spread && spread !== "client") {
          for (const [key, value] of spread) {
            fields.set(key, value);
          }
        }
        continue;
      }
      const entry = resolveField(field, next);
      if (entry) {
        fields.set(...entry);
      }
    }
    return fields;
  }

  function resolveField(
    field: Node,
    next: ReadonlySet<Node>
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
    next: ReadonlySet<Node>
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
    !methods.has(call.expression.name.text)
  ) {
    return false;
  }
  const parameter = callback.parameters[0];
  const context =
    parameter && isIdentifier(parameter.name)
      ? symbols.get(parameter.name)
      : undefined;
  if (!context) {
    return false;
  }
  let usesContext = false;
  const inspect = (node: Node): void => {
    if (isIdentifier(node) && symbols.get(node) === context) {
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
