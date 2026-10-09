import { Array as Arr, Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { collectText } from "#scripts/process";

const RunOptionsSchema = Schema.Struct({
  capture: Schema.optionalKey(Schema.Boolean),
});
type RunOptions = typeof RunOptionsSchema.Type;

/** Expected failure while running pnpm for dependency maintenance. */
export class DependencyCommandError extends Schema.TaggedError<DependencyCommandError>()(
  "DependencyCommandError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Runs pnpm without a shell and optionally captures its exact output. */
export const runPnpm = Effect.fn("RepositoryPolicy.runPnpm")(function* (
  root: string,
  args: readonly string[],
  options: RunOptions = {}
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const capture = options.capture === true;
      const command = yield* ChildProcess.make("pnpm", args, {
        cwd: root,
        stderr: capture ? "pipe" : "inherit",
        stdout: capture ? "pipe" : "inherit",
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DependencyCommandError({
              cause,
              message: `Unable to run pnpm ${Arr.join(args, " ")}.`,
            })
        )
      );

      if (!capture) {
        const exitCode = yield* command.exitCode.pipe(
          Effect.mapError(
            (cause) =>
              new DependencyCommandError({
                cause,
                message: `Unable to finish pnpm ${Arr.join(args, " ")}.`,
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
              message: `Unable to finish pnpm ${Arr.join(args, " ")}.`,
            })
        )
      );
      return { exitCode: Number(exitCode), stderr, stdout };
    })
  );
});
