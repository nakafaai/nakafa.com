import { assert, describe, it } from "@effect/vitest";
import { Effect, PlatformError, Sink, Stdio } from "effect";
import { writeError, writeOutput } from "#scripts/output";

const closedStream = PlatformError.systemError({
  _tag: "BadResource",
  method: "write",
  module: "Stdio",
});

describe("repository output", () => {
  it.effect("writes messages to their own standard stream", () =>
    Effect.gen(function* () {
      const stdout: Array<string | Uint8Array> = [];
      const stderr: Array<string | Uint8Array> = [];
      yield* Effect.all([writeOutput("passed\n"), writeError("failed\n")]).pipe(
        Effect.provide(
          Stdio.layerTest({
            stderr: () =>
              Sink.forEachArray((chunks) =>
                Effect.sync(() => {
                  stderr.push(...chunks);
                })
              ),
            stdout: () =>
              Sink.forEachArray((chunks) =>
                Effect.sync(() => {
                  stdout.push(...chunks);
                })
              ),
          })
        )
      );
      assert.deepStrictEqual(stdout, ["passed\n"]);
      assert.deepStrictEqual(stderr, ["failed\n"]);
    })
  );

  it.effect("reports closed streams as typed output failures", () =>
    Effect.gen(function* () {
      const closed = Stdio.layerTest({
        stderr: () => Sink.fail(closedStream),
        stdout: () => Sink.fail(closedStream),
      });
      const outputFailure = yield* writeOutput("passed\n").pipe(
        Effect.provide(closed),
        Effect.flip
      );
      const errorFailure = yield* writeError("failed\n").pipe(
        Effect.provide(closed),
        Effect.flip
      );
      assert.strictEqual(outputFailure._tag, "RepositoryOutputError");
      assert.strictEqual(
        outputFailure.message,
        "Unable to write repository policy output."
      );
      assert.strictEqual(outputFailure.cause, closedStream);
      assert.strictEqual(errorFailure._tag, "RepositoryOutputError");
      assert.strictEqual(
        errorFailure.message,
        "Unable to write repository policy errors."
      );
      assert.strictEqual(errorFailure.cause, closedStream);
    })
  );
});
