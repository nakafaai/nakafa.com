import { Effect } from "effect";
import {
  isBinaryExpression,
  isIdentifier,
  isShorthandPropertyAssignment,
  isStringLiteralLikeNode,
  isTryStatement,
  isTypeOfExpression,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import type { API } from "typescript/unstable/sync";
import { effectRunnerViolation } from "#scripts/check/runtime";
import {
  descendants,
  openCompiler,
  type RepositorySource,
  TestCompilerError,
} from "#scripts/check/source";

const TEST_MODULE_PATTERN = /\.test\.ts$/u;
const EQUALITY_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken,
]);

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
      const identifiers = descendants(sourceFile, false).filter(isIdentifier);
      const symbols = project.checker.getSymbolAtLocation(identifiers);
      const lexicalSymbols = new Map(
        identifiers.map((node, offset) => [node, symbols[offset]])
      );
      for (const node of nodes) {
        if (isShorthandPropertyAssignment(node) && isIdentifier(node.name)) {
          lexicalSymbols.set(
            node.name,
            project.checker.getShorthandAssignmentValueSymbol(node)
          );
        }
      }
      const hasRunner = effectRunnerViolation(nodes, lexicalSymbols);
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
  function* (sources: readonly (typeof RepositorySource.Type)[]) {
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
    const api = yield* openCompiler(
      files,
      "Unable to start the native test compiler."
    );
    return (yield* Effect.forEach(
      tests,
      ({ file }, index) => inspectTest(api, index, file),
      { concurrency: 1 }
    )).flat();
  },
  Effect.scoped
);

/** Returns whether one node compares a typeof result against the object tag. */
function isTypeofObjectComparison(node: Node) {
  if (
    !(
      isBinaryExpression(node) &&
      EQUALITY_OPERATORS.has(node.operatorToken.kind)
    )
  ) {
    return false;
  }
  for (const side of [node.left, node.right]) {
    if (!isTypeOfExpression(side)) {
      continue;
    }
    const other = side === node.left ? node.right : node.left;
    if (isStringLiteralLikeNode(other) && other.text === "object") {
      return true;
    }
  }
  return false;
}

/**
 * Reports raw failure handling and hand-rolled narrowing in one authored
 * module. Expected failure belongs to typed Effect errors and unknown input
 * belongs to Schema or Predicate.
 */
export function inspectEffectSource(file: string, sourceFile: SourceFile) {
  const violations: string[] = [];
  for (const node of descendants(sourceFile)) {
    if (isTryStatement(node) && node.catchClause !== undefined) {
      violations.push(
        `${file}: model failure with Effect instead of a raw try/catch statement.`
      );
    }
    if (isTypeofObjectComparison(node)) {
      violations.push(
        `${file}: narrow unknown input with Schema or Predicate instead of a typeof-object check.`
      );
    }
  }
  return violations;
}
