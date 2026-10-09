import {
  Array as Arr,
  Effect,
  HashSet,
  Option,
  Order,
  Path,
  Record as Rec,
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

const PROJECT_CONFIG_NAME = "tsconfig.json";
const PROJECT_CONFIG_PATTERN = /(?:^|\/)tsconfig\.json$/u;

/** Whether a repository path names a project's `tsconfig.json`. */
export function isProjectConfig(file: string) {
  return PROJECT_CONFIG_PATTERN.test(file);
}

/** Returns the nearest project configuration at or above a file's folder, when one exists. */
function nearestConfig(file: string, configs: HashSet.HashSet<string>) {
  const folders = Arr.dropRight(Str.split(file, "/"), 1);
  return Arr.findFirst(
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

/** Judges one module in the project that opened it, failing when that project does not contain it. */
const judgeModule = Effect.fnUntraced(function* (
  project: Project,
  root: string,
  config: string,
  pageKeys: HashSet.HashSet<string>,
  file: string
) {
  const path = yield* Path.Path;
  const sourceFile = yield* Effect.try({
    try: () => project.program.getSourceFile(path.join(root, file)),
    catch: (cause) =>
      new TestCompilerError({
        cause,
        message: `Unable to inspect ${file}.`,
      }),
  });
  if (sourceFile === undefined) {
    return yield* new TestCompilerError({
      cause: file,
      message: `${file} is not part of its nearest project ${config}, so the array rules cannot read its types.`,
    });
  }
  return yield* judgeSource(project.checker, file, sourceFile, pageKeys);
});

/** Opens one project, judges its modules in it, and releases its snapshot before the next project opens. */
const inspectProject = Effect.fn("RepositoryPolicy.inspectArrays")(function* (
  api: API,
  root: string,
  pageKeys: HashSet.HashSet<string>,
  config: string,
  previous: string | undefined,
  files: readonly string[]
) {
  const path = yield* Path.Path;
  const openFailure = (cause: unknown) =>
    new TestCompilerError({ cause, message: `Unable to open ${config}.` });
  const snapshot = yield* Effect.acquireRelease(
    Effect.try({
      try: () =>
        api.updateSnapshot({
          openProjects: [path.join(root, config)],
          closeProjects:
            previous === undefined ? [] : [path.join(root, previous)],
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
    return yield* new TestCompilerError({
      cause: `The native project ${config} is missing.`,
      message: `Unable to open ${config}.`,
    });
  }
  const findings = yield* Effect.forEach(files, (file) =>
    judgeModule(project, root, config, pageKeys, file)
  );
  return Arr.flatten(findings);
}, Effect.scoped);

/**
 * Reports the array method calls whose receiver the compiler types as an array.
 * Each covered module is judged in the project of its nearest `tsconfig.json`.
 * Projects open one at a time, and each opening closes the one before it. A
 * covered module that no project contains fails the check, so none is skipped.
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
    const located = yield* Effect.forEach(covered, ({ file }) =>
      Option.match(nearestConfig(file, configSet), {
        onNone: () =>
          Effect.fail(
            new TestCompilerError({
              cause: file,
              message: `${file} has no tsconfig.json up its folder tree, so the array rules cannot read its types.`,
            })
          ),
        onSome: (config) => Effect.succeed({ config, file }),
      })
    );
    const groups = Arr.groupBy(located, ({ config }) => config);
    const names = Arr.sort(Rec.keys(groups), Order.String);
    const previous = Arr.prepend(Arr.dropRight(names, 1), undefined);
    const findings = yield* Effect.forEach(
      Arr.zip(names, previous),
      ([config, before]) =>
        inspectProject(
          api,
          root,
          pageKeys,
          config,
          before,
          Arr.map(groups[config], ({ file }) => file)
        ),
      { concurrency: 1 }
    );
    return Arr.flatten(findings);
  }
);
