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
export class BuildStalled extends Data.TaggedError("BuildStalled")<{
  readonly message: string;
}> {}

/** When the command last printed, and the last non-blank line it wrote. */
const Activity = Schema.Struct({
  at: Schema.Finite,
  lastLine: Schema.Option(Schema.String),
});
type Activity = typeof Activity.Type;

/** The last non-blank line of one chunk of output, without its line break. */
function lastLineOf(text: string) {
  return Arr.last(
    Arr.filter(Arr.map(Str.split(text, "\n"), Str.trim), Str.isNonEmpty)
  );
}

/** Notes one chunk of output: when it arrived, and its last non-blank line if it has one. */
const recordOutput = Effect.fn("BuildWatch.recordOutput")(function* (
  activity: Ref.Ref<Activity>,
  chunk: Uint8Array
) {
  const now = yield* Clock.currentTimeMillis;
  const line = lastLineOf(new TextDecoder().decode(chunk));
  yield* Ref.update(activity, (previous) => ({
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
  yield* stream.pipe(
    Stream.tap((chunk) => recordOutput(activity, chunk)),
    Stream.run(sink)
  );
});

/** The one-line stall message: how long the command was silent, and its last line. */
function stallMessage(silentMillis: number, lastLine: Option.Option<string>) {
  const seconds = Math.floor(silentMillis / 1000);
  return `build stalled: no output for ${seconds}s; last output: ${Option.getOrElse(lastLine, () => "(none)")}`;
}

/**
 * Fails once the command has printed nothing for `limit`. The clock is read on
 * every wake-up, so output that arrives during a wait restarts the count.
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

/** Writes one heartbeat line with the silence so far and the container's readings. */
const printHeartbeat = Effect.fn("BuildWatch.printHeartbeat")(function* (
  activity: Ref.Ref<Activity>,
  stdio: Stdio.Stdio
) {
  const { at } = yield* Ref.get(activity);
  const silentMillis = (yield* Clock.currentTimeMillis) - at;
  const heartbeat = yield* readHeartbeat(
    HEARTBEAT_SOURCES,
    Math.floor(silentMillis / 1000)
  );
  yield* Stream.succeed(`${formatHeartbeat(heartbeat)}\n`).pipe(
    Stream.run(stdio.stdout())
  );
});

/** Writes one heartbeat per interval for as long as it runs. */
export const printHeartbeats = Effect.fn("BuildWatch.printHeartbeats")(
  function* (
    activity: Ref.Ref<Activity>,
    stdio: Stdio.Stdio,
    interval: Duration.Duration
  ) {
    yield* Effect.sleep(interval).pipe(
      Effect.andThen(
        printHeartbeat(activity, stdio).pipe(
          Effect.repeat(Schedule.spaced(interval))
        )
      )
    );
  }
);

/**
 * How long a stopped command gets to exit after SIGTERM before it is killed,
 * and how long its output may take to close once it has been stopped.
 */
const STOP_GRACE = Duration.seconds(5);

/**
 * Runs one command and watches it. Its output passes through unchanged, a
 * heartbeat reports the container every interval, and the command and its
 * children are ended when it prints nothing for the whole stall limit. The
 * result is the command's exit status.
 */
export const watchBuild = Effect.fn("BuildWatch.run")(function* (options: {
  readonly command: string;
  readonly args: readonly string[];
  readonly stallLimit: Duration.Duration;
  readonly heartbeatInterval: Duration.Duration;
}) {
  const stdio = yield* Stdio.Stdio;
  const started: Activity = {
    at: yield* Clock.currentTimeMillis,
    lastLine: Option.none(),
  };
  const activity = yield* Ref.make(started);
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
            passThrough(child.stdout, stdio.stdout(), activity),
            passThrough(child.stderr, stdio.stderr(), activity),
          ],
          { concurrency: "unbounded", discard: true }
        )
      );
      const heartbeats = yield* Effect.forkChild(
        printHeartbeats(activity, stdio, options.heartbeatInterval)
      );
      // The command is finished once it has exited and its output has closed.
      // A process that holds the output open after the exit must also print
      // within the stall limit, so the silence watch runs through the drain.
      const finished = Effect.gen(function* () {
        const status = yield* child.exitCode;
        yield* Fiber.join(output);
        return status;
      });
      return yield* finished.pipe(
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
              Effect.andThen(
                Fiber.join(output).pipe(
                  Effect.timeout(STOP_GRACE),
                  Effect.ignore
                )
              ),
              Effect.andThen(Effect.fail(stalled))
            )
        )
      );
    })
  );
});
