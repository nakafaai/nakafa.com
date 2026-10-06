import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  ByteSize,
  Effect,
  FileSystem,
  HashSet,
  Layer,
  Option,
  Path,
  PlatformError,
} from "effect";
import { RepositoryReadError, readRepositoryFiles } from "#scripts/check/files";

/** Metadata for one stubbed entry; only its type matters to the walk. */
function info(type: FileSystem.File.Type): FileSystem.File.Info {
  return {
    atime: Option.none(),
    birthtime: Option.none(),
    blksize: Option.none(),
    blocks: Option.none(),
    dev: 0,
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
