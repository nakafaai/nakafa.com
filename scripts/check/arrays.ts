import {
  Array as Arr,
  Effect,
  HashSet,
  Option,
  Order,
  Path,
  Result,
  String as Str,
} from "effect";
import type { SourceFile } from "typescript/unstable/ast";
import type { API, Checker, Project } from "typescript/unstable/sync";
import { ARRAY_RULES, arrayCall } from "#scripts/check/calls";
import { outsidePage, pageKeysOf } from "#scripts/check/page";
import { receiverVerdicts } from "#scripts/check/receivers";
import { covers } from "#scripts/check/rules";
import {
  descendants,
  isGenerated,
  type parseSources,
  TestCompilerError,
} from "#scripts/check/source";

/** A parsed authored module: its repository path and its in-memory syntax. */
type ParsedModule = Effect.Success<
  ReturnType<typeof parseSources>
>["modules"][number];

/** One array method call that breaks a rule, reported by the project that judged its module. */
type ArrayFinding = Effect.Success<ReturnType<typeof judgeSource>>[number];

const PROJECT_CONFIG_NAME = "tsconfig.json";
const PROJECT_CONFIG_PATTERN = /(?:^|\/)tsconfig\.json$/u;

/** Whether a repository path names a project's `tsconfig.json`. */
export function isProjectConfig(file: string) {
  return PROJECT_CONFIG_PATTERN.test(file);
}

/**
 * Returns the project configurations at or above a file's folder that exist, nearest
 * first. The first of them whose project contains the file judges it.
 */
function projectsUpward(file: string, configs: HashSet.HashSet<string>) {
  const folders = Arr.dropRight(Str.split(file, "/"), 1);
  return Arr.filter(
    Arr.makeBy(folders.length + 1, (depth) =>
      Arr.join(
        Arr.append(
          Arr.take(folders, folders.length - depth),
          PROJECT_CONFIG_NAME
        ),
        "/"
      )
    ),
    (candidate) => HashSet.has(configs, candidate)
  );
}

/** Returns how many folders a project configuration sits below the repository root. */
function depthOf(config: string) {
  return Str.split(config, "/").length - 1;
}

/**
 * Returns the array method calls of one module that its project types as arrays.
 * A call counts only when its rule covers the module. A browser page function
 * keeps its native methods, because no import reaches it there.
 */
const judgeSource = Effect.fnUntraced(function* (
  checker: Checker,
  file: string,
  sourceFile: SourceFile,
  pageKeys: HashSet.HashSet<string>
) {
  const calls = Arr.filterMap(
    outsidePage(file, sourceFile, descendants(sourceFile), pageKeys),
    arrayCall
  );
  const covered = Arr.filter(calls, ({ rule }) =>
    covers(rule, file, sourceFile)
  );
  const verdicts = yield* receiverVerdicts(
    checker,
    Arr.map(covered, ({ receiver }) => receiver)
  );
  return Arr.filterMap(Arr.zip(covered, verdicts), ([{ name, rule }, array]) =>
    array
      ? Result.succeed({
          file,
          line:
            sourceFile.getLineAndCharacterOfPosition(name.getStart(sourceFile))
              .line + 1,
          rule,
        })
      : Result.failVoid
  );
});

/**
 * Judges one module in the project that opened it. A module that the project does
 * not contain fails the result, so the next project up its folder tree judges it.
 */
const judgeModule = Effect.fnUntraced(function* (
  project: Project,
  root: string,
  pageKeys: HashSet.HashSet<string>,
  file: string
) {
  const path = yield* Path.Path;
  const sourceFile = yield* Effect.try({
    try: () => project.program.getSourceFile(path.join(root, file)),
    catch: (cause) =>
      TestCompilerError.make({
        cause,
        message: `Unable to inspect ${file}.`,
      }),
  });
  if (sourceFile === undefined) {
    return Result.fail(file);
  }
  return Result.succeed(
    yield* judgeSource(project.checker, file, sourceFile, pageKeys)
  );
});

/**
 * Opens one project, judges the modules it contains, and releases its snapshot before
 * the next project opens. Returns the findings, and the files the project does not contain.
 */
const inspectProject = Effect.fn("RepositoryPolicy.inspectArrays")(function* (
  api: API,
  root: string,
  pageKeys: HashSet.HashSet<string>,
  config: string,
  previous: Option.Option<string>,
  files: readonly string[]
) {
  const path = yield* Path.Path;
  const openFailure = (cause: unknown) =>
    TestCompilerError.make({ cause, message: `Unable to open ${config}.` });
  const snapshot = yield* Effect.acquireRelease(
    Effect.try({
      try: () =>
        api.updateSnapshot({
          openProjects: [path.join(root, config)],
          closeProjects: Option.match(previous, {
            onNone: () => [],
            onSome: (project) => [path.join(root, project)],
          }),
        }),
      catch: openFailure,
    }),
    (resource) => Effect.sync(() => resource.dispose())
  );
  const project = yield* Effect.try({
    try: () => snapshot.getProject(path.join(root, config)),
    catch: openFailure,
  });
  if (project === undefined) {
    return yield* TestCompilerError.make({
      cause: `The native project ${config} is missing.`,
      message: `Unable to open ${config}.`,
    });
  }
  const judged = yield* Effect.forEach(files, (file) =>
    judgeModule(project, root, pageKeys, file)
  );
  const [found, missing] = Arr.separate(judged);
  return { findings: Arr.flatten(found), missing };
}, Effect.scoped);

/**
 * Reports the array method calls whose receiver the compiler types as an array.
 * Each covered module is judged by the nearest project up its folder tree that
 * contains it. Projects open one at a time, deepest first, so each opens once and
 * closes the one before it. A covered module that no project contains fails the
 * check, and the failure names every project tried, so none is skipped.
 */
export const arrayFindings = Effect.fn("RepositoryPolicy.arrayFindings")(
  function* (
    api: API,
    root: string,
    configs: readonly string[],
    modules: readonly ParsedModule[]
  ) {
    const authored = Arr.filter(
      modules,
      ({ sourceFile }) => !isGenerated(sourceFile)
    );
    const pageKeys = pageKeysOf(authored);
    const covered = Arr.filter(authored, ({ file, sourceFile }) =>
      Arr.some(ARRAY_RULES, (rule) => covers(rule, file, sourceFile))
    );
    const configSet = HashSet.fromIterable(configs);
    const located = yield* Effect.forEach(covered, ({ file }) => {
      const chain = projectsUpward(file, configSet);
      return Arr.isReadonlyArrayEmpty(chain)
        ? Effect.fail(
            TestCompilerError.make({
              cause: file,
              message: `${file} has no tsconfig.json up its folder tree, so the array rules cannot read its types.`,
            })
          )
        : Effect.succeed({ chain, file });
    });
    // Each chain lists its projects nearest first, and a nearer project is always deeper,
    // so opening the deepest projects first gives every module its nearest project first.
    const ordered = Arr.sort(
      Arr.dedupe(Arr.flatMap(located, ({ chain }) => chain)),
      Order.combine(
        Order.mapInput(Order.flip(Order.Number), depthOf),
        Order.String
      )
    );
    const judgment = yield* Effect.reduce(
      ordered,
      () => ({
        findings: Arr.empty<ArrayFinding>(),
        opened: Option.none<string>(),
        pending: located,
      }),
      (state, config) => {
        const batch = Arr.filter(state.pending, ({ chain }) =>
          Arr.contains(chain, config)
        );
        if (Arr.isReadonlyArrayEmpty(batch)) {
          return Effect.succeed(state);
        }
        const rest = Arr.filter(
          state.pending,
          ({ chain }) => !Arr.contains(chain, config)
        );
        return Effect.map(
          inspectProject(
            api,
            root,
            pageKeys,
            config,
            state.opened,
            Arr.map(batch, ({ file }) => file)
          ),
          ({ findings, missing }) => ({
            findings: Arr.appendAll(state.findings, findings),
            opened: Option.some(config),
            pending: Arr.appendAll(
              rest,
              Arr.filter(batch, ({ file }) => Arr.contains(missing, file))
            ),
          })
        );
      }
    );
    return yield* Option.match(Arr.head(judgment.pending), {
      onNone: () => Effect.succeed(judgment.findings),
      onSome: ({ chain, file }) =>
        Effect.fail(
          TestCompilerError.make({
            cause: file,
            message: `${file} is not part of any project up its folder tree (tried ${Arr.join(chain, ", ")}), so the array rules cannot read its types.`,
          })
        ),
    });
  }
);
