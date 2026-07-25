import { Command, FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Schema, Stream } from "effect";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;

export interface EffectSourceConfig {
  readonly installedManifest: string;
  readonly repository: string;
  readonly sourcePath: string;
  readonly vendoredManifest: string;
}

const DEFAULT_CONFIG: EffectSourceConfig = {
  installedManifest: "node_modules/effect/package.json",
  repository: "https://github.com/Effect-TS/effect.git",
  sourcePath: "repos/effect",
  vendoredManifest: "repos/effect/packages/effect/package.json",
};

const PackageManifest = Schema.Struct({
  version: Schema.String.pipe(Schema.pattern(VERSION_PATTERN)),
});

class EffectSourceReadError extends Schema.TaggedError<EffectSourceReadError>()(
  "EffectSourceReadError",
  { detail: Schema.String }
) {}

class EffectSourceGitError extends Schema.TaggedError<EffectSourceGitError>()(
  "EffectSourceGitError",
  { detail: Schema.String }
) {}

class EffectSourceMismatch extends Schema.TaggedError<EffectSourceMismatch>()(
  "EffectSourceMismatch",
  { detail: Schema.String }
) {}

class EffectSourceUsageError extends Schema.TaggedError<EffectSourceUsageError>()(
  "EffectSourceUsageError",
  { detail: Schema.String }
) {}

/** Collects one command stream without leaving a child process unscoped. */
function collectText(stream: Stream.Stream<Uint8Array, PlatformError>) {
  return stream.pipe(
    Stream.decodeText(),
    Stream.runFold("", (output, chunk) => output + chunk)
  );
}

/** Translates one platform command failure into the CLI error contract. */
function gitPlatformError(error: PlatformError) {
  return new EffectSourceGitError({ detail: error.message });
}

/** Runs Git with structured concurrency and preserves non-zero diagnostics. */
const runGit = Effect.fn("EffectSource.runGit")((args: readonly string[]) =>
  Effect.scoped(
    Effect.gen(function* () {
      const command = yield* Command.start(Command.make("git", ...args)).pipe(
        Effect.mapError(gitPlatformError)
      );
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
          detail: `git ${args.join(" ")}: ${diagnostic}`,
        });
      }

      return stdout;
    })
  )
);

/** Reads and validates one package version through the platform filesystem. */
const readVersion = Effect.fn("EffectSource.readVersion")(function* (
  path: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const source = yield* fileSystem
    .readFileString(path)
    .pipe(
      Effect.mapError(
        (error) => new EffectSourceReadError({ detail: error.message })
      )
    );
  const input = yield* Effect.try({
    catch: () =>
      new EffectSourceReadError({
        detail: `${path} does not contain valid JSON.`,
      }),
    try: (): unknown => JSON.parse(source),
  });

  return yield* Schema.decodeUnknown(PackageManifest)(input).pipe(
    Effect.mapError(
      () =>
        new EffectSourceReadError({
          detail: `${path} does not contain a valid Effect version.`,
        })
    ),
    Effect.map((manifest) => manifest.version)
  );
});

/** Reads the installed and vendored versions after checking source cleanliness. */
const inspectSource = Effect.fn("EffectSource.inspect")(function* (
  config: EffectSourceConfig
) {
  const sourceStatus = yield* runGit([
    "status",
    "--porcelain",
    "--",
    config.sourcePath,
  ]);

  if (sourceStatus.trim()) {
    return yield* new EffectSourceMismatch({
      detail: `${config.sourcePath} has local changes; treat vendored source as read-only.`,
    });
  }

  const installedVersion = yield* readVersion(config.installedManifest);
  const vendoredVersion = yield* readVersion(config.vendoredManifest);
  return { installedVersion, vendoredVersion };
});

/** Fails when the checked-in source does not match the installed package. */
const checkSource = Effect.fn("EffectSource.check")(function* (
  config: EffectSourceConfig
) {
  const state = yield* inspectSource(config);

  if (state.installedVersion !== state.vendoredVersion) {
    return yield* new EffectSourceMismatch({
      detail: `Installed Effect is ${state.installedVersion}, but ${config.sourcePath} is ${state.vendoredVersion}. Commit dependency changes, then run pnpm effect:source:update.`,
    });
  }

  yield* Effect.log(
    `Effect source ${state.vendoredVersion} matches the installed package.`
  );
  return state;
});

/** Requires a named branch and clean worktree before Git subtree commits. */
const requireCleanWorktree = Effect.fn("EffectSource.requireClean")(
  function* () {
    yield* runGit(["symbolic-ref", "--quiet", "--short", "HEAD"]);
    const status = yield* runGit(["status", "--porcelain"]);

    if (status.trim()) {
      return yield* new EffectSourceMismatch({
        detail:
          "Effect source updates require a clean worktree. Commit dependency changes first.",
      });
    }
  }
);

/** Pulls the release tag matching the installed Effect package. */
const updateSource = Effect.fn("EffectSource.update")(function* (
  config: EffectSourceConfig
) {
  yield* requireCleanWorktree();
  const state = yield* inspectSource(config);

  if (state.installedVersion === state.vendoredVersion) {
    yield* Effect.log(
      `Effect source ${state.vendoredVersion} is already current.`
    );
    return;
  }

  const tag = `effect@${state.installedVersion}`;
  yield* runGit([
    "subtree",
    "pull",
    `--prefix=${config.sourcePath}`,
    config.repository,
    tag,
    "--squash",
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
      detail: "Usage: node scripts/effect-source.ts <check|update>",
    });
  }
);

NodeRuntime.runMain(
  makeEffectSourceProgram(process.argv[2]).pipe(
    Effect.provide(NodeContext.layer)
  )
);
