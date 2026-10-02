import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  Path,
  String as Str,
} from "effect";
import {
  exceededMessages,
  ratchet,
  readBaseline,
  staleMessages,
} from "#scripts/check/baseline";
import { effectFindings, effectTestViolations } from "#scripts/check/effect";
import { readAuthoredSources, readAuthoredTree } from "#scripts/check/files";
import { inspectReactSource, inspectStateSource } from "#scripts/check/react";
import { parseSources } from "#scripts/check/source";
import { inspectTailwindSource } from "#scripts/check/tailwind";
import { runEntry } from "#scripts/entry";
import { writeError, writeOutput } from "#scripts/output";

const TEST_FILE_PATTERN = /\.test\.tsx?$/u;
const TSX_TEST_FILE_PATTERN = /\.test\.tsx$/u;
const TEST_DIRECTORIES = HashSet.make("__test__", "__tests__");

/** Renders one titled list of files, or nothing when the list is empty. */
function fileReport(title: string, files: readonly string[]) {
  return Arr.isReadonlyArrayEmpty(files)
    ? ""
    : `${title}\n${Arr.join(
        Arr.map(files, (file) => `  - ${file}`),
        "\n"
      )}\n`;
}

/** Renders violation lines, or nothing when there are none. */
function lineReport(lines: readonly string[]) {
  return Arr.isReadonlyArrayEmpty(lines) ? "" : `${Arr.join(lines, "\n")}\n`;
}

/**
 * Applies the React, state, and Effect-native source policies to authored
 * modules through one native compiler batch.
 */
const inspectSources = Effect.fn("RepositoryPolicy.inspectSources")(function* (
  sources: Parameters<typeof parseSources>[0]
) {
  const parsed = yield* parseSources(sources);
  return {
    findings: yield* effectFindings(parsed),
    violations: Arr.flatMap(parsed.modules, ({ file, sourceFile }) =>
      Arr.appendAll(
        inspectReactSource(file, sourceFile),
        inspectStateSource(file, sourceFile)
      )
    ),
  };
}, Effect.scoped);

/** Validates test ownership, source policy, and repository layout. */
export const checkTestPolicy = Effect.fn("RepositoryPolicy.checkTests")(
  function* (root: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const { scripts, workspaces } = yield* readAuthoredTree(root);
    const tests = Arr.filter(workspaces, (file) =>
      TEST_FILE_PATTERN.test(file)
    );
    const orphanTests = yield* Effect.filter(tests, (test) =>
      Effect.map(
        fileSystem.exists(`${Str.replace(TEST_FILE_PATTERN, "")(test)}.ts`),
        (owned) => !owned
      )
    );
    const tsxTests = Arr.filter(tests, (test) =>
      TSX_TEST_FILE_PATTERN.test(test)
    );
    const nestedTests = Arr.filter(workspaces, (file) =>
      Arr.some(Str.split(file, path.sep), (segment) =>
        HashSet.has(TEST_DIRECTORIES, segment)
      )
    );
    const sources = yield* readAuthoredSources(
      root,
      Arr.appendAll(workspaces, scripts)
    );
    const runnerViolations = yield* effectTestViolations(sources);
    const { findings, violations } = yield* inspectSources(sources);
    const { exceeded, stale } = ratchet(findings, yield* readBaseline(root));
    const relative = (files: readonly string[]) =>
      Arr.map(files, (file) => path.relative(root, file));
    const reports = Arr.filter(
      [
        fileReport(
          "Every final test must have a colocated .ts Module with the same name; React and TSX behavior belongs in Browser or E2E acceptance:",
          relative(orphanTests)
        ),
        fileReport(
          "Final code must not contain .test.tsx files:",
          relative(tsxTests)
        ),
        fileReport(
          "Tests must not use __test__ or __tests__ folders:",
          relative(nestedTests)
        ),
        lineReport(runnerViolations),
        lineReport(violations),
        lineReport(
          Arr.appendAll(exceededMessages(exceeded), staleMessages(stale))
        ),
        lineReport(
          Arr.flatMap(sources, ({ file, sourceText }) =>
            inspectTailwindSource(file, sourceText)
          )
        ),
      ],
      Str.isNonEmpty
    );

    if (Arr.isReadonlyArrayEmpty(reports)) {
      yield* writeOutput("Test ownership checks passed.\n");
      return 0;
    }
    yield* Effect.forEach(reports, writeError, { discard: true });
    return 1;
  }
);

runEntry(import.meta.main, checkTestPolicy(process.cwd()));
