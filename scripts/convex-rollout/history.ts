import { Effect, type PlatformError, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

const FULL_GIT_SHA = /^[0-9a-f]{40}$/u;

interface GitResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

/** Expected failure while reading repository history for rollout validation. */
export class ConvexRolloutGitError extends Schema.TaggedError<ConvexRolloutGitError>()(
  "ConvexRolloutGitError",
  { message: Schema.String }
) {}

function collectText(
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) {
  return stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (output, chunk) => output + chunk
    )
  );
}

function gitError(error: PlatformError.PlatformError) {
  return new ConvexRolloutGitError({ message: error.message });
}

const runGit = Effect.fn("ConvexRollout.runGit")(
  (
    repositoryRoot: string,
    args: readonly string[],
    acceptedExitCodes: readonly number[] = [0]
  ) =>
    Effect.scoped(
      Effect.gen(function* () {
        const command = yield* ChildProcess.make("git", args, {
          cwd: repositoryRoot,
        }).pipe(Effect.mapError(gitError));
        const [exitCode, stdout, stderr] = yield* Effect.all(
          [
            command.exitCode.pipe(Effect.mapError(gitError)),
            collectText(command.stdout).pipe(Effect.mapError(gitError)),
            collectText(command.stderr).pipe(Effect.mapError(gitError)),
          ],
          { concurrency: 3 }
        );
        const result: GitResult = {
          exitCode: Number(exitCode),
          stderr,
          stdout,
        };
        if (!acceptedExitCodes.includes(result.exitCode)) {
          const diagnostic = stderr.trim() || stdout.trim() || "Git failed.";
          return yield* new ConvexRolloutGitError({
            message: `git ${args.join(" ")}: ${diagnostic}`,
          });
        }
        return result;
      })
    )
);

/** Ensures one local or immutable remote revision can be inspected. */
export const ensureGitRevision = Effect.fn("ConvexRollout.ensureRevision")(
  function* (repositoryRoot: string, revision: string) {
    if (!revision || revision.startsWith("-")) {
      return yield* new ConvexRolloutGitError({
        message: "The rollout revision is invalid.",
      });
    }

    const verification = yield* runGit(
      repositoryRoot,
      ["rev-parse", "--verify", `${revision}^{commit}`],
      [0, 1, 128]
    );
    if (verification.exitCode === 0) {
      return;
    }
    if (!FULL_GIT_SHA.test(revision)) {
      return yield* new ConvexRolloutGitError({
        message: `The rollout revision ${revision} is unavailable.`,
      });
    }

    yield* runGit(repositoryRoot, [
      "fetch",
      "--no-tags",
      "--depth=1",
      "origin",
      revision,
    ]);
    yield* runGit(repositoryRoot, [
      "rev-parse",
      "--verify",
      `${revision}^{commit}`,
    ]);
  }
);

/** Lists revision files containing one exact source token. */
export const listGitRevisionFiles = Effect.fn(
  "ConvexRollout.listRevisionFiles"
)(function* (
  repositoryRoot: string,
  revision: string,
  sourceToken: string,
  sourceRoots: readonly string[]
) {
  const grep = yield* runGit(
    repositoryRoot,
    ["grep", "-l", "-F", sourceToken, revision, "--", ...sourceRoots],
    [0, 1]
  );
  const prefix = `${revision}:`;
  return grep.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) =>
      line.startsWith(prefix) ? line.slice(prefix.length) : line
    );
});

/** Reads one exact source file from immutable repository history. */
export const readGitRevisionFile = Effect.fn("ConvexRollout.readRevisionFile")(
  (repositoryRoot: string, revision: string, sourcePath: string) =>
    runGit(repositoryRoot, ["show", `${revision}:${sourcePath}`]).pipe(
      Effect.map(({ stdout }) => stdout)
    )
);
