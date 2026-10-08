import { NodeServices } from "@effect/platform-node";
import { assert, describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Layer,
  Path,
  PlatformError,
  Record as Rec,
  Schema,
  Stream,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import {
  type EffectSourceConfig,
  makeEffectSourceProgram,
  SourceIdentity,
} from "#scripts/effect/source";

class GitFixtureError extends Schema.TaggedError<GitFixtureError>()(
  "GitFixtureError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

const IDENTITY = "scripts/effect/source.json";
const INSTALLED = "node_modules/effect/package.json";
const STAGED_TREE = "0123456789abcdef0123456789abcdef01234567";
const OUTSIDE_REPOSITORY =
  /^git status --porcelain -- repos\/effect scripts\/effect\/source\.json: fatal: /u;

const PackageManifestJson = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, version: Schema.String }),
  { space: 2 }
);
const SourceIdentityJson = Schema.fromJsonString(SourceIdentity, { space: 2 });
// Accepts any commit or tree text: a fixture may record an invalid identity.
const UncheckedSourceIdentityJson = Schema.fromJsonString(
  Schema.Struct({
    ...SourceIdentity.fields,
    commit: Schema.String,
    tree: Schema.String,
  }),
  { space: 2 }
);

const packageManifest = (version: string) =>
  `${Schema.encodeSync(PackageManifestJson)({ name: "effect", version })}\n`;

const sourceIdentity = (commit: string, tag: string, tree: string) =>
  `${Schema.encodeSync(SourceIdentityJson)({ commit, tag, tree })}\n`;

/** Runs Git in one child process and returns its trimmed standard output. */
const runGit = Effect.fn("EffectSourceTest.runGit")(function* (
  cwd: string,
  args: readonly string[]
) {
  const message = `git ${Arr.join(args, " ")} failed`;
  const [exitCode, stdout] = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("git", args, {
        cwd,
        stderr: "inherit",
      });
      return yield* Effect.all(
        [handle.exitCode, Stream.mkString(Stream.decodeText(handle.stdout))],
        { concurrency: 2 }
      );
    })
  ).pipe(Effect.mapError((cause) => new GitFixtureError({ cause, message })));
  if (exitCode !== 0) {
    return yield* new GitFixtureError({ cause: exitCode, message });
  }
  return stdout.trim();
});

/** Writes fixture files below one repository root. */
const writeFiles = Effect.fn("EffectSourceTest.writeFiles")(function* (
  root: string,
  files: Record<string, string>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const [file, content] of Rec.toEntries(files)) {
    const filePath = path.join(root, file);
    yield* fileSystem.makeDirectory(path.dirname(filePath), {
      recursive: true,
    });
    yield* fileSystem.writeFileString(filePath, content);
  }
});

/** Writes and commits fixture files, returning the new commit. */
const commitFiles = Effect.fn("EffectSourceTest.commitFiles")(function* (
  repository: string,
  files: Record<string, string>
) {
  yield* writeFiles(repository, files);
  yield* runGit(repository, ["add", "--all"]);
  yield* runGit(repository, ["commit", "-m", "update fixture"]);
  return yield* runGit(repository, ["rev-parse", "HEAD"]);
});

/** Initializes one fixture repository with a stable author. */
const initRepository = Effect.fn("EffectSourceTest.initRepository")(function* (
  repository: string,
  files: Record<string, string>
) {
  yield* writeFiles(repository, files);
  yield* runGit(repository, ["init", "--initial-branch=main"]);
  // Git starts detached maintenance after a commit. A fixture repository lives
  // in a scoped temporary folder, so nothing may still write into it when the
  // scope removes that folder.
  yield* runGit(repository, ["config", "gc.auto", "0"]);
  yield* runGit(repository, ["config", "maintenance.auto", "false"]);
  yield* runGit(repository, ["config", "user.name", "Source Fixture"]);
  yield* runGit(repository, [
    "config",
    "user.email",
    "source-fixture@example.com",
  ]);
  return yield* commitFiles(repository, {});
});

/**
 * Creates an upstream with Effect 1.0.0 and 2.0.0 releases and a consumer
 * whose committed vendored source and installed package are Effect 1.0.0.
 */
const makeRepositories = Effect.fn("EffectSourceTest.makeRepositories")(
  function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const root = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "effect-source-test-",
    });
    const upstream = `${root}/upstream`;
    const consumer = `${root}/consumer`;

    const oldCommit = yield* initRepository(upstream, {
      "README.md": "one\n",
      "obsolete.txt": "remove me\n",
      "packages/effect/package.json": packageManifest("1.0.0"),
    });
    const oldTree = yield* runGit(upstream, ["rev-parse", "HEAD^{tree}"]);
    yield* fileSystem.remove(`${upstream}/obsolete.txt`);
    const newCommit = yield* commitFiles(upstream, {
      "README.md": "two\n",
      "current.txt": "keep\n",
      "packages/effect/package.json": packageManifest("2.0.0"),
    });
    yield* runGit(upstream, ["tag", "effect@2.0.0"]);
    const newTree = yield* runGit(upstream, ["rev-parse", "HEAD^{tree}"]);

    yield* initRepository(consumer, {
      [IDENTITY]: sourceIdentity(oldCommit, "effect@1.0.0", oldTree),
      [INSTALLED]: packageManifest("1.0.0"),
      "repos/effect/README.md": "one\n",
      "repos/effect/obsolete.txt": "remove me\n",
      "repos/effect/packages/effect/package.json": packageManifest("1.0.0"),
    });

    const config: EffectSourceConfig = {
      identityManifest: IDENTITY,
      installedManifest: INSTALLED,
      repository: upstream,
      repositoryRoot: consumer,
      sourcePath: "repos/effect",
      vendoredManifest: "repos/effect/packages/effect/package.json",
    };
    return {
      config,
      consumer,
      identityManifest: `${consumer}/${IDENTITY}`,
      installedManifest: `${consumer}/${INSTALLED}`,
      newCommit,
      newTree,
      oldCommit,
      oldTree,
      root,
    };
  }
);

type Fixture = Effect.Success<ReturnType<typeof makeRepositories>>;

/** Commits an Effect 2.0.0 install so an update has work to do. */
const installNextRelease = (fixture: Fixture) =>
  commitFiles(fixture.consumer, { [INSTALLED]: packageManifest("2.0.0") });

/** Delegates to Node services except for one unwritable file. */
function unwritableFile(unwritablePath: string) {
  return Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const service: FileSystem.FileSystem = {
        ...fileSystem,
        writeFileString: (path, data, options) =>
          path === unwritablePath
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "PermissionDenied",
                  method: "writeFileString",
                  module: "FileSystem",
                  pathOrDescriptor: path,
                })
              )
            : fileSystem.writeFileString(path, data, options),
      };
      return service;
    })
  ).pipe(Layer.provide(NodeServices.layer));
}

/** Answers the staged source tree query with another Git object id. */
function stagedSourceTree(tree: string) {
  return Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      return ChildProcessSpawner.make((command) =>
        spawner.spawn(
          ChildProcess.isStandardCommand(command) &&
            command.args[0] === "rev-parse" &&
            command.args[1]?.endsWith(":repos/effect") === true &&
            !command.args[1].startsWith("HEAD:")
            ? ChildProcess.make("git", ["rev-parse", tree], command.options)
            : command
        )
      );
    })
  ).pipe(Layer.provide(NodeServices.layer));
}

/** Answers the upstream commit query with an abbreviated Git object id. */
function abbreviatedUpstreamCommit(commit: string) {
  return Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      return ChildProcessSpawner.make((command) =>
        spawner.spawn(
          ChildProcess.isStandardCommand(command) &&
            command.args[0] === "rev-parse" &&
            command.args[1] === "FETCH_HEAD^{commit}"
            ? ChildProcess.make(
                "git",
                ["rev-parse", "--short", commit],
                command.options
              )
            : command
        )
      );
    })
  ).pipe(Layer.provide(NodeServices.layer));
}

describe("Effect source identity", () => {
  it.effect(
    "updates linearly and remains valid after its subtree history is squashed",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const fixture = yield* makeRepositories();
        const { config, consumer } = fixture;
        const dependencyHead = yield* installNextRelease(fixture);

        yield* makeEffectSourceProgram("update", config);

        const updatedHead = yield* runGit(consumer, ["rev-parse", "HEAD"]);
        const identity = yield* fileSystem.readFileString(
          fixture.identityManifest
        );
        expect(
          yield* runGit(consumer, ["show", "-s", "--format=%P", updatedHead])
        ).toBe(dependencyHead);
        expect(
          yield* runGit(consumer, ["rev-parse", "HEAD:repos/effect"])
        ).toBe(fixture.newTree);
        expect(
          yield* runGit(consumer, ["show", "-s", "--format=%B", updatedHead])
        ).toContain(`git-subtree-split: ${fixture.newCommit}`);
        // Excess keys fail the decode, so toEqual also proves the exact key set.
        expect(
          yield* Schema.decodeEffect(SourceIdentityJson)(identity, {
            onExcessProperty: "error",
          })
        ).toEqual({
          commit: fixture.newCommit,
          tag: "effect@2.0.0",
          tree: fixture.newTree,
        });
        expect(yield* runGit(consumer, ["status", "--porcelain"])).toBe("");

        const finalTree = yield* runGit(consumer, ["rev-parse", "HEAD^{tree}"]);
        const squashedHead = yield* runGit(consumer, [
          "commit-tree",
          finalTree,
          "-m",
          "squashed migration",
        ]);
        const branchRef = yield* runGit(consumer, [
          "symbolic-ref",
          "--quiet",
          "HEAD",
        ]);
        yield* runGit(consumer, [
          "update-ref",
          branchRef,
          squashedHead,
          updatedHead,
        ]);

        expect(
          yield* runGit(consumer, [
            "log",
            "--format=%H",
            "--fixed-strings",
            "--grep=git-subtree-dir:",
          ])
        ).toBe("");
        yield* makeEffectSourceProgram("check", config);
      }).pipe(Effect.provide(NodeServices.layer)),
    30_000
  );

  it.effect("checks the repository's own vendored source by default", () =>
    makeEffectSourceProgram("check").pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("leaves a current source unchanged", () =>
    Effect.gen(function* () {
      const { config, consumer } = yield* makeRepositories();
      const head = yield* runGit(consumer, ["rev-parse", "HEAD"]);
      yield* makeEffectSourceProgram("update", config);
      assert.strictEqual(yield* runGit(consumer, ["rev-parse", "HEAD"]), head);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect.each([
    {
      action: "check",
      change: (fixture: Fixture) =>
        writeFiles(fixture.consumer, { "repos/effect/README.md": "edited\n" }),
      error: "EffectSourceMismatch",
      message: () =>
        "repos/effect or scripts/effect/source.json has local changes.",
      name: "local vendored edits",
    },
    {
      action: "check",
      change: (fixture: Fixture) =>
        commitFiles(fixture.consumer, {
          [IDENTITY]: sourceIdentity(
            fixture.oldCommit,
            "effect@1.0.0",
            fixture.newTree
          ),
        }),
      error: "EffectSourceMismatch",
      message: (fixture: Fixture) =>
        `repos/effect differs from tree ${fixture.newTree}.`,
      name: "a recorded tree drift",
    },
    {
      action: "check",
      change: (fixture: Fixture) =>
        commitFiles(fixture.consumer, {
          [IDENTITY]: sourceIdentity(
            fixture.oldCommit,
            "effect@0.9.0",
            fixture.oldTree
          ),
        }),
      error: "EffectSourceMismatch",
      message: () =>
        "scripts/effect/source.json records effect@0.9.0, but vendored source is effect@1.0.0.",
      name: "a recorded tag drift",
    },
    {
      action: "check",
      change: installNextRelease,
      error: "EffectSourceMismatch",
      message: () =>
        "Installed Effect is 2.0.0, but repos/effect is 1.0.0. Commit dependency changes, then run pnpm effect:source:update.",
      name: "an installed release ahead of the vendored source",
    },
    {
      action: "check",
      change: (fixture) => writeFiles(fixture.consumer, { [INSTALLED]: "{" }),
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `${fixture.installedManifest} does not contain valid JSON.`,
      name: "an installed manifest without JSON",
    },
    {
      action: "check",
      change: (fixture: Fixture) =>
        writeFiles(fixture.consumer, {
          [INSTALLED]: packageManifest("latest"),
        }),
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `${fixture.installedManifest} does not contain a valid Effect version.`,
      name: "an installed manifest without a version",
    },
    {
      action: "check",
      change: (fixture: Fixture) =>
        commitFiles(fixture.consumer, {
          [IDENTITY]: `${Schema.encodeSync(UncheckedSourceIdentityJson)({
            commit: "HEAD",
            tag: "effect@1.0.0",
            tree: "HEAD",
          })}\n`,
        }),
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `${fixture.identityManifest} does not contain a valid Effect source identity.`,
      name: "an identity without immutable Git objects",
    },
    {
      action: "update",
      change: (fixture: Fixture) =>
        writeFiles(fixture.consumer, { "notes.txt": "unrelated\n" }),
      error: "EffectSourceMismatch",
      message: () =>
        "Effect source updates require a clean worktree. Commit dependency changes first.",
      name: "an update from a dirty worktree",
    },
    ...Arr.map([undefined, "sync"], (action) => ({
      action,
      change: () => Effect.void,
      error: "EffectSourceUsageError",
      message: () => "Usage: node scripts/effect/source.ts <check|update>",
      name: `the ${String(action)} action`,
    })),
  ])("rejects $name", ({ action, change, error, message }) =>
    Effect.gen(function* () {
      const fixture = yield* makeRepositories();
      yield* change(fixture);
      const failure = yield* makeEffectSourceProgram(
        action,
        fixture.config
      ).pipe(Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.message],
        [error, message(fixture)]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports missing metadata and Git failures", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const fixture = yield* makeRepositories();
      const missingRoot = `${fixture.root}/missing`;
      const plainRoot = `${fixture.root}/plain`;
      yield* fileSystem.makeDirectory(plainRoot);
      yield* fileSystem.remove(fixture.installedManifest);
      const missing = yield* makeEffectSourceProgram(
        "check",
        fixture.config
      ).pipe(Effect.flip);
      yield* runGit(fixture.consumer, [
        "checkout",
        "--quiet",
        "--detach",
        "HEAD",
      ]);
      const [unavailable, outsideRepository, detached] = [
        yield* makeEffectSourceProgram("check", {
          ...fixture.config,
          repositoryRoot: missingRoot,
        }).pipe(Effect.flip),
        yield* makeEffectSourceProgram("check", {
          ...fixture.config,
          repositoryRoot: plainRoot,
        }).pipe(Effect.flip),
        yield* makeEffectSourceProgram("update", fixture.config).pipe(
          Effect.flip
        ),
      ];

      assert.strictEqual(missing._tag, "EffectSourceFileError");
      assert.include(missing.message, fixture.installedManifest);
      assert.strictEqual(unavailable._tag, "EffectSourceGitError");
      assert.include(unavailable.message, missingRoot);
      assert.strictEqual(outsideRepository._tag, "EffectSourceGitError");
      assert.match(outsideRepository.message, OUTSIDE_REPOSITORY);
      assert.deepStrictEqual(
        [detached._tag, detached.message],
        ["EffectSourceGitError", "git symbolic-ref --quiet HEAD: Git failed."]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect.each<{
    readonly error: string;
    readonly message: (fixture: Fixture) => string;
    readonly name: string;
    readonly update: (
      fixture: Fixture
    ) => Effect.Effect<
      unknown,
      { readonly _tag: string; readonly message: string },
      | ChildProcessSpawner.ChildProcessSpawner
      | FileSystem.FileSystem
      | Path.Path
    >;
  }>([
    {
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `PermissionDenied: FileSystem.writeFileString (${fixture.identityManifest})`,
      name: "the identity cannot be written",
      update: (fixture: Fixture) =>
        makeEffectSourceProgram("update", fixture.config).pipe(
          Effect.provide(unwritableFile(fixture.identityManifest))
        ),
    },
    {
      error: "EffectSourceMismatch",
      message: (fixture: Fixture) =>
        `Staged repos/effect is ${STAGED_TREE}, expected ${fixture.newTree}.`,
      name: "the staged tree differs from upstream",
      update: (fixture: Fixture) =>
        makeEffectSourceProgram("update", fixture.config).pipe(
          Effect.provide(stagedSourceTree(STAGED_TREE))
        ),
    },
    {
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `${fixture.identityManifest} cannot be written as an Effect source identity.`,
      name: "the upstream commit is not a full object id",
      update: (fixture: Fixture) =>
        makeEffectSourceProgram("update", fixture.config).pipe(
          Effect.provide(abbreviatedUpstreamCommit(fixture.newCommit))
        ),
    },
  ])("keeps the branch when $name", ({ error, message, update }) =>
    Effect.gen(function* () {
      const fixture = yield* makeRepositories();
      const head = yield* installNextRelease(fixture);
      const failure = yield* Effect.flip(update(fixture));

      assert.deepStrictEqual(
        [failure._tag, failure.message],
        [error, message(fixture)]
      );
      assert.strictEqual(
        yield* runGit(fixture.consumer, ["rev-parse", "HEAD"]),
        head
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
