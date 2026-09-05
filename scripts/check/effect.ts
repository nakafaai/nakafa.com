import getEffectPath from "@effect/tsgo/lib/getExePath";
import { Effect, Schema } from "effect";
import * as ts from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API, type Symbol as NativeSymbol } from "typescript/unstable/sync";

export const EffectTestSource = Schema.Struct({
  file: Schema.String,
  sourceText: Schema.String,
});

export class TestCompilerError extends Schema.TaggedError<TestCompilerError>()(
  "TestCompilerError",
  { cause: Schema.Unknown, message: Schema.String }
) {}

const TEST_MODULE_PATTERN = /\.test\.ts$/u;
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
  readonly symbols: ReadonlyMap<ts.Node, NativeSymbol | undefined>;
}

/** Returns value-position descendants while excluding type-only subtrees. */
function descendants(sourceFile: ts.SourceFile) {
  const nodes: ts.Node[] = [sourceFile];
  for (const node of nodes) {
    if (ts.isTypeNode(node)) {
      continue;
    }
    node.forEachChild((child) => {
      nodes.push(child);
    });
  }
  return nodes;
}

function importedModule(node: ts.Node) {
  if (
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    const [specifier] = node.arguments;
    return specifier !== undefined && ts.isStringLiteralLikeNode(specifier)
      ? specifier.text
      : undefined;
  }
}

function staticProperty(node: ts.Node | undefined) {
  return node !== undefined &&
    (ts.isIdentifier(node) || ts.isStringLiteralLikeNode(node))
    ? node.text
    : undefined;
}

function staticElement(node: ts.Expression) {
  return ts.isStringLiteralLikeNode(node) || ts.isNumericLiteral(node)
    ? node.text
    : undefined;
}

function importedRuntimeKind(node: ts.Node): RuntimeKind | undefined {
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
  nodes: readonly ts.Node[],
  symbols: RuntimeImports["symbols"]
): RuntimeImports {
  const bindings = new Map<NativeSymbol, RuntimeKind>();
  let directRunner = false;

  for (const node of nodes) {
    if (!ts.isImportDeclaration(node)) {
      continue;
    }
    const kind = importedRuntimeKind(node);
    const clause = node.importClause;
    const namedBindings = clause?.namedBindings;
    if (
      kind === undefined ||
      clause === undefined ||
      clause.phaseModifier === ts.SyntaxKind.TypeKeyword ||
      namedBindings === undefined
    ) {
      continue;
    }
    const candidates = ts.isNamespaceImport(namedBindings)
      ? [{ name: namedBindings.name, kind, runner: false }]
      : namedBindings.elements
          .filter((binding) => !binding.isTypeOnly)
          .map((binding) => {
            const name = binding.propertyName?.text ?? binding.name.text;
            return {
              name: binding.name,
              kind: runtimeMemberKind(kind, name),
              runner: kind === "effect" && EFFECT_RUNNERS.has(name),
            };
          });
    for (const candidate of candidates) {
      const symbol = symbols.get(candidate.name);
      if (symbol === undefined) {
        continue;
      }
      if (candidate.kind !== undefined) {
        bindings.set(symbol, candidate.kind);
      }
      directRunner ||= candidate.runner;
    }
  }

  return { bindings, symbols, directRunner };
}

/** Resolves an imported Effect module, factory, or runtime expression. */
function runtimeKind(
  node: ts.Node,
  imports: RuntimeImports
): RuntimeKind | undefined {
  if (ts.isAwaitExpression(node)) {
    return runtimeKind(node.expression, imports);
  }
  if (ts.isIdentifier(node)) {
    const symbol = imports.symbols.get(node);
    return symbol === undefined ? undefined : imports.bindings.get(symbol);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    const member = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : staticElement(node.argumentExpression);
    return runtimeMemberKind(runtimeKind(node.expression, imports), member);
  }
  if (!ts.isCallExpression(node)) {
    return undefined;
  }
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
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
  pattern: ts.ObjectBindingPattern,
  owner: RuntimeKind,
  imports: RuntimeImports
) {
  let changed = false;
  for (const element of pattern.elements) {
    if (element.name === undefined || !ts.isIdentifier(element.name)) {
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
  declaration: ts.VariableDeclaration,
  imports: RuntimeImports
) {
  if (declaration.initializer === undefined) {
    return false;
  }
  const kind = runtimeKind(declaration.initializer, imports);
  if (ts.isObjectBindingPattern(declaration.name)) {
    return (
      kind !== undefined &&
      collectMemberBindings(declaration.name, kind, imports)
    );
  }
  const symbol = ts.isIdentifier(declaration.name)
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
function collectAliases(nodes: readonly ts.Node[], imports: RuntimeImports) {
  let changed = true;
  while (changed) {
    changed = nodes.some(
      (node) =>
        ts.isVariableDeclaration(node) && collectVariableAlias(node, imports)
    );
  }
}

function runtimeRunners(node: ts.Node, imports: RuntimeImports) {
  const kind = runtimeKind(node, imports);
  if (kind === "effect") {
    return EFFECT_RUNNERS;
  }
  return kind === "managed-runtime" ? MANAGED_RUNTIME_RUNNERS : undefined;
}

function isRunnerMember(node: ts.Node, imports: RuntimeImports) {
  if (
    !(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
  ) {
    return false;
  }
  const runners = runtimeRunners(node.expression, imports);
  if (runners === undefined) {
    return false;
  }
  const member = ts.isPropertyAccessExpression(node)
    ? node.name.text
    : staticElement(node.argumentExpression);
  return member === undefined || runners.has(member);
}

/** Tests whether one destructuring pattern extracts a runtime runner. */
function destructuresRunner(node: ts.Node, imports: RuntimeImports) {
  if (
    !(ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) ||
    node.initializer === undefined
  ) {
    return false;
  }
  const runners = runtimeRunners(node.initializer, imports);
  return (
    runners !== undefined &&
    node.name.elements.some((element) =>
      runners.has(staticProperty(element.propertyName ?? element.name) ?? "")
    )
  );
}

/** Keeps each test in its own native project so lexical bindings stay local. */
const inspectTest = Effect.fn("RepositoryPolicy.inspectEffectTest")(function* (
  api: API,
  index: number,
  file: string
) {
  const configFile = `/test-policy/${index}/tsconfig.json`;
  const compilerFailure = (cause: unknown) =>
    new TestCompilerError({ cause, message: `Unable to inspect ${file}.` });
  const snapshot = yield* Effect.acquireRelease(
    Effect.try({
      try: () =>
        api.updateSnapshot({
          openProjects: [configFile],
          closeProjects:
            index === 0 ? [] : [`/test-policy/${index - 1}/tsconfig.json`],
        }),
      catch: compilerFailure,
    }),
    (resource) => Effect.sync(() => resource.dispose())
  );
  const { project, sourceFile } = yield* Effect.try({
    try: () => {
      const project = snapshot.getProject(configFile);
      return {
        project,
        sourceFile: project?.program.getSourceFile(
          `/test-policy/${index}/case.test.ts`
        ),
      };
    },
    catch: compilerFailure,
  });
  if (project === undefined || sourceFile === undefined) {
    return yield* compilerFailure("The native test project is missing.");
  }
  return yield* Effect.try({
    try: () => {
      const nodes = descendants(sourceFile);
      const identifiers = nodes.filter(ts.isIdentifier);
      const symbols = project.checker.getSymbolAtLocation(identifiers);
      const imports = runtimeImports(
        nodes,
        new Map(identifiers.map((node, offset) => [node, symbols[offset]]))
      );
      collectAliases(nodes, imports);
      const hasRunner =
        imports.directRunner ||
        nodes.some(
          (node) =>
            isRunnerMember(node, imports) || destructuresRunner(node, imports)
        );
      return hasRunner
        ? [
            `${file}: return the Effect to @effect/vitest instead of running it.`,
          ]
        : [];
    },
    catch: compilerFailure,
  });
}, Effect.scoped);

/** Reports authored tests using one scoped, Effect-patched native compiler. */
export const effectTestViolations = Effect.fn("RepositoryPolicy.effectTests")(
  function* (sources: readonly (typeof EffectTestSource.Type)[]) {
    const tests = sources.filter(({ file }) => TEST_MODULE_PATTERN.test(file));
    if (tests.length === 0) {
      return [];
    }
    const files = Object.fromEntries(
      tests.flatMap(({ sourceText }, index) => [
        [`/test-policy/${index}/case.test.ts`, sourceText],
        [
          `/test-policy/${index}/tsconfig.json`,
          JSON.stringify({
            compilerOptions: { noLib: true, noResolve: true },
            files: ["case.test.ts"],
          }),
        ],
      ])
    );
    const api = yield* Effect.acquireRelease(
      Effect.try({
        try: () =>
          new API({
            cwd: "/",
            fs: createVirtualFileSystem(files),
            tsserverPath: getEffectPath(),
          }),
        catch: (cause) =>
          new TestCompilerError({
            cause,
            message: "Unable to start the native test compiler.",
          }),
      }),
      (resource) => Effect.sync(() => resource.close())
    );
    return (yield* Effect.forEach(
      tests,
      ({ file }, index) => inspectTest(api, index, file),
      { concurrency: 1 }
    )).flat();
  },
  Effect.scoped
);
