import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  Path,
  String as Str,
} from "effect";
import { arrayFindings, isProjectConfig } from "#scripts/check/arrays";
import {
  inspectCompilerConfigs,
  isCompilerConfig,
  ownerBlock,
  sharedPackageName,
} from "#scripts/check/compiler";
import { inspectDeploySource } from "#scripts/check/deploy";
import {
  effectFindings,
  effectTestViolations,
  findingMessages,
  sortFindings,
} from "#scripts/check/effect";
import { inspectExports, publishedDirectories } from "#scripts/check/exports";
import {
  readAuthoredSources,
  readAuthoredTree,
  readOtherModules,
} from "#scripts/check/files";
import { inspectGatewaySource } from "#scripts/check/gateway";
import { pluginRuleNames } from "#scripts/check/plugin";
import { inspectReactSource, inspectStateSource } from "#scripts/check/react";
import { inspectRefsSource } from "#scripts/check/refs";
import { inspectCohortPins, inspectSharedFiles } from "#scripts/check/shared";
import { inspectModuleSize } from "#scripts/check/size";
import { openRepositoryCompiler, parseSources } from "#scripts/check/source";
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
 * Applies the Effect-native, array, gateway, React, state, and refs source
 * policies to authored modules. The array rules read each module's types from
 * its project on disk, and their findings join the Effect-native findings
 * before the list is sorted. Every finding is a violation: no baseline or
 * allowlist holds one back.
 */
const inspectSources = Effect.fn("RepositoryPolicy.inspectSources")(function* (
  root: string,
  sources: Parameters<typeof parseSources>[0],
  projectConfigs: readonly string[],
  otherModules: readonly string[],
  published: readonly string[]
) {
  const parsed = yield* parseSources(sources);
  const arrays = yield* Effect.scoped(
    Effect.flatMap(
      openRepositoryCompiler(
        root,
        "Unable to start the native project compiler."
      ),
      (api) => arrayFindings(api, root, projectConfigs, parsed.modules)
    )
  );
  return Arr.flatten([
    findingMessages(
      sortFindings(Arr.appendAll(yield* effectFindings(parsed), arrays))
    ),
    Arr.flatMap(parsed.modules, ({ file, sourceFile }) =>
      Arr.flatten([
        inspectGatewaySource(file, sourceFile),
        inspectReactSource(file, sourceFile),
        inspectStateSource(file, sourceFile),
        inspectRefsSource(file, sourceFile),
        inspectModuleSize(file, sourceFile),
        inspectDeploySource(file, sourceFile),
      ])
    ),
    inspectExports(
      parsed.modules,
      Arr.appendAll(
        Arr.map(sources, ({ sourceText }) => sourceText),
        otherModules
      ),
      published
    ),
  ]);
}, Effect.scoped);

/**
 * Validates test ownership, source policy, compiler configuration, and
 * repository layout of the repository at `root`. `owner` is the repository
 * that owns the rule decisions: the one being judged, unless another
 * repository runs this check.
 */
export const checkTestPolicy = Effect.fn("RepositoryPolicy.checkTests")(
  function* (root: string, owner: string = root) {
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
    const otherModules = yield* readOtherModules(
      Arr.appendAll(workspaces, scripts)
    );
    const runnerViolations = yield* effectTestViolations(sources);
    const relative = (files: readonly string[]) =>
      Arr.map(files, (file) => path.relative(root, file));
    // The policy reads repository paths, which use "/" on every platform. A
    // configuration at the repository root counts like any workspace's own.
    const rootEntries = yield* fileSystem.readDirectory(root);
    const configs = yield* Effect.forEach(
      Arr.filter(
        Arr.appendAll(
          Arr.map(relative(Arr.appendAll(workspaces, scripts)), (file) =>
            Arr.join(Str.split(file, path.sep), "/")
          ),
          rootEntries
        ),
        isCompilerConfig
      ),
      (file) =>
        Effect.map(
          fileSystem.readFileString(path.join(root, file)),
          (sourceText) => ({ file, sourceText })
        )
    );
    const sharedPackage = yield* sharedPackageName(root);
    const pluginRules = yield* pluginRuleNames(root);
    const ownerRules = yield* ownerBlock(root, owner);
    const sharedViolations = yield* inspectSharedFiles(root, owner);
    const cohortViolations = yield* inspectCohortPins(root, owner);
    const projectConfigs = Arr.map(
      Arr.filter(configs, ({ file }) => isProjectConfig(file)),
      ({ file }) => file
    );
    const sourceViolations = yield* inspectSources(
      root,
      sources,
      projectConfigs,
      otherModules,
      yield* publishedDirectories(root, workspaces)
    );
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
        lineReport(sourceViolations),
        lineReport(
          inspectCompilerConfigs(
            sharedPackage,
            configs,
            pluginRules,
            ownerRules
          )
        ),
        lineReport(sharedViolations),
        lineReport(cohortViolations),
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

// The repository that holds this script owns the rule decisions. Another
// repository that runs it from its own root is compared with them.
runEntry(
  import.meta.main,
  checkTestPolicy(process.cwd(), `${import.meta.dirname}/../..`)
);
