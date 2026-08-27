import { Effect, type PlatformError, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

interface RunOptions {
  readonly capture?: boolean;
}

/** Expected failure while running pnpm for dependency maintenance. */
class DependencyCommandError extends Schema.TaggedError<DependencyCommandError>()(
  "DependencyCommandError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Collects one child-process stream as UTF-8 text. */
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
              message: `Unable to run pnpm ${args.join(" ")}.`,
            })
        )
      );

      if (!capture) {
        const exitCode = yield* command.exitCode.pipe(
          Effect.mapError(
            (cause) =>
              new DependencyCommandError({
                cause,
                message: `Unable to finish pnpm ${args.join(" ")}.`,
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
              message: `Unable to finish pnpm ${args.join(" ")}.`,
            })
        )
      );
      return { exitCode: Number(exitCode), stderr, stdout };
    })
  );
});
