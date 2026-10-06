import { Array as Arr, pipe } from "effect";
import {
  type Expression,
  isAwaitExpression,
  isCallExpression,
  isElementAccessExpression,
  isIdentifier,
  isImportDeclaration,
  isNamespaceImport,
  isNumericLiteral,
  isObjectBindingPattern,
  isPropertyAccessExpression,
  isStringLiteral,
  isStringLiteralLikeNode,
  isVariableDeclaration,
  type Node,
  type ObjectBindingPattern,
  SyntaxKind,
  type VariableDeclaration,
} from "typescript/unstable/ast";
import type { Symbol as NativeSymbol } from "typescript/unstable/sync";
import { convexTestBoundary } from "#scripts/check/convex";

const EFFECT_RUNNERS = new Set(
  "runCallback runCallbackWith runFork runForkWith runPromise runPromiseExit runPromiseExitWith runPromiseWith runSync runSyncExit runSyncExitWith runSyncWith".split(
    " "
  )
);
const MANAGED_RUNTIME_RUNNERS = new Set(
  "runCallback runFork runPromise runPromiseExit runSync runSyncExit".split(" ")
);

type RuntimeKind =
  | "effect"
  | "managed-make"
  | "managed-module"
  | "managed-runtime"
  | "root";

interface RuntimeImports {
  readonly bindings: Map<NativeSymbol, RuntimeKind>;
  readonly directRunner: boolean;
  readonly symbols: ReadonlyMap<Node, NativeSymbol | undefined>;
}

function importedModule(node: Node) {
  if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text;
  }
  if (
    isCallExpression(node) &&
    node.expression.kind === SyntaxKind.ImportKeyword
  ) {
    const [specifier] = node.arguments;
    return specifier !== undefined && isStringLiteralLikeNode(specifier)
      ? specifier.text
      : undefined;
  }
}

function staticProperty(node: Node | undefined) {
  return node !== undefined &&
    (isIdentifier(node) || isStringLiteralLikeNode(node))
    ? node.text
    : undefined;
}

function staticElement(node: Expression) {
  return isStringLiteralLikeNode(node) || isNumericLiteral(node)
    ? node.text
    : undefined;
}

function importedRuntimeKind(node: Node): RuntimeKind | undefined {
  switch (importedModule(node)) {
    case "effect":
      return "root";
    case "effect/Effect":
      return "effect";
    case "effect/ManagedRuntime":
      return "managed-module";
    default:
      return undefined;
  }
}

/** Collects local bindings that expose Effect runtime modules. */
function runtimeImports(
  nodes: readonly Node[],
  symbols: RuntimeImports["symbols"]
): RuntimeImports {
  const bindings = new Map<NativeSymbol, RuntimeKind>();
  let directRunner = false;

  for (const node of nodes) {
    if (!isImportDeclaration(node)) {
      continue;
    }
    const kind = importedRuntimeKind(node);
    const clause = node.importClause;
    const namedBindings = clause?.namedBindings;
    if (
      kind === undefined ||
      clause === undefined ||
      clause.phaseModifier === SyntaxKind.TypeKeyword ||
      namedBindings === undefined
    ) {
      continue;
    }
    const candidates = isNamespaceImport(namedBindings)
      ? [{ name: namedBindings.name, kind, runner: false }]
      : pipe(
          namedBindings.elements,
          Arr.filter((binding) => !binding.isTypeOnly),
          Arr.map((binding) => {
            const name = binding.propertyName?.text ?? binding.name.text;
            return {
              name: binding.name,
              kind: runtimeMemberKind(kind, name),
              runner: kind === "effect" && EFFECT_RUNNERS.has(name),
            };
          })
        );
    for (const candidate of candidates) {
      const symbol = symbols.get(candidate.name);
      if (candidate.kind !== undefined && symbol !== undefined) {
        bindings.set(symbol, candidate.kind);
      }
      directRunner ||= candidate.runner;
    }
  }

  return { bindings, symbols, directRunner };
}

/** Resolves an imported Effect module, factory, or runtime expression. */
function runtimeKind(
  node: Node,
  imports: RuntimeImports
): RuntimeKind | undefined {
  if (isAwaitExpression(node)) {
    return runtimeKind(node.expression, imports);
  }
  if (isIdentifier(node)) {
    const symbol = imports.symbols.get(node);
    return symbol === undefined ? undefined : imports.bindings.get(symbol);
  }
  if (isPropertyAccessExpression(node) || isElementAccessExpression(node)) {
    const member = isPropertyAccessExpression(node)
      ? node.name.text
      : staticElement(node.argumentExpression);
    return runtimeMemberKind(runtimeKind(node.expression, imports), member);
  }
  if (!isCallExpression(node)) {
    return undefined;
  }
  if (node.expression.kind === SyntaxKind.ImportKeyword) {
    return importedRuntimeKind(node);
  }
  return runtimeKind(node.expression, imports) === "managed-make"
    ? "managed-runtime"
    : undefined;
}

function runtimeMemberKind(
  owner: RuntimeKind | undefined,
  member: string | undefined
): RuntimeKind | undefined {
  if (owner === "root" && member === "Effect") {
    return "effect";
  }
  if (owner === "root" && member === "ManagedRuntime") {
    return "managed-module";
  }
  return owner === "managed-module" && member === "make"
    ? "managed-make"
    : undefined;
}

function collectMemberBindings(
  pattern: ObjectBindingPattern,
  owner: RuntimeKind,
  imports: RuntimeImports
) {
  let changed = false;
  for (const element of pattern.elements) {
    if (element.name === undefined || !isIdentifier(element.name)) {
      continue;
    }
    const member = staticProperty(element.propertyName ?? element.name);
    const kind = runtimeMemberKind(owner, member);
    const symbol = imports.symbols.get(element.name);
    if (
      kind !== undefined &&
      symbol !== undefined &&
      !imports.bindings.has(symbol)
    ) {
      imports.bindings.set(symbol, kind);
      changed = true;
    }
  }
  return changed;
}

function collectVariableAlias(
  declaration: VariableDeclaration,
  imports: RuntimeImports
) {
  if (declaration.initializer === undefined) {
    return false;
  }
  const kind = runtimeKind(declaration.initializer, imports);
  if (isObjectBindingPattern(declaration.name)) {
    return (
      kind !== undefined &&
      collectMemberBindings(declaration.name, kind, imports)
    );
  }
  const symbol = isIdentifier(declaration.name)
    ? imports.symbols.get(declaration.name)
    : undefined;
  if (
    kind === undefined ||
    symbol === undefined ||
    imports.bindings.has(symbol)
  ) {
    return false;
  }
  imports.bindings.set(symbol, kind);
  return true;
}

/** Extends imported runtime bindings through direct local aliases. */
function collectAliases(nodes: readonly Node[], imports: RuntimeImports) {
  let changed = true;
  while (changed) {
    changed = Arr.some(
      nodes,
      (node) =>
        isVariableDeclaration(node) && collectVariableAlias(node, imports)
    );
  }
}

function runtimeRunners(node: Node, imports: RuntimeImports) {
  const kind = runtimeKind(node, imports);
  if (kind === "effect") {
    return EFFECT_RUNNERS;
  }
  return kind === "managed-runtime" ? MANAGED_RUNTIME_RUNNERS : undefined;
}

function isRunnerMember(node: Node, imports: RuntimeImports) {
  if (!(isPropertyAccessExpression(node) || isElementAccessExpression(node))) {
    return false;
  }
  const runners = runtimeRunners(node.expression, imports);
  if (runners === undefined) {
    return false;
  }
  const member = isPropertyAccessExpression(node)
    ? node.name.text
    : staticElement(node.argumentExpression);
  return member === undefined || runners.has(member);
}

/**
 * Tests whether one destructuring pattern can extract a runtime runner.
 *
 * Rest elements and computed keys can expose any member, so they fail closed
 * like element access with a dynamic key.
 */
function destructuresRunner(node: Node, imports: RuntimeImports) {
  if (
    !(isVariableDeclaration(node) && isObjectBindingPattern(node.name)) ||
    node.initializer === undefined
  ) {
    return false;
  }
  const runners = runtimeRunners(node.initializer, imports);
  return (
    runners !== undefined &&
    Arr.some(node.name.elements, (element) => {
      const member = staticProperty(element.propertyName ?? element.name);
      return (
        element.dotDotDotToken !== undefined ||
        member === undefined ||
        runners.has(member)
      );
    })
  );
}

/** Detect runtime execution, preserving only SDK-owned transaction callbacks. */
export function effectRunnerViolation(
  nodes: readonly Node[],
  symbols: RuntimeImports["symbols"]
) {
  const imports = runtimeImports(nodes, symbols);
  collectAliases(nodes, imports);
  return (
    imports.directRunner ||
    Arr.some(
      nodes,
      (node) =>
        (isRunnerMember(node, imports) &&
          !convexTestBoundary(node, nodes, symbols)) ||
        destructuresRunner(node, imports)
    )
  );
}
