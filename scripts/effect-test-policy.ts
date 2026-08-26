import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNamespaceImport,
  isPropertyAccessExpression,
  isStringLiteral,
  type Node,
  ScriptKind,
  ScriptTarget,
  type SourceFile,
} from "typescript";

export const EFFECT_TEST_ADAPTER = "@repo/testing/effect";

const EFFECT_MODULES = new Set(["effect", "effect/Effect"]);
const DIRECT_EFFECT_RUNNERS = new Set([
  "runCallback",
  "runCallbackWith",
  "runFork",
  "runForkWith",
  "runPromise",
  "runPromiseExit",
  "runPromiseExitWith",
  "runPromiseWith",
  "runSync",
  "runSyncExit",
  "runSyncExitWith",
  "runSyncWith",
]);
const EFFECT_TEST_RUNNER_MIGRATION_BASELINE = new Set([
  "apps/www/components/shared/open-content/copy.test.ts",
  "packages/backend/convex/contentRelease/program/context.test.ts",
  "packages/backend/convex/contentRelease/program/route.test.ts",
  "packages/backend/convex/contentRelease/runtime/public/dispatch.test.ts",
  "packages/design-system/lib/theme/contract.test.ts",
]);

export interface TestSource {
  readonly path: string;
  readonly source: string;
}

export interface EffectTestRunnerPolicyProblems {
  readonly resolvedBaselineFiles: readonly string[];
  readonly unexpectedRunnerFiles: readonly string[];
}

/** Returns the string module specifier for one static import. */
function importSource(statement: SourceFile["statements"][number]) {
  if (
    !(
      isImportDeclaration(statement) &&
      isStringLiteral(statement.moduleSpecifier)
    )
  ) {
    return;
  }
  return statement.moduleSpecifier.text;
}

/** Detects the shared Effect Vitest adapter in one parsed test module. */
function importsEffectTestAdapter(sourceFile: SourceFile) {
  return sourceFile.statements.some(
    (statement) => importSource(statement) === EFFECT_TEST_ADAPTER
  );
}

/** Collects local names that can invoke an Effect runtime directly. */
function readEffectRunnerBindings(sourceFile: SourceFile) {
  const directRunners = new Set<string>();
  const effectNamespaces = new Set<string>();

  for (const statement of sourceFile.statements) {
    const moduleName = importSource(statement);
    if (!(moduleName && EFFECT_MODULES.has(moduleName))) {
      continue;
    }
    if (!isImportDeclaration(statement)) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) {
      continue;
    }
    if (isNamespaceImport(bindings)) {
      effectNamespaces.add(bindings.name.text);
      continue;
    }
    if (!isNamedImports(bindings)) {
      continue;
    }

    for (const binding of bindings.elements) {
      const importedName = binding.propertyName?.text ?? binding.name.text;
      if (moduleName === "effect" && importedName === "Effect") {
        effectNamespaces.add(binding.name.text);
      }
      if (
        moduleName === "effect/Effect" &&
        DIRECT_EFFECT_RUNNERS.has(importedName)
      ) {
        directRunners.add(binding.name.text);
      }
    }
  }

  return { directRunners, effectNamespaces };
}

/** Detects a direct Effect runner call without matching comments or strings. */
function callsDirectEffectRunner(sourceFile: SourceFile) {
  const { directRunners, effectNamespaces } =
    readEffectRunnerBindings(sourceFile);
  let found = false;

  const visit = (node: Node) => {
    if (found) {
      return;
    }
    if (isCallExpression(node)) {
      const expression = node.expression;
      if (isIdentifier(expression) && directRunners.has(expression.text)) {
        found = true;
        return;
      }
      if (
        isPropertyAccessExpression(expression) &&
        isIdentifier(expression.expression) &&
        effectNamespaces.has(expression.expression.text) &&
        DIRECT_EFFECT_RUNNERS.has(expression.name.text)
      ) {
        found = true;
        return;
      }
    }
    forEachChild(node, visit);
  };

  forEachChild(sourceFile, visit);
  return found;
}

/** Finds adapter imports that still hide direct Effect test runners. */
export function inspectEffectTestRunnerPolicy(
  tests: readonly TestSource[],
  migrationBaseline: ReadonlySet<string> = EFFECT_TEST_RUNNER_MIGRATION_BASELINE
): EffectTestRunnerPolicyProblems {
  const runnerFiles = new Set(
    tests.flatMap((test) => {
      const sourceFile = createSourceFile(
        test.path,
        test.source,
        ScriptTarget.Latest,
        true,
        ScriptKind.TS
      );
      if (
        !(
          importsEffectTestAdapter(sourceFile) &&
          callsDirectEffectRunner(sourceFile)
        )
      ) {
        return [];
      }
      return [test.path];
    })
  );

  return {
    resolvedBaselineFiles: [...migrationBaseline]
      .filter((file) => !runnerFiles.has(file))
      .sort(),
    unexpectedRunnerFiles: [...runnerFiles]
      .filter((file) => !migrationBaseline.has(file))
      .sort(),
  };
}
