import { Effect, FileSystem, Path } from "effect";
import { readRepositoryFiles } from "#scripts/check/files";
import { runEntry } from "#scripts/entry";
import { writeError, writeOutput } from "#scripts/output";

const PATCHED_DEPENDENCIES_PATTERN = /^patchedDependencies:/mu;
/** Directories that never hold application patches; `.cache` holds live runtime state. */
const IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".git",
  ".next",
  ".turbo",
  ".venv",
  "coverage",
  "dist",
  "node_modules",
  "repos",
]);

/** Collects application-owned patch files without entering generated source. */
const readApplicationPatchFiles = Effect.fn(
  "RepositoryPolicy.readApplicationPatches"
)(function* (root: string) {
  const path = yield* Path.Path;
  const files = yield* readRepositoryFiles(root, IGNORED_DIRECTORIES);
  return files
    .filter((file) => file.endsWith(".patch"))
    .map((file) => path.relative(root, file))
    .sort();
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
    const failures: string[] = [];

    if (patchFiles.length > 0) {
      failures.push(
        `Application dependency patches require explicit review: ${patchFiles.join(", ")}.`
      );
    }
    if (PATCHED_DEPENDENCIES_PATTERN.test(workspace)) {
      failures.push(
        "pnpm-workspace.yaml must not register dependency patches."
      );
    }

    if (failures.length > 0) {
      yield* writeError(`${failures.join("\n")}\n`);
      return 1;
    }

    yield* writeOutput("No application dependency patches are registered.\n");
    return 0;
  }
);

runEntry(import.meta.main, checkPatchPolicy(process.cwd()));
