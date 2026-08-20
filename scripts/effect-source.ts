import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Effect,
  FileSystem,
  Path,
  type PlatformError,
  Schema,
  Stream,
} from "effect";
import { ChildProcess } from "effect/unstable/process";

const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
export interface EffectSourceConfig {
  readonly identityManifest: string;
  readonly installedManifest: string;
  readonly repository: string;
  readonly repositoryRoot: string;
  readonly sourcePath: string;
  readonly vendoredManifest: string;
}
const DEFAULT_CONFIG: EffectSourceConfig = {
  identityManifest: "scripts/effect-source.json",
  installedManifest: "node_modules/effect/package.json",
  repository: "https://github.com/Effect-TS/effect.git",
  repositoryRoot: ".",
  sourcePath: "repos/effect",
  vendoredManifest: "repos/effect/packages/effect/package.json",
};
const PackageManifest = Schema.Struct({
  version: Schema.String.pipe(Schema.check(Schema.isPattern(VERSION_PATTERN))),
});
const SourceIdentity = Schema.Struct({
  commit: Schema.String.pipe(
    Schema.check(Schema.isPattern(GIT_OBJECT_PATTERN))
  ),
  tag: Schema.String,
  tree: Schema.String.pipe(Schema.check(Schema.isPattern(GIT_OBJECT_PATTERN))),
});
class EffectSourceFileError extends Schema.TaggedError<EffectSourceFileError>()(
  "EffectSourceFileError",
  { message: Schema.String }
) {}
class EffectSourceGitError extends Schema.TaggedError<EffectSourceGitError>()(
  "EffectSourceGitError",
  { message: Schema.String }
) {}
class EffectSourceMismatch extends Schema.TaggedError<EffectSourceMismatch>()(
  "EffectSourceMismatch",
  { message: Schema.String }
) {}
class EffectSourceUsageError extends Schema.TaggedError<EffectSourceUsageError>()(
  "EffectSourceUsageError",
  { message: Schema.String }
) {}
/** Collects one command stream without leaving a child process unscoped. */
function collectText(
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) {
  return stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (output, chunk) => output + chunk
    )
  );
}
/** Translates one platform command failure into the CLI error contract. */
function gitPlatformError(error: PlatformError.PlatformError) {
  return new EffectSourceGitError({ message: error.message });
}
/** Runs Git with structured concurrency and preserves non-zero diagnostics. */
const runGit = Effect.fn("EffectSource.runGit")(
  (repositoryRoot: string, args: readonly string[]) =>
    Effect.scoped(
      Effect.gen(function* () {
        const command = yield* ChildProcess.make("git", args, {
          cwd: repositoryRoot,
        }).pipe(Effect.mapError(gitPlatformError));
        const [exitCode, stdout, stderr] = yield* Effect.all(
          [
            command.exitCode.pipe(Effect.mapError(gitPlatformError)),
            collectText(command.stdout).pipe(Effect.mapError(gitPlatformError)),
            collectText(command.stderr).pipe(Effect.mapError(gitPlatformError)),
          ],
          { concurrency: 3 }
        );
        if (exitCode !== 0) {
          const diagnostic = stderr.trim() || stdout.trim() || "Git failed.";
          return yield* new EffectSourceGitError({
            message: `git ${args.join(" ")}: ${diagnostic}`,
          });
        }
        return stdout;
      })
    )
);
/** Runs Git and trims one scalar value from its successful output. */
const readGitValue = Effect.fn("EffectSource.readGitValue")(
  (repositoryRoot: string, args: readonly string[]) =>
    runGit(repositoryRoot, args).pipe(Effect.map((output) => output.trim()))
);
/** Resolves one repository-owned file without changing process state. */
const resolveRepositoryFile = Effect.fn("EffectSource.resolveFile")(function* (
  config: EffectSourceConfig,
  file: string
) {
  const path = yield* Path.Path;
  return path.resolve(config.repositoryRoot, file);
});
/** Reads one JSON document through the platform filesystem. */
const readJson = Effect.fn("EffectSource.readJson")(function* (path: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const source = yield* fileSystem
    .readFileString(path)
    .pipe(
      Effect.mapError(
        (error) => new EffectSourceFileError({ message: error.message })
      )
    );
  return yield* Effect.try({
    catch: () =>
      new EffectSourceFileError({
        message: `${path} does not contain valid JSON.`,
      }),
    try: (): unknown => JSON.parse(source),
  });
});
/** Reads and validates one package version through the platform filesystem. */
const readVersion = Effect.fn("EffectSource.readVersion")(function* (
  path: string
) {
  const input = yield* readJson(path);
  return yield* Schema.decodeUnknownEffect(PackageManifest)(input).pipe(
    Effect.mapError(
      () =>
        new EffectSourceFileError({
          message: `${path} does not contain a valid Effect version.`,
        })
    ),
    Effect.map((manifest) => manifest.version)
  );
});
/** Reads the immutable upstream commit and tree recorded for vendored source. */
const readSourceIdentity = Effect.fn("EffectSource.readIdentity")(function* (
  path: string
) {
  const input = yield* readJson(path);
  return yield* Schema.decodeUnknownEffect(SourceIdentity)(input).pipe(
    Effect.mapError(
      () =>
        new EffectSourceFileError({
          message: `${path} does not contain a valid Effect source identity.`,
        })
    )
  );
});
/** Writes the source identity that the staged vendored tree must match. */
const writeSourceIdentity = Effect.fn("EffectSource.writeIdentity")(function* (
  path: string,
  identity: Schema.Schema.Type<typeof SourceIdentity>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  yield* fileSystem
    .writeFileString(path, `${JSON.stringify(identity, null, 2)}\n`)
    .pipe(
      Effect.mapError(
        (error) => new EffectSourceFileError({ message: error.message })
      )
    );
});
/** Reads both package versions and verifies the pinned vendored tree. */
const inspectSource = Effect.fn("EffectSource.inspect")(function* (
  config: EffectSourceConfig
) {
  const sourceStatus = yield* runGit(config.repositoryRoot, [
    "status",
    "--porcelain",
    "--",
    config.sourcePath,
    config.identityManifest,
  ]);
  if (sourceStatus.trim()) {
    return yield* new EffectSourceMismatch({
      message: `${config.sourcePath} or ${config.identityManifest} has local changes.`,
    });
  }
  const [identityPath, installedPath, vendoredPath] = yield* Effect.all(
    [
      resolveRepositoryFile(config, config.identityManifest),
      resolveRepositoryFile(config, config.installedManifest),
      resolveRepositoryFile(config, config.vendoredManifest),
    ],
    { concurrency: 3 }
  );
  const [identity, installedVersion, vendoredVersion, currentTree] =
    yield* Effect.all(
      [
        readSourceIdentity(identityPath),
        readVersion(installedPath),
        readVersion(vendoredPath),
        readGitValue(config.repositoryRoot, [
          "rev-parse",
          `HEAD:${config.sourcePath}`,
        ]),
      ],
      { concurrency: 4 }
    );
  if (currentTree !== identity.tree) {
    return yield* new EffectSourceMismatch({
      message: `${config.sourcePath} differs from tree ${identity.tree}.`,
    });
  }
  const vendoredTag = `effect@${vendoredVersion}`;
  if (identity.tag !== vendoredTag) {
    return yield* new EffectSourceMismatch({
      message: `${config.identityManifest} records ${identity.tag}, but vendored source is ${vendoredTag}.`,
    });
  }
  return { identity, installedVersion, vendoredVersion };
});
/** Fails when the checked-in source does not match the installed package. */
const checkSource = Effect.fn("EffectSource.check")(function* (
  config: EffectSourceConfig
) {
  const state = yield* inspectSource(config);
  if (state.installedVersion !== state.vendoredVersion) {
    return yield* new EffectSourceMismatch({
      message: `Installed Effect is ${state.installedVersion}, but ${config.sourcePath} is ${state.vendoredVersion}. Commit dependency changes, then run pnpm effect:source:update.`,
    });
  }
  yield* Effect.log(
    `Effect source ${state.identity.tag} matches ${state.identity.commit}.`
  );
  return state;
});
/** Requires a named branch and clean worktree before source commits. */
const requireCleanWorktree = Effect.fn("EffectSource.requireClean")(function* (
  config: EffectSourceConfig
) {
  const branchRef = yield* readGitValue(config.repositoryRoot, [
    "symbolic-ref",
    "--quiet",
    "HEAD",
  ]);
  const status = yield* runGit(config.repositoryRoot, [
    "status",
    "--porcelain",
  ]);
  if (status.trim()) {
    return yield* new EffectSourceMismatch({
      message:
        "Effect source updates require a clean worktree. Commit dependency changes first.",
    });
  }
  return branchRef;
});
/** Applies one exact upstream tree and records it in one linear commit. */
const updateSource = Effect.fn("EffectSource.update")(function* (
  config: EffectSourceConfig
) {
  const branchRef = yield* requireCleanWorktree(config);
  const state = yield* inspectSource(config);
  if (state.installedVersion === state.vendoredVersion) {
    yield* Effect.log(
      `Effect source ${state.vendoredVersion} is already current.`
    );
    return;
  }
  const tag = `effect@${state.installedVersion}`;
  const previousHead = yield* readGitValue(config.repositoryRoot, [
    "rev-parse",
    "HEAD",
  ]);
  yield* runGit(config.repositoryRoot, [
    "fetch",
    "--no-tags",
    config.repository,
    tag,
  ]);
  const upstreamCommit = yield* readGitValue(config.repositoryRoot, [
    "rev-parse",
    "FETCH_HEAD^{commit}",
  ]);
  const upstreamTree = yield* readGitValue(config.repositoryRoot, [
    "rev-parse",
    `${upstreamCommit}^{tree}`,
  ]);
  const fileSystem = yield* FileSystem.FileSystem;
  yield* Effect.scoped(
    Effect.gen(function* () {
      const tempRoot = yield* fileSystem.makeTempDirectoryScoped({
        directory: config.repositoryRoot,
        prefix: ".effect-source-update-",
      });
      const patchPath = `${tempRoot}/source.patch`;
      yield* runGit(config.repositoryRoot, [
        "diff",
        "--binary",
        "--full-index",
        `--output=${patchPath}`,
        state.identity.tree,
        upstreamTree,
      ]);
      yield* runGit(config.repositoryRoot, [
        "apply",
        "--binary",
        "--index",
        `--directory=${config.sourcePath}`,
        patchPath,
      ]);
    })
  );
  const identityPath = yield* resolveRepositoryFile(
    config,
    config.identityManifest
  );
  yield* writeSourceIdentity(identityPath, {
    commit: upstreamCommit,
    tag,
    tree: upstreamTree,
  });
  yield* runGit(config.repositoryRoot, ["add", "--", config.identityManifest]);
  const tree = yield* readGitValue(config.repositoryRoot, ["write-tree"]);
  const stagedSourceTree = yield* readGitValue(config.repositoryRoot, [
    "rev-parse",
    `${tree}:${config.sourcePath}`,
  ]);
  if (stagedSourceTree !== upstreamTree) {
    return yield* new EffectSourceMismatch({
      message: `Staged ${config.sourcePath} is ${stagedSourceTree}, expected ${upstreamTree}.`,
    });
  }
  const linearHead = yield* readGitValue(config.repositoryRoot, [
    "commit-tree",
    tree,
    "-p",
    previousHead,
    "-m",
    `build(effect): update source to ${state.installedVersion}`,
    "-m",
    `git-subtree-dir: ${config.sourcePath}\ngit-subtree-split: ${upstreamCommit}`,
  ]);
  yield* runGit(config.repositoryRoot, [
    "update-ref",
    "-m",
    "record Effect source update",
    branchRef,
    linearHead,
    previousHead,
  ]);
  yield* checkSource(config);
});
/** Selects the explicit maintenance operation at the CLI boundary. */
export const makeEffectSourceProgram = Effect.fn("EffectSource.main")(
  function* (
    action: string | undefined,
    config: EffectSourceConfig = DEFAULT_CONFIG
  ) {
    if (action === "check") {
      yield* checkSource(config);
      return;
    }
    if (action === "update") {
      yield* updateSource(config);
      return;
    }
    return yield* new EffectSourceUsageError({
      message: "Usage: node scripts/effect-source.ts <check|update>",
    });
  }
);
if (import.meta.main) {
  NodeRuntime.runMain(
    makeEffectSourceProgram(process.argv[2]).pipe(
      Effect.provide(NodeServices.layer)
    )
  );
}
