import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  MutableList,
  Option,
  Order,
  Path,
  Schema,
  String as Str,
} from "effect";
import type { RepositorySource } from "#scripts/check/source";

/** Expected failure while reading the repository tree. */
export class RepositoryReadError extends Schema.TaggedError<RepositoryReadError>()(
  "RepositoryReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Directories that hold dependencies, tool output, or caches rather than authored files. */
const IGNORED_DIRECTORIES = HashSet.make(
  ".git",
  ".next",
  ".react-email",
  ".turbo",
  "coverage",
  "dist",
  "node_modules"
);
/** TypeScript modules in every flavor: `.ts`, `.tsx`, `.mts`, and `.cts`. */
const SOURCE_FILE_PATTERN = /\.[cm]?tsx?$/u;
const DECLARATION_FILE_PATTERN = /\.d\.[cm]?ts$/u;
const GENERATED_DIRECTORY = "_generated";

/**
 * Collects every file below `directory` in sorted order, skipping `ignored`
 * directory names. An entry removed while the walk runs, such as the journal
 * of a live local database, is not part of the tree, so the walk skips it
 * instead of failing.
 */
export const readRepositoryFiles = Effect.fn("RepositoryPolicy.readFiles")(
  function* (directory: string, ignored: HashSet.HashSet<string>) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const pending = MutableList.make<string>();
    const files = MutableList.make<string>();
    MutableList.append(pending, directory);

    for (
      let current = MutableList.take(pending);
      current !== MutableList.Empty;
      current = MutableList.take(pending)
    ) {
      const parent = current;
      const entries = yield* fileSystem.readDirectory(parent).pipe(
        Effect.catchReason("PlatformError", "NotFound", () =>
          Effect.succeed([])
        ),
        Effect.mapError((cause) =>
          RepositoryReadError.make({
            cause,
            message: `Unable to read ${parent}.`,
          })
        )
      );
      for (const entry of entries) {
        if (HashSet.has(ignored, entry)) {
          continue;
        }
        const entryPath = path.join(parent, entry);
        const info = yield* fileSystem.stat(entryPath).pipe(
          Effect.asSome,
          Effect.catchReason(
            "PlatformError",
            "NotFound",
            () => Effect.succeedNone
          ),
          Effect.mapError((cause) =>
            RepositoryReadError.make({
              cause,
              message: `Unable to inspect ${entryPath}.`,
            })
          )
        );
        if (Option.isSome(info)) {
          MutableList.append(
            info.value.type === "Directory" ? pending : files,
            entryPath
          );
        }
      }
    }

    return Arr.sort(MutableList.takeAll(files), Order.String);
  }
);

/** Reads the files of the authored workspaces and of the repository scripts. */
export const readAuthoredTree = Effect.fn("RepositoryPolicy.readAuthoredTree")(
  function* (root: string) {
    const path = yield* Path.Path;
    const read = (directory: string) =>
      readRepositoryFiles(path.join(root, directory), IGNORED_DIRECTORIES);
    const { apps, packages, scripts } = yield* Effect.all({
      apps: read("apps"),
      packages: read("packages"),
      scripts: read("scripts"),
    });
    return { scripts, workspaces: Arr.appendAll(apps, packages) };
  }
);

/**
 * Reads the authored TypeScript modules among `files` by repository-relative
 * path, leaving out declaration files and generated output.
 */
export const readAuthoredSources = Effect.fn(
  "RepositoryPolicy.readAuthoredSources"
)(function* (root: string, files: readonly string[]) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const authored = Arr.filter(
    files,
    (file) =>
      SOURCE_FILE_PATTERN.test(file) &&
      !DECLARATION_FILE_PATTERN.test(file) &&
      !Arr.contains(Str.split(file, path.sep), GENERATED_DIRECTORY)
  );
  return yield* Effect.forEach(authored, (file) =>
    fileSystem.readFileString(file).pipe(
      Effect.map((sourceText): typeof RepositorySource.Type => ({
        file: Arr.join(Str.split(path.relative(root, file), path.sep), "/"),
        sourceText,
      })),
      Effect.mapError((cause) =>
        RepositoryReadError.make({ cause, message: `Unable to read ${file}.` })
      )
    )
  );
});
