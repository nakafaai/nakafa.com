import ts from "typescript";

const TEST_MODULE_PATTERN = /\.test\.ts$/u;
const EFFECT_RUNNERS = new Set(
  "runCallback runCallbackWith runFork runForkWith runPromise runPromiseExit runPromiseExitWith runPromiseWith runSync runSyncExit runSyncExitWith runSyncWith".split(
    " "
  )
);
const MANAGED_RUNTIME_RUNNERS = new Set(
  "runCallback runFork runPromise runPromiseExit runSync runSyncExit".split(" ")
);

type RuntimeKind = "effect" | "managed-factory" | "managed-runtime" | "root";

interface RuntimeImports {
  readonly bindings: Map<ts.Symbol, RuntimeKind>;
  readonly checker: ts.TypeChecker;
  readonly directRunner: boolean;
}

interface ParsedTestModule {
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
}

/** Parses one test with enough binding information to resolve lexical scope. */
function parseTestModule(file: string, sourceText: string): ParsedTestModule {
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );
  const host: ts.CompilerHost = {
    fileExists: (candidate) => candidate === file,
    getCanonicalFileName: (candidate) => candidate,
    getCurrentDirectory: () => "",
    getDefaultLibFileName: () => "",
    getNewLine: () => "\n",
    getSourceFile: (candidate) => (candidate === file ? sourceFile : undefined),
    readFile: (candidate) => (candidate === file ? sourceText : undefined),
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined,
  };
  const program = ts.createProgram({
    host,
    options: { noLib: true, noResolve: true },
    rootNames: [file],
  });
  return { checker: program.getTypeChecker(), sourceFile };
}

/** Returns value-position descendants while excluding type-only subtrees. */
function descendants(sourceFile: ts.SourceFile) {
  const nodes: ts.Node[] = [sourceFile];
  for (const node of nodes) {
    if (ts.isTypeNode(node)) {
      continue;
    }
    ts.forEachChild(node, (child) => {
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
    return specifier !== undefined && ts.isStringLiteralLike(specifier)
      ? specifier.text
      : undefined;
  }
}

function staticProperty(node: ts.Node | undefined) {
  return node !== undefined &&
    (ts.isIdentifier(node) || ts.isStringLiteralLike(node))
    ? node.text
    : undefined;
}

function staticElement(node: ts.Expression) {
  return ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)
    ? node.text
    : undefined;
}

/** Collects local bindings that expose Effect runtime modules. */
function runtimeImports(
  nodes: readonly ts.Node[],
  checker: ts.TypeChecker
): RuntimeImports {
  const bindings = new Map<ts.Symbol, RuntimeKind>();
  let directRunner = false;

  for (const node of nodes) {
    const moduleName = importedModule(node);
    if (
      moduleName !== "effect" &&
      moduleName !== "effect/Effect" &&
      moduleName !== "effect/ManagedRuntime"
    ) {
      continue;
    }
    if (!ts.isImportDeclaration(node)) {
      continue;
    }

    const clause = node.importClause;
    const namedBindings = clause?.namedBindings;
    if (clause?.isTypeOnly !== false || namedBindings === undefined) {
      continue;
    }
    if (ts.isNamespaceImport(namedBindings)) {
      const symbol = checker.getSymbolAtLocation(namedBindings.name);
      if (symbol === undefined) {
        continue;
      }
      if (moduleName === "effect") {
        bindings.set(symbol, "root");
      } else {
        bindings.set(
          symbol,
          moduleName === "effect/Effect" ? "effect" : "managed-factory"
        );
      }
      continue;
    }

    for (const binding of namedBindings.elements) {
      if (binding.isTypeOnly) {
        continue;
      }
      const importedName = binding.propertyName?.text ?? binding.name.text;
      const symbol = checker.getSymbolAtLocation(binding.name);
      if (symbol === undefined) {
        continue;
      }
      if (moduleName === "effect") {
        if (importedName === "Effect") {
          bindings.set(symbol, "effect");
        } else if (importedName === "ManagedRuntime") {
          bindings.set(symbol, "managed-factory");
        }
      } else if (moduleName === "effect/Effect") {
        directRunner ||= EFFECT_RUNNERS.has(importedName);
      }
    }
  }

  return { bindings, checker, directRunner };
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
    const symbol = imports.checker.getSymbolAtLocation(node);
    return symbol === undefined ? undefined : imports.bindings.get(symbol);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    const member = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : staticElement(node.argumentExpression);
    if (runtimeKind(node.expression, imports) === "root") {
      if (member === "Effect") {
        return "effect";
      }
      if (member === "ManagedRuntime") {
        return "managed-factory";
      }
    }
    return undefined;
  }
  if (!ts.isCallExpression(node)) {
    return undefined;
  }
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const moduleName = importedModule(node);
    if (moduleName === "effect") {
      return "root";
    }
    if (moduleName === "effect/Effect") {
      return "effect";
    }
    return moduleName === "effect/ManagedRuntime"
      ? "managed-factory"
      : undefined;
  }
  const callee = node.expression;
  if (
    (ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)) &&
    runtimeKind(callee.expression, imports) === "managed-factory"
  ) {
    const member = ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : staticElement(callee.argumentExpression);
    return member === "make" ? "managed-runtime" : undefined;
  }
}

function rootMemberKind(member: string | undefined): RuntimeKind | undefined {
  if (member === "Effect") {
    return "effect";
  }
  return member === "ManagedRuntime" ? "managed-factory" : undefined;
}

function collectRootBindings(
  pattern: ts.ObjectBindingPattern,
  imports: RuntimeImports
) {
  let changed = false;
  for (const element of pattern.elements) {
    if (!ts.isIdentifier(element.name)) {
      continue;
    }
    const member = staticProperty(element.propertyName ?? element.name);
    const kind = rootMemberKind(member);
    const symbol = imports.checker.getSymbolAtLocation(element.name);
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
    return kind === "root" && collectRootBindings(declaration.name, imports);
  }
  const symbol = ts.isIdentifier(declaration.name)
    ? imports.checker.getSymbolAtLocation(declaration.name)
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

/** Reports authored tests that manually run an Effect runtime. */
export function effectTestViolations(file: string, sourceText: string) {
  if (!TEST_MODULE_PATTERN.test(file)) {
    return [];
  }
  const { checker, sourceFile } = parseTestModule(file, sourceText);
  const nodes = descendants(sourceFile);
  const imports = runtimeImports(nodes, checker);
  collectAliases(nodes, imports);
  const hasRunner =
    imports.directRunner ||
    nodes.some(
      (node) =>
        isRunnerMember(node, imports) || destructuresRunner(node, imports)
    );

  return hasRunner
    ? [`${file}: return the Effect to @effect/vitest instead of running it.`]
    : [];
}
