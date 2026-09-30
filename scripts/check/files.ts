import { Effect, FileSystem, Option, Path, Schema } from "effect";

/** Expected failure while reading the repository tree. */
export class RepositoryReadError extends Schema.TaggedError<RepositoryReadError>()(
  "RepositoryReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/**
 * Collects every file below `directory`, skipping `ignored` directory names.
 * An entry removed while the walk runs, such as the journal of a live local
 * database, is not part of the tree, so the walk skips it instead of failing.
 */
export const readRepositoryFiles = Effect.fn("RepositoryPolicy.readFiles")(
  function* (directory: string, ignored: ReadonlySet<string>) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const files: string[] = [];
    const pending = [directory];

    for (let current = pending.pop(); current; current = pending.pop()) {
      const entries = yield* fileSystem.readDirectory(current).pipe(
        Effect.catchReason("PlatformError", "NotFound", () =>
          Effect.succeed([])
        ),
        Effect.mapError(
          (cause) =>
            new RepositoryReadError({
              cause,
              message: `Unable to read ${current}.`,
            })
        )
      );
      for (const entry of entries) {
        if (ignored.has(entry)) {
          continue;
        }
        const entryPath = path.join(current, entry);
        const info = yield* fileSystem.stat(entryPath).pipe(
          Effect.asSome,
          Effect.catchReason(
            "PlatformError",
            "NotFound",
            () => Effect.succeedNone
          ),
          Effect.mapError(
            (cause) =>
              new RepositoryReadError({
                cause,
                message: `Unable to inspect ${entryPath}.`,
              })
          )
        );
        if (Option.isNone(info)) {
          continue;
        }
        if (info.value.type === "Directory") {
          pending.push(entryPath);
        } else {
          files.push(entryPath);
        }
      }
    }

    return files;
  }
);
