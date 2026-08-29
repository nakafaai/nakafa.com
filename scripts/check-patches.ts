import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, Schema } from "effect";
import { writeError, writeOutput } from "#scripts/output";

const PATCHED_DEPENDENCIES_PATTERN = /^patchedDependencies:/mu;
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "repos",
]);

/** Expected failure while inspecting application dependency patches. */
class PatchPolicyReadError extends Schema.TaggedError<PatchPolicyReadError>()(
  "PatchPolicyReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Collects application-owned patch files without entering generated source. */
const readApplicationPatchFiles = Effect.fn(
  "RepositoryPolicy.readApplicationPatches"
)(function* (root: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const patchFiles: string[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    const entries = yield* fileSystem.readDirectory(current).pipe(
      Effect.mapError(
        (cause) =>
          new PatchPolicyReadError({
            cause,
            message: `Unable to read ${current}.`,
          })
      )
    );
    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry)) {
        continue;
      }

      const entryPath = path.join(current, entry);
      const info = yield* fileSystem.stat(entryPath).pipe(
        Effect.mapError(
          (cause) =>
            new PatchPolicyReadError({
              cause,
              message: `Unable to inspect ${entryPath}.`,
            })
        )
      );
      if (info.type === "Directory") {
        pending.push(entryPath);
      } else if (entry.endsWith(".patch")) {
        patchFiles.push(path.relative(root, entryPath));
      }
    }
  }

  return patchFiles.sort();
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

if (import.meta.main) {
  NodeRuntime.runMain(
    checkPatchPolicy(process.cwd()).pipe(
      Effect.tap((status) =>
        status === 0
          ? Effect.void
          : Effect.sync(() => {
              process.exitCode = status;
            })
      ),
      Effect.provide(NodeServices.layer)
    )
  );
}
