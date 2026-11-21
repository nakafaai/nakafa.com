import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  Path,
  String as Str,
} from "effect";
import { inspectHeaderActions } from "#scripts/check/actions";
import { arrayFindings, isProjectConfig } from "#scripts/check/arrays";
import { inspectBandSource } from "#scripts/check/bands";
import { inspectButtonSource } from "#scripts/check/buttons";
import { inspectChartSource } from "#scripts/check/charts";
import { classFindings } from "#scripts/check/classes";
import {
  inspectChromeColorSource,
  inspectColorSource,
} from "#scripts/check/colors";
import {
  inspectCompilerConfigs,
  isCompilerConfig,
  ownerBlock,
  sharedPackageName,
} from "#scripts/check/compiler";
import { inspectNativeControls } from "#scripts/check/controls";
import { inspectDialogSource } from "#scripts/check/dialogs";
import { inspectDictionaries } from "#scripts/check/dictionary";
import { inspectDrillingSource } from "#scripts/check/drilling";
import {
  effectFindings,
  effectTestViolations,
  findingMessages,
  sortFindings,
} from "#scripts/check/effect";
import { inspectEmptySource } from "#scripts/check/empty";
import {
  declarationDirectories,
  inspectExports,
  publishedDirectories,
} from "#scripts/check/exports";
import {
  authoredJavaScript,
  readAuthoredSources,
  readAuthoredTree,
  readOtherModules,
} from "#scripts/check/files";
import { inspectPaneFooters } from "#scripts/check/footers";
import { inspectFormatSource } from "#scripts/check/formats";
import { inspectFrameSource } from "#scripts/check/frame";
import { inspectGatewaySource } from "#scripts/check/gateway";
import { inspectGroupSource } from "#scripts/check/groups";
import { inspectIconSource } from "#scripts/check/icons";
import { inspectMarkers, TEXT_FILE_PATTERN } from "#scripts/check/markers";
import { inspectMenuSource } from "#scripts/check/menus";
import { inspectMessageReach } from "#scripts/check/messages";
import { manifestEntries, nameViolations } from "#scripts/check/names";
import { inspectOptionSource } from "#scripts/check/options";
import { inspectMenuOrder } from "#scripts/check/order";
import { inspectPickerSource } from "#scripts/check/pickers";
import { pluginRuleNames } from "#scripts/check/plugin";
import { inspectPoses } from "#scripts/check/poses";
import { inspectReactSource, inspectStateSource } from "#scripts/check/react";
import { inspectRefsSource } from "#scripts/check/refs";
import { inspectScrollSource } from "#scripts/check/scroll";
import { inspectSdkReach } from "#scripts/check/sdk";
import { inspectSealedSource } from "#scripts/check/sealed";
import { inspectSectionSource } from "#scripts/check/sections";
import { inspectSelectorSource } from "#scripts/check/selectors";
import { inspectCohortPins, inspectSharedFiles } from "#scripts/check/shared";
import { inspectStylesheet } from "#scripts/check/sheets";
import { inspectModuleSize } from "#scripts/check/size";
import { openRepositoryCompiler, parseSources } from "#scripts/check/source";
import { inspectTables } from "#scripts/check/tables";
import { inspectTailwindSource } from "#scripts/check/tailwind";
import { inspectToastSource } from "#scripts/check/toasts";
import { inspectVisualSource } from "#scripts/check/visuals";
import { runEntry } from "#scripts/entry";
import { writeError, writeOutput } from "#scripts/output";

const TEST_FILE_PATTERN = /\.test\.tsx?$/u;
const TSX_TEST_FILE_PATTERN = /\.test\.tsx$/u;
const STYLESHEET_PATTERN = /\.css$/u;
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
 * Applies the Effect-native, array, gateway, React, props drilling, menu, button group, state, refs,
 * sealed message, settings card, and class source policies to authored modules. The array rules read each module's types
 * from its project on disk, and their findings join the Effect-native findings
 * before the list is sorted. Every finding is a violation: no baseline or
 * allowlist holds one back.
 */
const inspectSources = Effect.fn("RepositoryPolicy.inspectSources")(function* (
  root: string,
  sources: Parameters<typeof parseSources>[0],
  projectConfigs: readonly string[],
  otherModules: readonly string[],
  unjudged: readonly string[]
) {
  const parsed = yield* parseSources(sources);
  const arrays = yield* Effect.scoped(
    Effect.flatMap(
      openRepositoryCompiler(
        root,
        "Unable to start the native project compiler."
      ),
      (base) => arrayFindings(base, root, projectConfigs, parsed.modules)
    )
  );
  return Arr.flatten([
    findingMessages(
      sortFindings(Arr.appendAll(yield* effectFindings(parsed), arrays))
    ),
    Arr.flatMap(parsed.modules, ({ file, sourceFile }) =>
      Arr.flatten([
        inspectColorSource(file, sourceFile),
        inspectChromeColorSource(file, sourceFile),
        inspectChartSource(file, sourceFile),
        inspectGatewaySource(file, sourceFile),
        inspectToastSource(file, sourceFile),
        inspectFormatSource(file, sourceFile),
        inspectReactSource(file, sourceFile),
        inspectDrillingSource(file, sourceFile),
        inspectMenuSource(file, sourceFile),
        inspectMenuOrder(file, sourceFile),
        inspectOptionSource(file, sourceFile),
        inspectGroupSource(file, sourceFile),
        inspectButtonSource(file, sourceFile),
        inspectIconSource(file, sourceFile),
        inspectDialogSource(file, sourceFile),
        inspectIconSource(file, sourceFile),
        inspectPickerSource(file, sourceFile),
        inspectEmptySource(file, sourceFile),
        inspectNativeControls(file, sourceFile),
        inspectScrollSource(file, sourceFile),
        inspectStateSource(file, sourceFile),
        inspectSelectorSource(file, sourceFile),
        inspectRefsSource(file, sourceFile),
        inspectSealedSource(file, sourceFile),
        inspectSectionSource(file, sourceFile),
        inspectVisualSource(file, sourceFile),
        inspectBandSource(file, sourceFile),
        inspectModuleSize(file, sourceFile),
      ])
    ),
    inspectExports(parsed.modules, otherModules, unjudged),
    inspectHeaderActions(parsed.modules),
    inspectPaneFooters(parsed.modules),
    inspectTables(parsed.modules),
    yield* classFindings(parsed),
    inspectPoses(parsed.modules),
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
    const { agents, docs, scripts, workspaces } = yield* readAuthoredTree(root);
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
    const relative = (files: readonly string[]) =>
      Arr.map(files, (file) => path.relative(root, file));
    // The policy reads repository paths, which use "/" on every platform. A
    // configuration at the repository root counts like any workspace's own.
    const rootEntries = yield* fileSystem.readDirectory(root);
    const otherModules = yield* readOtherModules(
      Arr.appendAll(workspaces, scripts),
      Arr.appendAll(
        agents,
        Arr.map(rootEntries, (entry) => path.join(root, entry))
      )
    );
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
      Arr.appendAll(
        yield* publishedDirectories(root, workspaces),
        declarationDirectories(configs)
      )
    );
    const sheetViolations = yield* Effect.forEach(
      Arr.filter(workspaces, (file) => STYLESHEET_PATTERN.test(file)),
      (file) =>
        Effect.map(fileSystem.readFileString(file), (sourceText) =>
          inspectStylesheet(path.relative(root, file), sourceText)
        )
    );
    const sdkViolations = yield* inspectSdkReach(root, workspaces);
    const dictionaryViolations = yield* inspectDictionaries(root, workspaces);
    const messageViolations = yield* inspectMessageReach(root, workspaces);
    // A merge that stopped on a conflict leaves Git's marker lines in a file; every text file is read for them, the
    // repository root's own included.
    const markerViolations = yield* Effect.forEach(
      Arr.filter(
        Arr.appendAll(
          Arr.flatten([workspaces, scripts, agents, docs]),
          Arr.map(rootEntries, (entry) => path.join(root, entry))
        ),
        (file) => TEXT_FILE_PATTERN.test(file)
      ),
      (file) =>
        Effect.map(fileSystem.readFileString(file), (sourceText) =>
          inspectMarkers(
            Arr.join(Str.split(path.relative(root, file), path.sep), "/"),
            sourceText
          )
        )
    );
    // Every hand-written path is named, the documents and the agent skills' tooling included, by repository path. A
    // repository that runs this check from another one names its paths by its own rules, so only the owner is judged.
    const isOwner =
      (yield* fileSystem.realPath(root)) ===
      (yield* fileSystem.realPath(owner));
    const repositoryPaths = Arr.map(
      relative(Arr.flatten([workspaces, scripts, agents, docs])),
      (file) => Arr.join(Str.split(file, path.sep), "/")
    );
    const names = isOwner
      ? nameViolations(
          repositoryPaths,
          yield* manifestEntries(root, repositoryPaths)
        )
      : [];
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
        fileReport(
          "Authored modules are TypeScript; JavaScript stays only in a public folder the browser loads it from by URL:",
          relative(
            authoredJavaScript(
              Arr.flatten([workspaces, scripts, agents]),
              path.sep
            )
          )
        ),
        lineReport(runnerViolations),
        lineReport(sourceViolations),
        lineReport(Arr.flatten(sheetViolations)),
        lineReport(sdkViolations),
        lineReport(dictionaryViolations),
        lineReport(messageViolations),
        lineReport(Arr.flatten(markerViolations)),
        lineReport(names),
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
        lineReport(
          Arr.flatMap(sources, ({ file, sourceText }) =>
            inspectFrameSource(file, sourceText)
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
