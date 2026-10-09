import { Array as Arr, Effect, FileSystem, Path, Schema } from "effect";

/**
 * Repository-relative files that the owner of this check shares with every
 * repository that runs it. A repository that holds one of them keeps an exact
 * copy of the owner's file.
 */
export const SHARED_FILES = [
  "scripts/osv",
  "scripts/provenance/schema.ts",
  "scripts/provenance/bundle.ts",
  "scripts/provenance/verify.ts",
] as const;

/** Expected failure while reading a shared file that the check must compare. */
export class SharedFileError extends Schema.TaggedError<SharedFileError>()(
  "SharedFileError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Reads the bytes of one shared file, failing with a typed error that names the reason. */
const readShared = Effect.fn("RepositoryPolicy.readSharedFile")(function* (
  filePath: string,
  message: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem
    .readFile(filePath)
    .pipe(Effect.mapError((cause) => new SharedFileError({ cause, message })));
});

/**
 * Compares one shared file that `root` holds with the owner's copy, byte for
 * byte. A file that `root` does not hold is not compared.
 */
const inspectSharedFile = Effect.fn("RepositoryPolicy.inspectSharedFile")(
  function* (root: string, owner: string, file: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const local = path.join(root, file);
    if (!(yield* fileSystem.exists(local))) {
      return [];
    }
    const copy = yield* readShared(
      local,
      `${file} cannot be read in this repository, so it cannot be compared with the owner's copy.`
    );
    const ownerCopy = yield* readShared(
      path.join(owner, file),
      `${file} of the repository that owns this check is missing or unreadable, so its copy cannot be compared.`
    );
    return Buffer.from(copy).equals(ownerCopy)
      ? []
      : [
          `${file} differs from the copy in the repository that owns this check: change that copy first, then copy it here.`,
        ];
  }
);

/**
 * Compares the shared files of the repository at `root` with the owner's copies
 * at `owner`, and returns one finding line per divergent file. When both
 * folders resolve to the same place, the repository judges itself and nothing
 * is compared. A shared file that `root` does not hold is not a finding, since
 * a repository may not use that tool. A missing owner copy is a typed failure.
 */
export const inspectSharedFiles = Effect.fn(
  "RepositoryPolicy.inspectSharedFiles"
)(function* (root: string, owner: string) {
  const path = yield* Path.Path;
  if (path.resolve(root) === path.resolve(owner)) {
    return [];
  }
  const findings = yield* Effect.forEach(SHARED_FILES, (file) =>
    inspectSharedFile(root, owner, file)
  );
  return Arr.flatten(findings);
});
