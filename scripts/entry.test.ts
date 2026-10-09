import { afterEach, assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Result, Schema } from "effect";
import { runEntry } from "#scripts/entry";

const runtime = vi.hoisted(() => ({
  runMain: vi.fn<(program: Effect.Effect<unknown, EntryFailure>) => void>(),
}));
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: runtime.runMain,
}));

class EntryFailure extends Schema.TaggedError<EntryFailure>()("EntryFailure", {
  message: Schema.String,
}) {}

/** Runs the program the entry handed to the Node runtime. */
const runStartedProgram = Effect.fn("EntryTest.runStartedProgram")(
  function* () {
    const [call] = runtime.runMain.mock.calls;
    if (call === undefined) {
      return yield* Effect.die("The entry did not start the Node runtime.");
    }
    return yield* call[0];
  }
);

afterEach(() => {
  process.exitCode = undefined;
  runtime.runMain.mockReset();
});

describe("script entry", () => {
  it.effect("leaves imported modules inert", () =>
    Effect.sync(() => {
      runEntry(false, Effect.die("An imported module must not run."));
      assert.strictEqual(runtime.runMain.mock.calls.length, 0);
    })
  );

  it.effect("reports a failing status with Node services provided", () =>
    Effect.gen(function* () {
      runEntry(
        true,
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          return (yield* fileSystem.exists(import.meta.filename)) ? 3 : 0;
        })
      );
      yield* runStartedProgram();
      assert.strictEqual(process.exitCode, 3);
    })
  );

  it.effect("keeps the default exit code for success and void programs", () =>
    Effect.gen(function* () {
      runEntry(true, Effect.succeed(0));
      runEntry(true, Effect.void);
      for (const [program] of runtime.runMain.mock.calls) {
        yield* program;
      }
      assert.strictEqual(runtime.runMain.mock.calls.length, 2);
      assert.strictEqual(process.exitCode, undefined);
    })
  );

  it.effect("hands typed failures to the runtime error report", () =>
    Effect.gen(function* () {
      const failure = new EntryFailure({ message: "Policy failed." });
      runEntry(true, Effect.fail(failure));
      const result = yield* Effect.result(runStartedProgram());
      assert(Result.isFailure(result));
      assert.strictEqual(result.failure, failure);
      assert.strictEqual(process.exitCode, undefined);
    })
  );
});
