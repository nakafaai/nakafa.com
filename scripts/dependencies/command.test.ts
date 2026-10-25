import { assert, describe, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  Layer,
  PlatformError,
  Ref,
  Sink,
  Stream,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { runBun } from "#scripts/dependencies/command";

/** Builds one scripted child process from its exit code and output streams. */
function scriptedProcess(
  exitCode: Effect.Effect<number, PlatformError.PlatformError>,
  stderr: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
  stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) {
  return { exitCode, stderr, stdout };
}

type ScriptedProcess = ReturnType<typeof scriptedProcess>;

const encoder = new TextEncoder();
const brokenPipe = PlatformError.systemError({
  _tag: "BadResource",
  method: "read",
  module: "ChildProcess",
});

/** Answers every spawn with one scripted process and records its command. */
function scriptedSpawner(
  spawned: Ref.Ref<readonly ChildProcess.Command[]>,
  process: Effect.Effect<ScriptedProcess, PlatformError.PlatformError>
) {
  return Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      Ref.update(spawned, Arr.append(command)).pipe(
        Effect.andThen(process),
        Effect.map(({ exitCode, stderr, stdout }) =>
          ChildProcessSpawner.makeHandle({
            all: Stream.merge(stdout, stderr),
            exitCode: Effect.map(exitCode, ChildProcessSpawner.ExitCode),
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
            isRunning: Effect.succeed(false),
            kill: () => Effect.void,
            pid: ChildProcessSpawner.ProcessId(1),
            stderr,
            stdin: Sink.drain,
            stdout,
            unref: Effect.succeed(Effect.void),
          })
        )
      )
    )
  );
}

/** Returns the options bun was started with. */
function startedOptions(spawned: readonly ChildProcess.Command[]) {
  return Arr.map(spawned, (command) =>
    ChildProcess.isStandardCommand(command)
      ? {
          args: command.args,
          command: command.command,
          cwd: command.options.cwd,
          stderr: command.options.stderr,
          stdout: command.options.stdout,
        }
      : command._tag
  );
}

describe("bun command", () => {
  it.effect("captures exact output without a shell", () =>
    Effect.gen(function* () {
      const spawned = yield* Ref.make<readonly ChildProcess.Command[]>([]);
      const result = yield* runBun(
        "/repository",
        ["view", "effect@rc", "version", "--json"],
        { capture: true }
      ).pipe(
        Effect.provide(
          scriptedSpawner(
            spawned,
            Effect.succeed(
              scriptedProcess(
                Effect.succeed(0),
                Stream.make(encoder.encode("warn\n")),
                Stream.make(
                  encoder.encode('"4.0.0-'),
                  encoder.encode('rc.117"\n')
                )
              )
            )
          )
        )
      );

      assert.deepStrictEqual(result, {
        exitCode: 0,
        stderr: "warn\n",
        stdout: '"4.0.0-rc.117"\n',
      });
      assert.deepStrictEqual(startedOptions(yield* Ref.get(spawned)), [
        {
          args: ["view", "effect@rc", "version", "--json"],
          command: "bun",
          cwd: "/repository",
          stderr: "pipe",
          stdout: "pipe",
        },
      ]);
    })
  );

  it.effect("inherits the terminal and preserves the exit code", () =>
    Effect.gen(function* () {
      const spawned = yield* Ref.make<readonly ChildProcess.Command[]>([]);
      const result = yield* runBun("/repository", [
        "update",
        "--recursive",
        "--latest",
      ]).pipe(
        Effect.provide(
          scriptedSpawner(
            spawned,
            Effect.succeed(
              scriptedProcess(Effect.succeed(23), Stream.empty, Stream.empty)
            )
          )
        )
      );

      assert.deepStrictEqual(result, { exitCode: 23, stderr: "", stdout: "" });
      assert.deepStrictEqual(startedOptions(yield* Ref.get(spawned)), [
        {
          args: ["update", "--recursive", "--latest"],
          command: "bun",
          cwd: "/repository",
          stderr: "inherit",
          stdout: "inherit",
        },
      ]);
    })
  );

  it.effect("reports processes that cannot start or finish", () =>
    Effect.gen(function* () {
      const spawned = yield* Ref.make<readonly ChildProcess.Command[]>([]);
      const spawnFailure = yield* runBun("/repository", ["install"], {
        capture: true,
      }).pipe(
        Effect.provide(scriptedSpawner(spawned, Effect.fail(brokenPipe))),
        Effect.flip
      );
      const exitFailure = yield* runBun("/repository", ["update"]).pipe(
        Effect.provide(
          scriptedSpawner(
            spawned,
            Effect.succeed(
              scriptedProcess(
                Effect.fail(brokenPipe),
                Stream.empty,
                Stream.empty
              )
            )
          )
        ),
        Effect.flip
      );
      const outputFailure = yield* runBun("/repository", ["outdated"], {
        capture: true,
      }).pipe(
        Effect.provide(
          scriptedSpawner(
            spawned,
            Effect.succeed(
              scriptedProcess(
                Effect.succeed(0),
                Stream.empty,
                Stream.fail(brokenPipe)
              )
            )
          )
        ),
        Effect.flip
      );

      assert.deepStrictEqual(
        Arr.map([spawnFailure, exitFailure, outputFailure], (failure) => [
          failure._tag,
          failure.cause,
          failure.message,
        ]),
        [
          ["DependencyCommandError", brokenPipe, "Unable to run bun install."],
          [
            "DependencyCommandError",
            brokenPipe,
            "Unable to finish bun update.",
          ],
          [
            "DependencyCommandError",
            brokenPipe,
            "Unable to finish bun outdated.",
          ],
        ]
      );
    })
  );
});
