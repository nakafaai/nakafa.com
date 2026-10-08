import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import { Duration, Effect, Stdio, Stream } from "effect";
import { watchBuild } from "@/scripts/build/watch";

/**
 * Runs the command named on the command line, such as `next build`, under the
 * build watch. The process exits with the command's status, or with 1 after a
 * stall, whose one-line report goes to standard error.
 */
const main = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  const [command = "", ...args] = yield* stdio.args;
  return yield* watchBuild({
    command,
    args,
    heartbeatInterval: Duration.seconds(15),
    stallLimit: Duration.minutes(5),
  }).pipe(
    Effect.catchTag("BuildStalled", (stalled) =>
      Stream.succeed(`${stalled.message}\n`).pipe(
        Stream.run(stdio.stderr()),
        Effect.as(1)
      )
    )
  );
});

runMain(
  main.pipe(
    Effect.tap((status) =>
      Effect.sync(() => {
        process.exitCode = status;
      })
    ),
    Effect.provide(layer)
  )
);
