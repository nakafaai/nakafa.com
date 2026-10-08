// @vitest-environment node

import { layer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  Clock,
  Data,
  Duration,
  Effect,
  Fiber,
  Option,
  Predicate,
  Ref,
  Result,
  Schedule,
  Sink,
  Stdio,
  String as Str,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";
import { runWatchedBuild, watchSilence } from "@/scripts/build/watch";

/** A child that starts a second process, prints both process ids and one line, then sleeps. */
const SILENT_TREE = [
  'const child = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });',
  'console.log(process.pid + " " + child.pid);',
  'console.log("compiling");',
  "setInterval(() => {}, 1000);",
].join("\n");

/**
 * A child that leaves a grandchild holding its output open and then exits with
 * status 0. The grandchild stays silent and ends by itself after 30 seconds, so
 * a failing run cannot leave it running for long.
 */
const OUTPUT_HELD = [
  'const { spawn } = require("node:child_process");',
  'const grandchild = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "inherit" });',
  "grandchild.unref();",
  "console.log(grandchild.pid);",
  'console.log("done");',
].join("\n");

/**
 * A child that writes one euro sign split across two chunks, then stays silent.
 * The bytes are E2 82 AC, and the second chunk starts with the last one.
 */
const SPLIT_CHARACTER = [
  "process.stdout.write(Buffer.from([0xe2, 0x82]));",
  "setTimeout(() => process.stdout.write(Buffer.from([0xac, 0x0a])), 100);",
  "setTimeout(() => {}, 30000);",
].join("\n");

/** A child that writes half a line, waits past several heartbeats, then finishes the line. */
const HALF_LINE = [
  'process.stdout.write("half");',
  'setTimeout(() => process.stdout.write(" line\\n"), 300);',
].join("\n");

/** The 2 second silence limit keeps the real-process tests short; production waits five minutes. */
const SHORT_CADENCE = {
  heartbeatInterval: Duration.seconds(15),
  stallLimit: Duration.seconds(2),
};

/** Appends every chunk written to one standard stream to its text. */
function collectInto(text: Ref.Ref<string>) {
  return () =>
    Sink.forEachArray((written: readonly (string | Uint8Array)[]) =>
      Ref.update(text, (current) =>
        Arr.reduce(
          written,
          current,
          (output, chunk) =>
            output +
            (Predicate.isString(chunk)
              ? chunk
              : new TextDecoder().decode(chunk))
        )
      )
    );
}

/** Captures the standard streams and command line that the watch uses, in memory. */
const captureStreams = (argv: readonly string[] = []) =>
  Effect.gen(function* () {
    const stdout = yield* Ref.make("");
    const stderr = yield* Ref.make("");
    return {
      stderr,
      stdio: Stdio.make({
        args: Effect.succeed(argv),
        stderr: collectInto(stderr),
        stdin: Stream.empty,
        stdout: collectInto(stdout),
      }),
      stdout,
    };
  });

/**
 * Asserts which stall the silence watch reported. `toEqual` does not compare the
 * message of these errors, so the tag and the line are checked directly.
 */
function expectStalled(
  failure: { readonly _tag: string; readonly message: string },
  message: string
) {
  expect(failure._tag).toBe("BuildStalled");
  expect(failure.message).toBe(message);
}

/** Runs one build with the real child-process and file services, reading its command line from the captured streams. */
function runBuild(
  stdio: Stdio.Stdio,
  cadence: Parameters<typeof runWatchedBuild>[0]
) {
  return runWatchedBuild(cadence).pipe(
    Effect.provideService(Stdio.Stdio, stdio),
    Effect.provide(layer)
  );
}

/** A process that a failed kill left behind; the kernel reaps it a moment after it ends. */
class ProcessStillRunning extends Data.TaggedError("ProcessStillRunning")<{
  readonly pid: number;
}> {}

/** Whether a process still exists. Signal 0 checks for it without ending it. */
function processExists(pid: number) {
  return Effect.map(
    Effect.result(
      Effect.try({
        catch: () => "missing",
        try: () => process.kill(pid, 0),
      })
    ),
    Result.isSuccess
  );
}

/** Waits up to two seconds for a process to end. */
function expectProcessEnded(pid: number) {
  return Effect.gen(function* () {
    if (yield* processExists(pid)) {
      return yield* new ProcessStillRunning({ pid });
    }
  }).pipe(
    Effect.retry(
      Schedule.recurs(40).pipe(Schedule.addDelay(() => Effect.succeed(50)))
    )
  );
}

/** Tracks whether a watch has finished, without waiting for it. */
function trackFinish<A, E>(
  watch: Effect.Effect<A, E>,
  finished: Ref.Ref<boolean>
) {
  return watch.pipe(Effect.onExit(() => Ref.set(finished, true)));
}

describe("build watch", () => {
  it.live(
    "passes output through unchanged and returns a successful status",
    () =>
      Effect.gen(function* () {
        const streams = yield* captureStreams([
          process.execPath,
          "-e",
          "process.stdout.write('compiled\\n'); process.stderr.write('warning\\n');",
        ]);

        expect(
          yield* runBuild(streams.stdio, {
            heartbeatInterval: Duration.seconds(15),
            stallLimit: Duration.seconds(5),
          })
        ).toBe(0);
        expect(yield* Ref.get(streams.stdout)).toBe("compiled\n");
        expect(yield* Ref.get(streams.stderr)).toBe("warning\n");
      }),
    15_000
  );

  it.live(
    "reads a character split across two chunks in the stall line",
    () =>
      Effect.gen(function* () {
        const streams = yield* captureStreams([
          process.execPath,
          "-e",
          SPLIT_CHARACTER,
        ]);

        expect(yield* runBuild(streams.stdio, SHORT_CADENCE)).toBe(1);
        expect(yield* Ref.get(streams.stderr)).toBe(
          "build stalled: no output for 2s; last output: €\n"
        );
      }),
    15_000
  );

  it.live(
    "keeps a heartbeat out of a line the command is still writing",
    () =>
      Effect.gen(function* () {
        const streams = yield* captureStreams([
          process.execPath,
          "-e",
          HALF_LINE,
        ]);

        expect(
          yield* runBuild(streams.stdio, {
            heartbeatInterval: Duration.millis(20),
            stallLimit: Duration.seconds(5),
          })
        ).toBe(0);
        expect(yield* Ref.get(streams.stdout)).toContain("half line\n");
      }),
    15_000
  );

  it.live(
    "prints a heartbeat each interval while the command is silent",
    () =>
      Effect.gen(function* () {
        const streams = yield* captureStreams([
          process.execPath,
          "-e",
          "setTimeout(() => {}, 1000);",
        ]);

        expect(
          yield* runBuild(streams.stdio, {
            heartbeatInterval: Duration.millis(100),
            stallLimit: Duration.seconds(5),
          })
        ).toBe(0);
        const lines = Str.split(yield* Ref.get(streams.stdout), "\n");
        expect(
          Arr.filter(lines, (line) => line.startsWith("build heartbeat: silent"))
            .length
        ).toBeGreaterThanOrEqual(2);
      }),
    15_000
  );
});

describe("build status", () => {
  it.live(
    "returns the status of a failing build and passes its output through",
    () =>
      Effect.gen(function* () {
        const streams = yield* captureStreams([
          process.execPath,
          "-e",
          "process.stdout.write('\\n'); process.exit(3)",
        ]);

        expect(yield* runBuild(streams.stdio, SHORT_CADENCE)).toBe(3);
        expect(yield* Ref.get(streams.stdout)).toBe("\n");
        expect(yield* Ref.get(streams.stderr)).toBe("");
      }),
    15_000
  );

  it.live(
    "ends a silent command and its children, writes one stall line, and returns status 1",
    () =>
      Effect.gen(function* () {
        const streams = yield* captureStreams([
          process.execPath,
          "-e",
          SILENT_TREE,
        ]);

        expect(yield* runBuild(streams.stdio, SHORT_CADENCE)).toBe(1);
        expect(yield* Ref.get(streams.stderr)).toBe(
          "build stalled: no output for 2s; last output: compiling\n"
        );
        const [pidLine = "", compiling = ""] = Str.split(
          yield* Ref.get(streams.stdout),
          "\n"
        );
        const [parent = 0, grandchild = 0] = Arr.map(
          Str.split(pidLine, " "),
          Number
        );
        expect(compiling).toBe("compiling");
        yield* expectProcessEnded(parent);
        yield* expectProcessEnded(grandchild);
      }),
    15_000
  );

  it.live(
    "returns the status of a command whose output stays open after it exits",
    () =>
      Effect.gen(function* () {
        const streams = yield* captureStreams([
          process.execPath,
          "-e",
          OUTPUT_HELD,
        ]);

        expect(yield* runBuild(streams.stdio, SHORT_CADENCE)).toBe(0);
        const [grandchildLine = "", done = ""] = Str.split(
          yield* Ref.get(streams.stdout),
          "\n"
        );
        expect(Number(grandchildLine)).toBeGreaterThan(0);
        yield* expectProcessEnded(Number(grandchildLine));
        expect(done).toBe("done");
      }),
    15_000
  );

  it.live("fails without starting anything when no command is named", () =>
    Effect.gen(function* () {
      const streams = yield* captureStreams();

      const failure = yield* runBuild(streams.stdio, SHORT_CADENCE).pipe(
        Effect.flip
      );

      expect(failure._tag).toBe("MissingBuildCommand");
      expect(failure.message).toBe(
        "A build needs a command, such as next build."
      );
      expect(yield* Ref.get(streams.stdout)).toBe("");
    })
  );
});

describe("silence watch", () => {
  it.effect("reports a stall only once the silence reaches the limit", () =>
    Effect.gen(function* () {
      const quiet: Option.Option<string> = Option.none();
      const activity = yield* Ref.make({
        at: yield* Clock.currentTimeMillis,
        lastLine: quiet,
        stdoutOpenLine: false,
      });
      const finished = yield* Ref.make(false);
      const watch = yield* trackFinish(
        watchSilence(activity, Duration.minutes(5)),
        finished
      ).pipe(Effect.forkChild);

      yield* TestClock.adjust(Duration.millis(299_999));
      expect(yield* Ref.get(finished)).toBe(false);
      yield* TestClock.adjust(Duration.millis(1));
      expectStalled(
        yield* Fiber.join(watch).pipe(Effect.flip),
        "build stalled: no output for 300s; last output: (none)"
      );
    })
  );

  it.effect("restarts the silence window when the command prints", () =>
    Effect.gen(function* () {
      const quiet: Option.Option<string> = Option.none();
      const activity = yield* Ref.make({
        at: yield* Clock.currentTimeMillis,
        lastLine: quiet,
        stdoutOpenLine: false,
      });
      const finished = yield* Ref.make(false);
      const watch = yield* trackFinish(
        watchSilence(activity, Duration.minutes(5)),
        finished
      ).pipe(Effect.forkChild);

      yield* TestClock.adjust(Duration.minutes(4));
      yield* Ref.set(activity, {
        at: yield* Clock.currentTimeMillis,
        lastLine: Option.some("next"),
        stdoutOpenLine: false,
      });
      yield* TestClock.adjust(Duration.minutes(4));
      expect(yield* Ref.get(finished)).toBe(false);
      yield* TestClock.adjust(Duration.minutes(1));
      expectStalled(
        yield* Fiber.join(watch).pipe(Effect.flip),
        "build stalled: no output for 300s; last output: next"
      );
    })
  );
});
