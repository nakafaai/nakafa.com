import { Array as Arr, Effect, Schema } from "effect";
import { TrainError } from "#scripts/landing/train";
import { runText } from "#scripts/process";

/** Runs a command and returns how it exited and what it printed. */
export const attempt = (
  command: string,
  args: readonly string[],
  cwd?: string
) =>
  runText(command, args, cwd).pipe(
    Effect.mapError(
      () => new TrainError({ message: `${command} could not start.` })
    )
  );

/** Runs a command and returns what it printed, or fails with what it said. */
export const run = Effect.fn("landing.run")(function* (
  command: string,
  args: readonly string[],
  cwd?: string
) {
  const output = yield* attempt(command, args, cwd);
  if (output.code !== 0) {
    return yield* new TrainError({
      message: `${command} ${Arr.join(Arr.take(args, 2), " ")} failed: ${output.stderr.trim()}`,
    });
  }
  return output.stdout;
});

/** Decodes what a command printed, failing as the train fails. */
export const decoded =
  <A>(schema: Schema.Codec<A, string>) =>
  (text: string) =>
    Schema.decodeEffect(schema)(text).pipe(
      Effect.mapError(
        (error) =>
          new TrainError({
            message: `GitHub answered unexpectedly: ${error.message}`,
          })
      )
    );

/** Runs the GitHub CLI and returns what it printed, or fails with what it said. */
export const gh = (args: readonly string[]) => run("gh", args);
