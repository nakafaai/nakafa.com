import { assert, describe, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  Layer,
  PlatformError,
  Sink,
  Stream,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { runPnpm } from "#scripts/dependencies/command";

interface ScriptedProcess {
  readonly exitCode: Effect.Effect<number, PlatformError.PlatformError>;
  readonly stderr: Stream.Stream<Uint8Array, PlatformError.PlatformError>;
  readonly stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>;
}

const encoder = new TextEncoder();
const brokenPipe = PlatformError.systemError({
  _tag: "BadResource",
  method: "read",
  module: "ChildProcess",
});

/** Answers every spawn with one scripted process and records its command. */
function scriptedSpawner(
  spawned: ChildProcess.Command[],
  process: Effect.Effect<ScriptedProcess, PlatformError.PlatformError>
) {
  return Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      Effect.sync(() => {
        spawned.push(command);
      }).pipe(
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

/** Returns the options pnpm was started with. */
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

describe("pnpm command", () => {
  it.effect("captures exact output without a shell", () =>
    Effect.gen(function* () {
      const spawned: ChildProcess.Command[] = [];
      const result = yield* runPnpm(
        "/repository",
        ["view", "effect@rc", "version", "--json"],
        { capture: true }
      ).pipe(
        Effect.provide(
          scriptedSpawner(
            spawned,
            Effect.succeed({
              exitCode: Effect.succeed(0),
              stderr: Stream.make(encoder.encode("warn\n")),
              stdout: Stream.make(
                encoder.encode('"4.0.0-'),
                encoder.encode('rc.117"\n')
              ),
            })
          )
        )
      );

      assert.deepStrictEqual(result, {
        exitCode: 0,
        stderr: "warn\n",
        stdout: '"4.0.0-rc.117"\n',
      });
      assert.deepStrictEqual(startedOptions(spawned), [
        {
          args: ["view", "effect@rc", "version", "--json"],
          command: "pnpm",
          cwd: "/repository",
          stderr: "pipe",
          stdout: "pipe",
        },
      ]);
    })
  );

  it.effect("inherits the terminal and preserves the exit code", () =>
    Effect.gen(function* () {
      const spawned: ChildProcess.Command[] = [];
      const result = yield* runPnpm("/repository", [
        "update",
        "--recursive",
        "--latest",
      ]).pipe(
        Effect.provide(
          scriptedSpawner(
            spawned,
            Effect.succeed({
              exitCode: Effect.succeed(23),
              stderr: Stream.empty,
              stdout: Stream.empty,
            })
          )
        )
      );

      assert.deepStrictEqual(result, { exitCode: 23, stderr: "", stdout: "" });
      assert.deepStrictEqual(startedOptions(spawned), [
        {
          args: ["update", "--recursive", "--latest"],
          command: "pnpm",
          cwd: "/repository",
          stderr: "inherit",
          stdout: "inherit",
        },
      ]);
    })
  );

  it.effect("reports processes that cannot start or finish", () =>
    Effect.gen(function* () {
      const spawnFailure = yield* runPnpm("/repository", ["install"], {
        capture: true,
      }).pipe(
        Effect.provide(scriptedSpawner([], Effect.fail(brokenPipe))),
        Effect.flip
      );
      const exitFailure = yield* runPnpm("/repository", ["update"]).pipe(
        Effect.provide(
          scriptedSpawner(
            [],
            Effect.succeed({
              exitCode: Effect.fail(brokenPipe),
              stderr: Stream.empty,
              stdout: Stream.empty,
            })
          )
        ),
        Effect.flip
      );
      const outputFailure = yield* runPnpm("/repository", ["outdated"], {
        capture: true,
      }).pipe(
        Effect.provide(
          scriptedSpawner(
            [],
            Effect.succeed({
              exitCode: Effect.succeed(0),
              stderr: Stream.empty,
              stdout: Stream.fail(brokenPipe),
            })
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
          ["DependencyCommandError", brokenPipe, "Unable to run pnpm install."],
          [
            "DependencyCommandError",
            brokenPipe,
            "Unable to finish pnpm update.",
          ],
          [
            "DependencyCommandError",
            brokenPipe,
            "Unable to finish pnpm outdated.",
          ],
        ]
      );
    })
  );
});
