import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { sanitizeAcceptanceCommandError } from "@repo/backend/scripts/content/acceptance/error";
import { Effect, Path, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";

/** The acceptance command line, which owns the local runtime's learners and rows. */
const acceptanceCli = new URL(
  "../../../../packages/backend/scripts/content/acceptance/main.ts",
  import.meta.url
);

/**
 * Expected failure of an acceptance command. The message names the mode, the exit
 * code, and the start of what the command printed, where it says why it stopped.
 * `output` keeps everything the command printed to stdout and stderr, in the order
 * it arrived: the command line writes its failure to stdout, so stderr alone is
 * often empty.
 */
class AcceptanceCommandError extends Schema.TaggedError<AcceptanceCommandError>()(
  "AcceptanceCommandError",
  {
    exitCode: Schema.Finite,
    message: Schema.String,
    mode: Schema.String,
    output: Schema.String,
  }
) {}

/**
 * Runs one mode of the acceptance command line against the running local
 * runtime, such as `learner <cookie-file>` or `import <table> <rows-file>`.
 * The command line clears every cloud deployment value from its environment,
 * so a browser test never reaches a deployment through it. The command's output
 * is read while it runs, so a failed command reports why it stopped.
 */
export const runAcceptanceCommand = Effect.fn("NakafaE2E.runAcceptanceCommand")(
  function* (mode: string, ...args: readonly string[]) {
    const cli = yield* Path.Path.pipe(
      Effect.flatMap((path) => path.fromFileUrl(acceptanceCli))
    );
    const child = yield* ChildProcess.make(
      process.execPath,
      [cli, mode, ...args],
      { stderr: "pipe", stdin: "ignore", stdout: "pipe" }
    );
    const [exitCode, output] = yield* Effect.all(
      [child.exitCode, Stream.mkString(Stream.decodeText(child.all))],
      { concurrency: "unbounded" }
    );
    if (exitCode !== 0) {
      const detail = sanitizeAcceptanceCommandError(output, [], "start");
      return yield* new AcceptanceCommandError({
        exitCode,
        message: `acceptance ${mode} exited with ${exitCode}: ${detail}`,
        mode,
        output,
      });
    }
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);
