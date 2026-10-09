// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { runWatchedBuild } from "@/scripts/build/watch";

/** The entry hands runMain the watched build's exit status and its failures. */
type BuildEntry = Effect.Effect<
  Effect.Success<ReturnType<typeof runWatchedBuild>>,
  Effect.Error<ReturnType<typeof runWatchedBuild>>
>;

const mocks = vi.hoisted(() => {
  let entry: BuildEntry | undefined;
  return {
    getEntry: () => entry,
    runMain: vi.fn((program: BuildEntry) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
});

describe("build entry", () => {
  it.live(
    "exits with the status of the command named on the command line",
    () =>
      Effect.gen(function* () {
        process.argv = [
          "node",
          "main",
          process.execPath,
          "-e",
          "process.exit(3)",
        ];
        yield* Effect.promise(() => import("@/scripts/build/main"));
        const entry = mocks.getEntry();
        if (entry === undefined) {
          return yield* Effect.die(
            "The build entry did not hand its program to runMain"
          );
        }

        yield* entry;

        expect(process.exitCode).toBe(3);
      }),
    15_000
  );
});
