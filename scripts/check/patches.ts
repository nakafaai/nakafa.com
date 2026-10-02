import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  Order,
  Path,
  Result,
} from "effect";
import { readRepositoryFiles } from "#scripts/check/files";
import { runEntry } from "#scripts/entry";
import { writeError, writeOutput } from "#scripts/output";

const PATCH_FILE_PATTERN = /\.patch$/u;
const PATCHED_DEPENDENCIES_PATTERN = /^patchedDependencies:/mu;
/** Directories that never hold application patches; `.cache` holds live runtime state. */
const IGNORED_DIRECTORIES = HashSet.make(
  ".cache",
  ".git",
  ".next",
  ".turbo",
  ".venv",
  "coverage",
  "dist",
  "node_modules",
  "repos"
);

/** Collects application-owned patch files without entering generated source. */
const readApplicationPatchFiles = Effect.fn(
  "RepositoryPolicy.readApplicationPatches"
)(function* (root: string) {
  const path = yield* Path.Path;
  const files = yield* readRepositoryFiles(root, IGNORED_DIRECTORIES);
  return Arr.sort(
    Arr.filterMap(files, (file) =>
      PATCH_FILE_PATTERN.test(file)
        ? Result.succeed(path.relative(root, file))
        : Result.failVoid
    ),
    Order.String
  );
});

/** Validates that application dependency patches remain absent. */
export const checkPatchPolicy = Effect.fn("RepositoryPolicy.checkPatches")(
  function* (root: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const [patchFiles, workspace] = yield* Effect.all([
      readApplicationPatchFiles(root),
      fileSystem.readFileString(path.join(root, "pnpm-workspace.yaml")),
    ]);
    const failures = Arr.appendAll(
      Arr.isReadonlyArrayEmpty(patchFiles)
        ? []
        : [
            `Application dependency patches require explicit review: ${Arr.join(patchFiles, ", ")}.`,
          ],
      PATCHED_DEPENDENCIES_PATTERN.test(workspace)
        ? ["pnpm-workspace.yaml must not register dependency patches."]
        : []
    );

    if (!Arr.isReadonlyArrayEmpty(failures)) {
      yield* writeError(`${Arr.join(failures, "\n")}\n`);
      return 1;
    }

    yield* writeOutput("No application dependency patches are registered.\n");
    return 0;
  }
);

runEntry(import.meta.main, checkPatchPolicy(process.cwd()));
