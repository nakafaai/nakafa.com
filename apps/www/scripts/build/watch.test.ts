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
import {
  BuildStalled,
  printHeartbeats,
  watchBuild,
  watchSilence,
} from "@/scripts/build/watch";

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

/** Captures the standard streams that the watch writes to, in memory. */
const captureStreams = Effect.gen(function* () {
  const stdout = yield* Ref.make("");
  const stderr = yield* Ref.make("");
  return {
    stderr,
    stdio: Stdio.make({
      args: Effect.succeed([]),
      stderr: collectInto(stderr),
      stdin: Stream.empty,
      stdout: collectInto(stdout),
    }),
    stdout,
  };
});

/** Runs one watch with the real child-process and file services, writing to captured streams. */
function runWatch(
  stdio: Stdio.Stdio,
  options: Parameters<typeof watchBuild>[0]
) {
  return watchBuild(options).pipe(
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
        const streams = yield* captureStreams;
        const status = yield* runWatch(streams.stdio, {
          args: [
            "-e",
            "process.stdout.write('compiled\\n'); process.stderr.write('warning\\n');",
          ],
          command: process.execPath,
          heartbeatInterval: Duration.seconds(15),
          stallLimit: Duration.seconds(5),
        });

        expect(status).toBe(0);
        expect(yield* Ref.get(streams.stdout)).toBe("compiled\n");
        expect(yield* Ref.get(streams.stderr)).toBe("warning\n");
      })
  );

  it.live("returns the status of a failing command", () =>
    Effect.gen(function* () {
      const streams = yield* captureStreams;
      const status = yield* runWatch(streams.stdio, {
        args: ["-e", "process.stdout.write('\\n'); process.exit(3)"],
        command: process.execPath,
        heartbeatInterval: Duration.seconds(15),
        stallLimit: Duration.seconds(5),
      });

      expect(status).toBe(3);
    })
  );

  it.live(
    "ends a silent command and its children, then names its last output",
    () =>
      Effect.gen(function* () {
        const streams = yield* captureStreams;
        const failure = yield* runWatch(streams.stdio, {
          args: ["-e", SILENT_TREE],
          command: process.execPath,
          heartbeatInterval: Duration.seconds(15),
          stallLimit: Duration.seconds(1),
        }).pipe(Effect.flip);

        expect(failure).toEqual(
          new BuildStalled({
            message: "build stalled: no output for 1s; last output: compiling",
          })
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
      })
  );

  it.live("ends a command whose output stays open after it exits", () =>
    Effect.gen(function* () {
      const streams = yield* captureStreams;
      const failure = yield* runWatch(streams.stdio, {
        args: ["-e", OUTPUT_HELD],
        command: process.execPath,
        heartbeatInterval: Duration.seconds(15),
        stallLimit: Duration.seconds(2),
      }).pipe(Effect.flip);

      expect(failure).toEqual(
        new BuildStalled({
          message: "build stalled: no output for 2s; last output: done",
        })
      );
      const [grandchildLine = ""] = Str.split(
        yield* Ref.get(streams.stdout),
        "\n"
      );
      yield* expectProcessEnded(Number(grandchildLine));
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
      });
      const finished = yield* Ref.make(false);
      const watch = yield* trackFinish(
        watchSilence(activity, Duration.minutes(5)),
        finished
      ).pipe(Effect.forkChild);

      yield* TestClock.adjust(Duration.millis(299_999));
      expect(yield* Ref.get(finished)).toBe(false);
      yield* TestClock.adjust(Duration.millis(1));
      expect(yield* Fiber.join(watch).pipe(Effect.flip)).toEqual(
        new BuildStalled({
          message: "build stalled: no output for 300s; last output: (none)",
        })
      );
    })
  );

  it.effect("restarts the silence window when the command prints", () =>
    Effect.gen(function* () {
      const quiet: Option.Option<string> = Option.none();
      const activity = yield* Ref.make({
        at: yield* Clock.currentTimeMillis,
        lastLine: quiet,
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
      });
      yield* TestClock.adjust(Duration.minutes(4));
      expect(yield* Ref.get(finished)).toBe(false);
      yield* TestClock.adjust(Duration.minutes(1));
      expect(yield* Fiber.join(watch).pipe(Effect.flip)).toEqual(
        new BuildStalled({
          message: "build stalled: no output for 300s; last output: next",
        })
      );
    })
  );
});

describe("build heartbeats", () => {
  it.live("prints a heartbeat each interval while the command is silent", () =>
    Effect.gen(function* () {
      const streams = yield* captureStreams;
      const quiet: Option.Option<string> = Option.none();
      const activity = yield* Ref.make({
        at: yield* Clock.currentTimeMillis,
        lastLine: quiet,
      });
      const heartbeats = yield* printHeartbeats(
        activity,
        streams.stdio,
        Duration.millis(50)
      ).pipe(Effect.forkChild);

      yield* Effect.sleep(Duration.millis(500));
      yield* Fiber.interrupt(heartbeats);
      const lines = Str.split(yield* Ref.get(streams.stdout), "\n");
      expect(
        Arr.filter(lines, (line) => line.startsWith("build heartbeat: silent"))
          .length
      ).toBeGreaterThanOrEqual(2);
    }).pipe(Effect.provide(layer))
  );
});
