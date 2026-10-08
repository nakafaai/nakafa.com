import {
  Array as Arr,
  Clock,
  Data,
  Duration,
  Effect,
  Fiber,
  Option,
  type PlatformError,
  Ref,
  Schedule,
  Schema,
  Semaphore,
  type Sink,
  Stdio,
  String as Str,
  Stream,
} from "effect";
import { ChildProcess } from "effect/process";
import {
  formatHeartbeat,
  HEARTBEAT_SOURCES,
  readHeartbeat,
} from "@/scripts/build/heartbeat";

/** A command that printed nothing for the whole stall limit. Its message is one line. */
class BuildStalled extends Data.TaggedError("BuildStalled")<{
  readonly message: string;
}> {}

/**
 * When the command last printed, the last non-blank line it wrote, and whether
 * its standard output stops in the middle of a line.
 */
const Activity = Schema.Struct({
  at: Schema.Finite,
  lastLine: Schema.Option(Schema.String),
  stdoutOpenLine: Schema.Boolean,
});
type Activity = typeof Activity.Type;

const LINE_FEED = 0x0a;

/** The last non-blank line of one chunk of output, without its line break. */
function lastLineOf(text: string) {
  return Arr.last(
    Arr.filter(Arr.map(Str.split(text, "\n"), Str.trim), Str.isNonEmpty)
  );
}

/** Notes one chunk of output: when it arrived, and its last non-blank line if it has one. */
const recordOutput = Effect.fn("BuildWatch.recordOutput")(function* (
  activity: Ref.Ref<Activity>,
  decoder: TextDecoder,
  chunk: Uint8Array
) {
  const now = yield* Clock.currentTimeMillis;
  const line = lastLineOf(decoder.decode(chunk, { stream: true }));
  yield* Ref.update(activity, (previous) => ({
    ...previous,
    at: now,
    lastLine: Option.orElse(line, () => previous.lastLine),
  }));
});

/** Copies one stream of the command to its standard stream unchanged. */
const passThrough = Effect.fn("BuildWatch.passThrough")(function* (
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
  sink: Sink.Sink<
    void,
    string | Uint8Array,
    never,
    PlatformError.PlatformError
  >,
  activity: Ref.Ref<Activity>
) {
  // A chunk can end in the middle of a character, so one decoder per stream
  // holds the partial bytes until the rest arrives in the next chunk.
  const decoder = new TextDecoder();
  yield* stream.pipe(
    Stream.tap((chunk) => recordOutput(activity, decoder, chunk)),
    Stream.run(sink)
  );
});

/**
 * Copies standard output one chunk at a time. Each chunk is noted and written
 * under the gate that also serializes heartbeats, so a heartbeat never lands
 * inside a line that the command is still writing.
 */
const passStdout = Effect.fn("BuildWatch.passStdout")(function* (
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
  sink: Sink.Sink<
    void,
    string | Uint8Array,
    never,
    PlatformError.PlatformError
  >,
  activity: Ref.Ref<Activity>,
  gate: Semaphore.Semaphore
) {
  // The decoder holds a partial character between chunks, as in passThrough.
  const decoder = new TextDecoder();
  yield* Stream.runForEach(stream, (chunk) =>
    gate.withPermit(
      Effect.gen(function* () {
        yield* recordOutput(activity, decoder, chunk);
        // A line feed byte never occurs inside a multi-byte character, so the
        // last byte of a chunk says whether the chunk ends a line.
        yield* Ref.update(activity, (previous) => ({
          ...previous,
          stdoutOpenLine: chunk.at(-1) !== LINE_FEED,
        }));
        yield* Stream.succeed(chunk).pipe(Stream.run(sink));
      })
    )
  );
});

/** The one-line stall message: how long the command was silent, and its last line. */
function stallMessage(silentMillis: number, lastLine: Option.Option<string>) {
  const seconds = Math.floor(silentMillis / 1000);
  return `build stalled: no output for ${seconds}s; last output: ${Option.getOrElse(lastLine, () => "(none)")}`;
}

/**
 * Fails once the command has printed nothing for `limit`. The clock is read on
 * every wake-up, so output that arrives during a wait restarts the count. The
 * export lets the tests check this decision with the test clock.
 */
export const watchSilence = Effect.fn("BuildWatch.watchSilence")(function* (
  activity: Ref.Ref<Activity>,
  limit: Duration.Duration
) {
  const limitMillis = Duration.toMillis(limit);
  while (true) {
    const { at, lastLine } = yield* Ref.get(activity);
    const silentMillis = (yield* Clock.currentTimeMillis) - at;
    if (silentMillis >= limitMillis) {
      return yield* new BuildStalled({
        message: stallMessage(silentMillis, lastLine),
      });
    }
    yield* Effect.sleep(Duration.millis(limitMillis - silentMillis));
  }
});

/**
 * Writes one heartbeat line with the silence so far and the container's
 * readings. While standard output is midway through a line, this tick writes
 * nothing, and the next tick tries again.
 */
const printHeartbeat = Effect.fn("BuildWatch.printHeartbeat")(function* (
  activity: Ref.Ref<Activity>,
  stdio: Stdio.Stdio,
  gate: Semaphore.Semaphore
) {
  const { at } = yield* Ref.get(activity);
  const silentMillis = (yield* Clock.currentTimeMillis) - at;
  const heartbeat = yield* readHeartbeat(
    HEARTBEAT_SOURCES,
    Math.floor(silentMillis / 1000)
  );
  yield* gate.withPermit(
    Effect.gen(function* () {
      const { stdoutOpenLine } = yield* Ref.get(activity);
      if (stdoutOpenLine) {
        return;
      }
      yield* Stream.succeed(`${formatHeartbeat(heartbeat)}\n`).pipe(
        Stream.run(stdio.stdout())
      );
    })
  );
});

/** Writes one heartbeat per interval for as long as it runs. */
const printHeartbeats = Effect.fn("BuildWatch.printHeartbeats")(
  function* (
    activity: Ref.Ref<Activity>,
    stdio: Stdio.Stdio,
    interval: Duration.Duration,
    gate: Semaphore.Semaphore
  ) {
    yield* Effect.sleep(interval).pipe(
      Effect.andThen(
        printHeartbeat(activity, stdio, gate).pipe(
          Effect.repeat(Schedule.spaced(interval))
        )
      )
    );
  }
);

/**
 * How long a stopped command gets to exit after SIGTERM before it is killed,
 * and how long its output may take to close once the command has ended.
 */
const STOP_GRACE = Duration.seconds(5);

/**
 * Waits at most STOP_GRACE for the output of a command to close. A process that
 * the command started can hold the output open after the command has exited,
 * so the wait is bounded. A read error still fails the build.
 */
const drainOutput = Effect.fn("BuildWatch.drainOutput")(function* (
  output: Fiber.Fiber<void, PlatformError.PlatformError>
) {
  yield* Fiber.join(output).pipe(
    Effect.timeoutOption(STOP_GRACE),
    Effect.asVoid
  );
});

/**
 * Runs one command and watches it. Its output passes through unchanged, a
 * heartbeat reports the container every interval, and the command and its
 * children are ended when it prints nothing for the whole stall limit. The
 * result is the command's exit status.
 */
const watchBuild = Effect.fn("BuildWatch.run")(function* (options: {
  readonly command: string;
  readonly args: readonly string[];
  readonly stallLimit: Duration.Duration;
  readonly heartbeatInterval: Duration.Duration;
}) {
  const stdio = yield* Stdio.Stdio;
  const started: Activity = {
    at: yield* Clock.currentTimeMillis,
    lastLine: Option.none(),
    stdoutOpenLine: false,
  };
  const activity = yield* Ref.make(started);
  // Standard output and heartbeats take turns, so a heartbeat is never written
  // between two chunks of one line.
  const stdoutGate = yield* Semaphore.make(1);
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const child = yield* ChildProcess.make(options.command, options.args, {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = yield* Effect.forkChild(
        Effect.all(
          [
            passStdout(child.stdout, stdio.stdout(), activity, stdoutGate),
            passThrough(child.stderr, stdio.stderr(), activity),
          ],
          { concurrency: "unbounded", discard: true }
        )
      );
      const heartbeats = yield* Effect.forkChild(
        printHeartbeats(activity, stdio, options.heartbeatInterval, stdoutGate)
      );
      // Only a command that is still running can stall. Once it has exited,
      // its exit status is the result, even if a process it started still
      // holds the output open, so the output gets one bounded drain.
      const status = yield* child.exitCode.pipe(
        Effect.raceFirst(watchSilence(activity, options.stallLimit)),
        Effect.ensuring(Fiber.interrupt(heartbeats)),
        Effect.catchTag("BuildStalled", (stalled) =>
          child
            .kill({
              killSignal: "SIGTERM",
              forceKillAfter: STOP_GRACE,
            })
            .pipe(
              // The command may have exited on its own just before the kill.
              Effect.ignore,
              // A stopped command's output closes at once unless a process
              // outside its group still holds it, so the wait is bounded.
              Effect.andThen(drainOutput(output).pipe(Effect.ignore)),
              Effect.andThen(Effect.fail(stalled))
            )
        )
      );
      yield* drainOutput(output);
      return status;
    })
  );
});

/**
 * A production build prints a heartbeat about every 15 seconds, between lines
 * of output, and stops after five minutes without output.
 */
const BUILD_CADENCE = {
  heartbeatInterval: Duration.seconds(15),
  stallLimit: Duration.minutes(5),
};

/** A build started without a command, so there is nothing to run. */
class MissingBuildCommand extends Data.TaggedError(
  "MissingBuildCommand"
)<{
  readonly message: string;
}> {}

/**
 * Runs the command named on the command line, such as `next build`, under the
 * build watch and returns its exit status. A stall ends the command, writes its
 * one-line report to standard error, and returns status 1.
 */
export const runWatchedBuild = Effect.fn("BuildWatch.runWatchedBuild")(
  function* (cadence: typeof BUILD_CADENCE = BUILD_CADENCE) {
    const stdio = yield* Stdio.Stdio;
    const argv = yield* stdio.args;
    if (!Arr.isReadonlyArrayNonEmpty(argv)) {
      return yield* new MissingBuildCommand({
        message: "A build needs a command, such as next build.",
      });
    }
    const [command, ...args] = argv;
    return yield* watchBuild({ command, args, ...cadence }).pipe(
      Effect.catchTag("BuildStalled", (stalled) =>
        Stream.succeed(`${stalled.message}\n`).pipe(
          Stream.run(stdio.stderr()),
          Effect.as(1)
        )
      )
    );
  }
);
