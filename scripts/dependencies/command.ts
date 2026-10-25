import { Array as Arr, Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { collectText } from "#scripts/process";

const RunOptionsSchema = Schema.Struct({
  capture: Schema.optionalKey(Schema.Boolean),
});
type RunOptions = typeof RunOptionsSchema.Type;

/** Expected failure while running bun for dependency maintenance. */
export class DependencyCommandError extends Schema.TaggedError<DependencyCommandError>()(
  "DependencyCommandError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Runs bun without a shell and optionally captures its exact output. */
export const runBun = Effect.fn("RepositoryPolicy.runBun")(function* (
  root: string,
  args: readonly string[],
  options: RunOptions = {}
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const capture = options.capture === true;
      const command = yield* ChildProcess.make("bun", args, {
        cwd: root,
        stderr: capture ? "pipe" : "inherit",
        stdout: capture ? "pipe" : "inherit",
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DependencyCommandError({
              cause,
              message: `Unable to run bun ${Arr.join(args, " ")}.`,
            })
        )
      );

      if (!capture) {
        const exitCode = yield* command.exitCode.pipe(
          Effect.mapError(
            (cause) =>
              new DependencyCommandError({
                cause,
                message: `Unable to finish bun ${Arr.join(args, " ")}.`,
              })
          )
        );
        return { exitCode: Number(exitCode), stderr: "", stdout: "" };
      }

      const [exitCode, stdout, stderr] = yield* Effect.all(
        [
          command.exitCode,
          collectText(command.stdout),
          collectText(command.stderr),
        ],
        { concurrency: 3 }
      ).pipe(
        Effect.mapError(
          (cause) =>
            new DependencyCommandError({
              cause,
              message: `Unable to finish bun ${Arr.join(args, " ")}.`,
            })
        )
      );
      return { exitCode: Number(exitCode), stderr, stdout };
    })
  );
});
