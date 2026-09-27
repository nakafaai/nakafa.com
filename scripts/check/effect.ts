import { Effect, Schema } from "effect";
import {
  isBinaryExpression,
  isIdentifier,
  isShorthandPropertyAssignment,
  isStringLiteralLikeNode,
  isTryStatement,
  isTypeNode,
  isTypeOfExpression,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";
import { effectRunnerViolation } from "#scripts/check/runtime";

export const EffectSource = Schema.Struct({
  file: Schema.String,
  sourceText: Schema.String,
});

export class TestCompilerError extends Schema.TaggedError<TestCompilerError>()(
  "TestCompilerError",
  { cause: Schema.Unknown, message: Schema.String }
) {}

const TEST_MODULE_PATTERN = /\.test\.ts$/u;
const SOURCE_MODULE_PATTERN = /\.tsx?$/u;
const EQUALITY_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken,
]);

/** Returns value-position descendants while excluding type-only subtrees. */
function descendants(sourceFile: SourceFile, skipTypes = true) {
  const nodes: Node[] = [sourceFile];
  for (const node of nodes) {
    if (skipTypes && isTypeNode(node)) {
      continue;
    }
    node.forEachChild((child) => {
      nodes.push(child);
    });
  }
  return nodes;
}

/** Opens one scoped native compiler over an in-memory source set. */
function openCompiler(files: Record<string, string>, message: string) {
  return Effect.acquireRelease(
    Effect.try({
      try: () => new API({ cwd: "/", fs: createVirtualFileSystem(files) }),
      catch: (cause) => new TestCompilerError({ cause, message }),
    }),
    (resource) => Effect.sync(() => resource.close())
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
  function* (sources: readonly (typeof EffectSource.Type)[]) {
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

/** Reports raw failure handling and hand-rolled narrowing in one source file. */
function inspectSourcePolicy(file: string, sourceFile: SourceFile) {
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

/**
 * Reports raw failure handling and hand-rolled narrowing in backend sources.
 *
 * The Convex backend is Effect-native: expected failure belongs to typed
 * Effect errors and unknown input belongs to Schema or Predicate. One batch
 * project reads every authored backend syntax tree, so the cost stays flat
 * as the package grows.
 */
export const effectSourceViolations = Effect.fn(
  "RepositoryPolicy.effectSources"
)(function* (sources: readonly (typeof EffectSource.Type)[]) {
  const inspected = sources.filter(({ file }) =>
    SOURCE_MODULE_PATTERN.test(file)
  );
  if (inspected.length === 0) {
    return [];
  }
  const root = "/source-policy";
  const configFile = `${root}/tsconfig.json`;
  const modules = inspected.map(
    ({ file }, index) => `${index}.${file.endsWith(".tsx") ? "tsx" : "ts"}`
  );
  const api = yield* openCompiler(
    Object.fromEntries([
      ...inspected.map(({ sourceText }, index) => [
        `${root}/${modules[index]}`,
        sourceText,
      ]),
      [
        configFile,
        JSON.stringify({
          compilerOptions: {
            jsx: "preserve",
            noLib: true,
            noResolve: true,
          },
          files: modules,
        }),
      ],
    ]),
    "Unable to start the native source compiler."
  );
  const snapshotFailure = (cause: unknown) =>
    new TestCompilerError({
      cause,
      message: "Unable to inspect repository sources.",
    });
  const snapshot = yield* Effect.acquireRelease(
    Effect.try({
      try: () =>
        api.updateSnapshot({
          openProjects: [configFile],
          closeProjects: [],
        }),
      catch: snapshotFailure,
    }),
    (resource) => Effect.sync(() => resource.dispose())
  );
  const program = snapshot.getProject(configFile)?.program;
  if (program === undefined) {
    return yield* new TestCompilerError({
      cause: "The native source project is missing.",
      message: "Unable to inspect repository sources.",
    });
  }
  return inspected.flatMap(({ file }, index) => {
    const sourceFile = program.getSourceFile(`${root}/${modules[index]}`);
    return sourceFile === undefined
      ? [`${file}: the native compiler did not expose this source file.`]
      : inspectSourcePolicy(file, sourceFile);
  });
}, Effect.scoped);
