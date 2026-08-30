import { Effect, FileSystem, Path, Redacted } from "effect";
import { queueGateError } from "#scripts/github/queue/admission";
import { runCommand } from "#scripts/github/queue/command";

/** Requires the pinned Changesets CLI to reproduce the release tree exactly. */
export const validateReleaseReplay = Effect.fn(
  "QueueGate.validateReleaseReplay"
)(function* (generatedTree: string, sourceTree: string) {
  if (generatedTree !== sourceTree) {
    return yield* queueGateError(
      "Generated release tree does not match the exact Changesets replay."
    );
  }
});

/** Replays the immutable base release with the pinned CLI and GitHub evidence. */
export const replayRelease = Effect.fn("QueueGate.replayRelease")(function* (
  repositoryRoot: string,
  baseSha: string,
  sourceHead: string,
  token: Redacted.Redacted
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporaryRoot = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "nakafa-release-replay-",
  });
  const checkout = path.join(temporaryRoot, "checkout");
  yield* runCommand(repositoryRoot, "git", [
    "clone",
    "--shared",
    "--no-checkout",
    repositoryRoot,
    checkout,
  ]);
  yield* runCommand(checkout, "git", ["checkout", "--detach", baseSha]);
  yield* runCommand(checkout, "git", ["branch", "--force", "main", baseSha]);

  const linkedModules = path.join(checkout, "node_modules");
  yield* fileSystem
    .symlink(path.join(repositoryRoot, "node_modules"), linkedModules)
    .pipe(
      Effect.mapError((cause) =>
        queueGateError(
          "Unable to expose the pinned release toolchain to the replay.",
          cause
        )
      )
    );
  const changesetCli = path.join(linkedModules, ".bin", "changeset");
  yield* runCommand(checkout, changesetCli, ["version"], {
    env: { GITHUB_TOKEN: Redacted.value(token) },
  });
  yield* fileSystem
    .remove(linkedModules)
    .pipe(
      Effect.mapError((cause) =>
        queueGateError("Unable to detach the replay toolchain.", cause)
      )
    );

  yield* runCommand(checkout, "git", ["add", "--all"]);
  const [generatedTree, sourceTree] = yield* Effect.all(
    [
      runCommand(checkout, "git", ["write-tree"]),
      runCommand(repositoryRoot, "git", ["rev-parse", `${sourceHead}^{tree}`]),
    ],
    { concurrency: 2 }
  );
  yield* validateReleaseReplay(generatedTree.trim(), sourceTree.trim());
});
