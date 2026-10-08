import {
  Array as Arr,
  Effect,
  Order,
  Record as Rec,
  Result,
  Schema,
} from "effect";
import {
  isIdentifier,
  isShorthandPropertyAssignment,
} from "typescript/unstable/ast";
import type { API } from "typescript/unstable/sync";
import { globalCandidates } from "#scripts/check/globals";
import { nativeCandidates } from "#scripts/check/native";
import { outsidePage, pageKeysOf } from "#scripts/check/page";
import { covers, RULES, Rule } from "#scripts/check/rules";
import { effectRunnerViolation } from "#scripts/check/runtime";
import { shapeCandidates } from "#scripts/check/shapes";
import {
  descendants,
  isGenerated,
  openCompiler,
  type parseSources,
  projectConfig,
  type RepositorySource,
  TestCompilerError,
} from "#scripts/check/source";

/** One construct that breaks an Effect-native rule at a line of an authored module. */
export const Finding = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
  rule: Rule,
});

const TEST_MODULE_PATTERN = /\.test\.ts$/u;
const FINDING_ORDER = Order.Struct({
  file: Order.String,
  line: Order.Number,
  rule: Order.String,
});

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
      const identifiers = Arr.filter(
        descendants(sourceFile, false),
        isIdentifier
      );
      const symbols = project.checker.getSymbolAtLocation(identifiers);
      const shorthands = Arr.flatMap(nodes, (node) =>
        isShorthandPropertyAssignment(node) && isIdentifier(node.name)
          ? [
              [
                node.name,
                project.checker.getShorthandAssignmentValueSymbol(node),
              ] as const,
            ]
          : []
      );
      const lexicalSymbols = Arr.appendAll(
        Arr.zip(identifiers, symbols),
        shorthands
      );
      return effectRunnerViolation(nodes, lexicalSymbols)
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
    const tests = Arr.filter(sources, ({ file }) =>
      TEST_MODULE_PATTERN.test(file)
    );
    if (Arr.isReadonlyArrayEmpty(tests)) {
      return [];
    }
    const config = yield* projectConfig(["case.test.ts"]);
    const api = yield* openCompiler(
      Rec.fromEntries(
        Arr.flatMap(tests, ({ sourceText }, index) => [
          [`/test-policy/${index}/case.test.ts`, sourceText],
          [`/test-policy/${index}/tsconfig.json`, config],
        ])
      ),
      "Unable to start the native test compiler."
    );
    return Arr.flatten(
      yield* Effect.forEach(
        tests,
        ({ file }, index) => inspectTest(api, index, file),
        { concurrency: 1 }
      )
    );
  },
  Effect.scoped
);

/** Describes each finding with the Effect replacement its rule names. */
export function findingMessages(findings: readonly (typeof Finding.Type)[]) {
  return Arr.map(
    findings,
    ({ file, line, rule }) =>
      `${file}:${line}: ${RULES[rule].message} (${rule})`
  );
}

/**
 * Finds every Effect-native rule a parsed authored module breaks. A construct
 * that names a platform global counts only when the compiler proves no import
 * or local declaration shadows the name, and an array method counts only when
 * its receiver is a value rather than an imported module. Code that Playwright
 * runs in the browser page keeps its platform globals and its declared shapes,
 * because no import reaches it.
 */
export const effectFindings = Effect.fn("RepositoryPolicy.effectFindings")(
  function* ({
    bind,
    modules,
  }: Effect.Success<ReturnType<typeof parseSources>>) {
    const authored = Arr.filterMap(modules, ({ file, sourceFile }) =>
      isGenerated(sourceFile)
        ? Result.failVoid
        : Result.succeed({ file, nodes: descendants(sourceFile), sourceFile })
    );
    const pageKeys = pageKeysOf(authored);
    const candidates = Arr.flatMap(authored, ({ file, nodes, sourceFile }) => {
      const runtime = outsidePage(file, sourceFile, nodes, pageKeys);
      return Arr.filterMap(
        Arr.flatten([
          globalCandidates(sourceFile, runtime),
          nativeCandidates(sourceFile, runtime),
          shapeCandidates(file, sourceFile, nodes, runtime),
        ]),
        (found) =>
          covers(found.rule, file, sourceFile)
            ? Result.succeed({ ...found, file })
            : Result.failVoid
      );
    });
    const [bound, unbound] = Arr.partition(candidates, (found) =>
      found.reference === undefined
        ? Result.fail(found)
        : Result.succeed({ ...found, reference: found.reference })
    );
    const bindings = yield* bind(Arr.map(bound, ({ reference }) => reference));
    const kept = Arr.filterMap(Arr.zip(bound, bindings), ([found, binding]) =>
      Arr.contains(found.accepts, binding)
        ? Result.succeed(found)
        : Result.failVoid
    );
    return Arr.sort(
      Arr.map(
        Arr.appendAll(unbound, kept),
        ({ file, line, rule }): typeof Finding.Type => ({ file, line, rule })
      ),
      FINDING_ORDER
    );
  }
);
