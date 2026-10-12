import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { Effect, Path, Schema } from "effect";
import { ChildProcess } from "effect/process";

/** The acceptance command line, which owns the local runtime's learners and rows. */
const acceptanceCli = new URL(
  "../../../../packages/backend/scripts/content/acceptance/main.ts",
  import.meta.url
);

/** Expected failure of an acceptance command. */
class AcceptanceCommandError extends Schema.TaggedError<AcceptanceCommandError>()(
  "AcceptanceCommandError",
  { exitCode: Schema.Finite, mode: Schema.String }
) {}

/**
 * Runs one mode of the acceptance command line against the running local
 * runtime, such as `learner <cookie-file>` or `import <table> <rows-file>`.
 * The command line clears every cloud deployment value from its environment,
 * so a browser test never reaches a deployment through it.
 */
export const runAcceptanceCommand = Effect.fn("NakafaE2E.runAcceptanceCommand")(
  function* (mode: string, ...args: readonly string[]) {
    const cli = yield* Path.Path.pipe(
      Effect.flatMap((path) => path.fromFileUrl(acceptanceCli))
    );
    const child = yield* ChildProcess.make(
      process.execPath,
      [cli, mode, ...args],
      { stderr: "inherit", stdin: "ignore", stdout: "inherit" }
    );
    const exitCode = yield* child.exitCode;
    if (exitCode !== 0) {
      return yield* new AcceptanceCommandError({ exitCode, mode });
    }
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);
