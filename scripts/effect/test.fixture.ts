import { NodeServices } from "@effect/platform-node";
import { assert } from "@effect/vitest";
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
  SourceIdentity,
} from "#scripts/effect/source";

export const IDENTITY = "scripts/effect/source.json";
export const INSTALLED = "node_modules/effect/package.json";
export const STAGED_TREE = "0123456789abcdef0123456789abcdef01234567";
export const OUTSIDE_REPOSITORY =
  /^git status --porcelain -- repos\/effect scripts\/effect\/source\.json: fatal: /u;

const PackageManifestJson = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, version: Schema.String }),
  { space: 2 }
);
export const SourceIdentityJson = Schema.fromJsonString(SourceIdentity, {
  space: 2,
});
// Accepts any commit or tree text: a fixture may record an invalid identity.
export const UncheckedSourceIdentityJson = Schema.fromJsonString(
  Schema.Struct({
    ...SourceIdentity.fields,
    commit: Schema.String,
    tree: Schema.String,
  }),
  { space: 2 }
);

export const packageManifest = (version: string) =>
  `${Schema.encodeSync(PackageManifestJson)({ name: "effect", version })}\n`;

export const sourceIdentity = (commit: string, tag: string, tree: string) =>
  `${Schema.encodeSync(SourceIdentityJson)({ commit, tag, tree })}\n`;

/**
 * Runs Git in one child process and returns its trimmed standard output. A
 * fixture command that cannot run or exits with another code fails the test.
 */
export const runGit = Effect.fn("EffectSourceTest.runGit")(function* (
  cwd: string,
  args: readonly string[]
) {
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
  );
  assert.strictEqual(exitCode, 0, `git ${Arr.join(args, " ")} failed`);
  return stdout.trim();
}, Effect.orDie);

/** Writes fixture files below one repository root. */
export const writeFiles = Effect.fn("EffectSourceTest.writeFiles")(function* (
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
export const commitFiles = Effect.fn("EffectSourceTest.commitFiles")(function* (
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
export const makeRepositories = Effect.fn("EffectSourceTest.makeRepositories")(
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

export type Fixture = Effect.Success<ReturnType<typeof makeRepositories>>;

/** Commits an Effect 2.0.0 install so an update has work to do. */
export const installNextRelease = (fixture: Fixture) =>
  commitFiles(fixture.consumer, { [INSTALLED]: packageManifest("2.0.0") });

/** Delegates to Node services, except that no text file can be written. */
export const unwritableFiles = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const service: FileSystem.FileSystem = {
      ...fileSystem,
      writeFileString: (path) =>
        Effect.fail(
          PlatformError.systemError({
            _tag: "PermissionDenied",
            method: "writeFileString",
            module: "FileSystem",
            pathOrDescriptor: path,
          })
        ),
    };
    return service;
  })
).pipe(Layer.provide(NodeServices.layer));

/** Answers the staged source tree query with another Git object id. */
export function stagedSourceTree(tree: string) {
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
export function abbreviatedUpstreamCommit(commit: string) {
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
