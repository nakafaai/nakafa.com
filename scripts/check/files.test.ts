import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  ByteSize,
  Effect,
  FileSystem,
  HashSet,
  Layer,
  Option,
  Path,
  PlatformError,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import {
  RepositoryIgnoreError,
  RepositoryReadError,
  readAuthoredTree,
  readRepositoryFiles,
} from "#scripts/check/files";

/** Metadata for one stubbed entry; only its type matters to the walk. */
function info(type: FileSystem.File.Type): FileSystem.File.Info {
  return {
    atime: Option.none(),
    birthtime: Option.none(),
    blksize: Option.none(),
    blocks: Option.none(),
    dev: 0n,
    gid: Option.none(),
    ino: Option.none(),
    mode: 0,
    mtime: Option.none(),
    nlink: Option.none(),
    rdev: Option.none(),
    size: ByteSize.bytes(0),
    type,
    uid: Option.none(),
  };
}

/** A file system whose listed entries can vanish or fail before inspection. */
function racingFileSystem(
  failure: PlatformError.SystemErrorTag
): Layer.Layer<FileSystem.FileSystem | Path.Path> {
  const error = (method: string, path: string) =>
    PlatformError.systemError({
      _tag: failure,
      method,
      module: "FileSystem",
      pathOrDescriptor: path,
    });
  const directories: Record<string, readonly string[]> = {
    "/repo": ["journal", "gone", "lesson.patch"],
  };
  return Layer.mergeAll(
    FileSystem.layerNoop({
      readDirectory: (path) =>
        path in directories
          ? Effect.succeed([...(directories[path] ?? [])])
          : Effect.fail(error("readDirectory", path)),
      stat: (path) => {
        if (path === "/repo/journal") {
          return Effect.fail(error("stat", path));
        }
        return Effect.succeed(
          info(path === "/repo/gone" ? "Directory" : "File")
        );
      },
    }),
    Path.layer
  );
}

describe("repository files", () => {
  it.effect("collects nested files and skips ignored directories", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "repository-files-",
      });
      yield* fileSystem.makeDirectory(`${root}/packages/app/src`, {
        recursive: true,
      });
      yield* fileSystem.makeDirectory(`${root}/.cache/acceptance`, {
        recursive: true,
      });
      yield* fileSystem.writeFileString(`${root}/packages/app/src/a.ts`, "");
      yield* fileSystem.writeFileString(`${root}/fix.patch`, "");
      yield* fileSystem.writeFileString(`${root}/.cache/acceptance/db`, "");
      const files = yield* readRepositoryFiles(root, HashSet.make(".cache"));
      expect(files).toEqual([
        `${root}/fix.patch`,
        `${root}/packages/app/src/a.ts`,
      ]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("skips entries that vanish while the walk runs", () =>
    Effect.gen(function* () {
      const files = yield* readRepositoryFiles("/repo", HashSet.empty());
      expect(files).toEqual(["/repo/lesson.patch"]);
    }).pipe(Effect.provide(racingFileSystem("NotFound")))
  );

  it.effect("fails with a typed error when an entry cannot be read", () =>
    Effect.gen(function* () {
      const failure = yield* readRepositoryFiles("/repo", HashSet.empty()).pipe(
        Effect.flip
      );
      expect(failure).toBeInstanceOf(RepositoryReadError);
      expect(failure.message).toBe("Unable to inspect /repo/journal.");
      const locked = yield* readRepositoryFiles(
        "/locked",
        HashSet.empty()
      ).pipe(Effect.flip);
      expect(locked.message).toBe("Unable to read /locked.");
    }).pipe(Effect.provide(racingFileSystem("PermissionDenied")))
  );
});

/** Runs one Git command in a fixture folder and answers its exit code. */
function git(cwd: string, args: readonly string[]) {
  return Effect.scoped(
    Effect.flatMap(
      ChildProcess.make("git", args, { cwd }),
      (command) => command.exitCode
    )
  );
}

/** Writes a fixture with an app module, a Python environment named by its tool, and a log, under `root`. */
const writeFixture = Effect.fn("test.files.writeFixture")(function* (
  root: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const environment = `${root}/apps/cas/.venv/lib/basedpyright`;
  yield* fileSystem.makeDirectory(environment, { recursive: true });
  yield* fileSystem.writeFileString(`${root}/.gitignore`, ".venv/\n*.log\n");
  yield* fileSystem.writeFileString(`${environment}/index.js`, "");
  yield* fileSystem.writeFileString(`${root}/apps/cas/entry.ts`, "");
  yield* fileSystem.writeFileString(`${root}/apps/cas/run.log`, "");
});

/** Reads the workspace files of the tree at `root`, relative to it. */
const readWorkspaces = Effect.fn("test.files.readWorkspaces")(function* (
  root: string
) {
  const path = yield* Path.Path;
  const { workspaces } = yield* readAuthoredTree(root);
  return Arr.map(workspaces, (file) => path.relative(root, file));
});

/** Rewrites the Git command whose first argument is `name`, and runs every other one as it is. */
function rewriteGit(name: string, rewrite: ChildProcess.Command) {
  return Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      return ChildProcessSpawner.make((command) =>
        spawner.spawn(
          ChildProcess.isStandardCommand(command) && command.args[0] === name
            ? rewrite
            : command
        )
      );
    })
  ).pipe(Layer.provide(NodeServices.layer));
}

describe("authored tree", () => {
  it.effect(
    "leaves out what Git ignores, such as a Python environment whose tool names a module index.js",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const root = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "nakafa-ignored-",
        });
        expect(yield* git(root, ["init", "-q"])).toBe(0);
        yield* writeFixture(root);
        expect(yield* readWorkspaces(root)).toEqual(["apps/cas/entry.ts"]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("reads every file of a folder outside a Git checkout", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "nakafa-unversioned-",
      });
      yield* writeFixture(root);
      expect(yield* readWorkspaces(root)).toEqual([
        "apps/cas/.venv/lib/basedpyright/index.js",
        "apps/cas/entry.ts",
        "apps/cas/run.log",
      ]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect(
    "fails with a typed error when Git cannot list what it ignores",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const root = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "nakafa-ignored-",
        });
        expect(yield* git(root, ["init", "-q"])).toBe(0);
        const refused = yield* readAuthoredTree(root).pipe(
          Effect.provide(
            rewriteGit(
              "ls-files",
              ChildProcess.make("git", ["ls-files", "--refused-option"], {
                cwd: root,
              })
            )
          ),
          Effect.flip
        );
        expect(refused).toBeInstanceOf(RepositoryIgnoreError);
        expect(refused.message).toContain(
          "git ls-files -z --others --ignored --exclude-standard --directory:"
        );
        const missing = yield* readAuthoredTree(root).pipe(
          Effect.provide(
            rewriteGit(
              "rev-parse",
              ChildProcess.make("nakafa-missing-git", [], { cwd: root })
            )
          ),
          Effect.flip
        );
        expect(missing.message).toContain(
          "git rev-parse --is-inside-work-tree:"
        );
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
