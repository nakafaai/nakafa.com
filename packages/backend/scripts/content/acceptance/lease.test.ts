import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import {
  leaseLocalRuntime,
  processStart,
} from "@repo/backend/scripts/content/acceptance/lease";
import { reserveLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { fixture, leaseClaims } from "@repo/backend/test/acceptance";
import { encodeJsonText } from "@repo/utilities/json";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Deferred,
  Effect,
  Exit,
  FileSystem,
  Ref,
  Schema,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/**
 * Reserves the runtime directory and records a claim of `pid` with `content`, as a
 * run that stopped without releasing its lease would leave it.
 */
const recordClaim = Effect.fn("LeaseTest.recordClaim")(function* (
  root: string,
  pid: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const reserved = yield* reserveLocalRuntime(root);
  const claim = `${reserved.directory}/using.${pid}.${yield* randomUuid}`;
  yield* fs.writeFileString(claim, content);
  return claim;
});

/** The ID of a child process that has exited, so no process holds that ID any more. */
const exitedProcessId = Effect.gen(function* () {
  const child = yield* ChildProcess.make(process.execPath, ["--version"], {
    stderr: "ignore",
    stdin: "ignore",
    stdout: "ignore",
  });
  yield* child.exitCode;
  return child.pid;
}).pipe(Effect.scoped);

describe("lease of the owned acceptance runtime", () => {
  it.live("refuses a lease that a live process holds", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture;
      const directory = `${root}/.cache/acceptance`;
      yield* reserveLocalRuntime(root);
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* leaseLocalRuntime(root);
          expect(
            yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
          ).toMatchObject({
            _tag: "AcceptanceRuntimeError",
            message: expect.stringContaining("in use"),
          });
          expect(yield* leaseClaims(directory)).toHaveLength(1);
        })
      );
      expect(yield* leaseClaims(directory)).toEqual([]);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "refuses a claim that a live process holds with the start time it recorded",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const child = yield* ChildProcess.make(
          process.execPath,
          ["-e", "setInterval(() => {}, 1000)"],
          { stderr: "ignore", stdin: "ignore", stdout: "ignore" }
        );
        const claim = yield* recordClaim(
          root,
          String(child.pid),
          yield* processStart(child.pid)
        );
        expect(
          yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining("in use"),
        });
        expect(yield* fs.exists(claim)).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live("refuses a claim held by PID 1 with its start time", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const claim = yield* recordClaim(root, "1", yield* processStart(1));
      expect(
        yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("in use"),
      });
      expect(yield* fs.exists(claim)).toBe(true);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live("refuses a claim that a live process is still writing", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const claim = yield* recordClaim(root, String(process.pid), "");
      expect(
        yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("in use"),
      });
      expect(yield* fs.exists(claim)).toBe(true);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "takes over a claim whose process has exited, and keeps files that are not claims",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const claim = yield* recordClaim(
          root,
          String(yield* exitedProcessId),
          ""
        );
        const manifest = `${root}/.cache/acceptance/manifest.json`;
        yield* fs.writeFileString(manifest, "{}");
        yield* Effect.scoped(leaseLocalRuntime(root));
        expect(yield* fs.exists(claim)).toBe(false);
        expect(yield* fs.readFileString(manifest)).toBe("{}");
        expect(yield* leaseClaims(`${root}/.cache/acceptance`)).toEqual([]);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "takes over a claim whose process ID now belongs to another process",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const claim = yield* recordClaim(
          root,
          String(process.pid),
          "a start time that this process did not record"
        );
        yield* Effect.scoped(leaseLocalRuntime(root));
        expect(yield* fs.exists(claim)).toBe(false);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  for (const pid of [
    "",
    "garbage",
    "0",
    "-1",
    "01",
    "+1",
    "1e0",
    "0x1",
    " 1",
    "2147483648",
  ]) {
    it.live(
      `takes over a claim whose name does not hold a canonical process ID: "${pid}"`,
      () =>
        Effect.gen(function* () {
          const { fs, root } = yield* fixture;
          const claim = yield* recordClaim(root, pid, "");
          yield* Effect.scoped(leaseLocalRuntime(root));
          expect(yield* fs.exists(claim)).toBe(false);
        }).pipe(Effect.provide(nodeServicesLayer))
    );
  }

  it.live(
    "takes over a lease whose holder releases while the start judges it",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const directory = `${root}/.cache/acceptance`;
        yield* reserveLocalRuntime(root);
        // The holder releases its claim just before the start reads it.
        const releasing: FileSystem.FileSystem = {
          ...fs,
          readFileString: (path, encoding) =>
            fs
              .remove(path, { force: true })
              .pipe(Effect.andThen(fs.readFileString(path, encoding))),
        };
        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* leaseLocalRuntime(root);
            yield* leaseLocalRuntime(root).pipe(
              Effect.provideService(FileSystem.FileSystem, releasing)
            );
            expect(yield* leaseClaims(directory)).toHaveLength(1);
          })
        );
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live("refuses both starts that race for one stale claim", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const stale = yield* recordClaim(
        root,
        String(yield* exitedProcessId),
        ""
      );
      const arrived = yield* Ref.make(0);
      const gate = yield* Deferred.make<void>();
      // Each start pauses at its removal of the stale claim until both have reached
      // it, so both judge the same stale claim before either one acts on the result.
      const racing: FileSystem.FileSystem = {
        ...fs,
        remove: (path, options) =>
          path === stale
            ? Ref.updateAndGet(arrived, (count) => count + 1).pipe(
                Effect.flatMap((count) =>
                  count === 2 ? Deferred.succeed(gate, undefined) : Effect.void
                ),
                Effect.andThen(Deferred.await(gate)),
                Effect.andThen(fs.remove(path, options))
              )
            : fs.remove(path, options),
      };
      const start = leaseLocalRuntime(root).pipe(
        Effect.provideService(FileSystem.FileSystem, racing),
        Effect.exit
      );
      // Both starts share one scope, so a start that succeeds keeps its claim
      // while the other one judges it, as a running operation does.
      const outcomes = yield* Effect.scoped(
        Effect.all([start, start], { concurrency: "unbounded" })
      );
      expect(Arr.filter(outcomes, Exit.isSuccess).length).toBeLessThanOrEqual(
        1
      );
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "refuses a lease when this process cannot report its own start time",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const reserved = yield* reserveLocalRuntime(root);
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        // Every `ps` exits with status 1, as a `ps` without the lstart column does.
        const withoutStartTimes = ChildProcessSpawner.make((command) =>
          spawner.spawn(
            ChildProcess.isStandardCommand(command) && command.command === "ps"
              ? ChildProcess.make("sh", ["-c", "exit 1"], { stdin: "ignore" })
              : command
          )
        );
        expect(
          yield* leaseLocalRuntime(root).pipe(
            Effect.scoped,
            Effect.provideService(
              ChildProcessSpawner.ChildProcessSpawner,
              withoutStartTimes
            ),
            Effect.flip
          )
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining("start time"),
        });
        expect(yield* leaseClaims(reserved.directory)).toEqual([]);
        expect(yield* fs.exists(reserved.directory)).toBe(true);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "reports a missing runtime directory as its own failure, not as in use",
    () =>
      Effect.gen(function* () {
        const { root } = yield* fixture;
        expect(
          yield* leaseLocalRuntime(root).pipe(Effect.scoped, Effect.flip)
        ).toMatchObject({ _tag: "PlatformError" });
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "finishes scoped cleanup after Ctrl-C closes the bun terminal",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-terminal-test-",
        });
        const manifest = yield* fs
          .readFileString(
            fileURLToPath(
              new URL("../../../../../package.json", import.meta.url)
            )
          )
          .pipe(
            Effect.flatMap(
              Schema.decodeUnknownEffect(
                Schema.fromJsonString(
                  Schema.Struct({ packageManager: Schema.String })
                )
              )
            )
          );
        yield* fs.makeDirectory(`${directory}/backend`);
        yield* fs.writeFileString(
          `${directory}/package.json`,
          encodeJsonText({
            private: true,
            packageManager: manifest.packageManager,
            scripts: { start: "bun run --cwd backend acceptance start" },
          })
        );
        yield* fs.writeFileString(
          `${directory}/backend/package.json`,
          encodeJsonText({
            private: true,
            scripts: { acceptance: "node entry.mjs" },
          })
        );
        yield* fs.writeFileString(
          `${directory}/backend/entry.mjs`,
          `import { Effect, FileSystem } from ${encodeJsonText(import.meta.resolve("effect"))};
import { ChildProcess } from ${encodeJsonText(import.meta.resolve("effect/process"))};
import { runMain } from ${encodeJsonText(import.meta.resolve("@effect/platform-node/NodeRuntime"))};
import { layer } from ${encodeJsonText(import.meta.resolve("@effect/platform-node/NodeServices"))};
import { withTerminal } from ${encodeJsonText(new URL("./terminal.ts", import.meta.url).href)};
runMain(withTerminal(Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.acquireRelease(
    fs.writeFileString("using", String(process.pid)),
    () => fs.remove("using")
  );
  const child = yield* ChildProcess.make(process.execPath,
    ["-e", "setInterval(() => {}, 1000)"], { stdin: "ignore" });
  yield* Effect.addFinalizer(() => Effect.sleep("150 millis"));
  yield* fs.writeFileString("owned.tmp", JSON.stringify([process.pid, child.pid]));
  yield* fs.rename("owned.tmp", "owned.json");
  yield* Effect.never;
})).pipe(Effect.provide(layer)));`
        );
        const driver = `${directory}/terminal.py`;
        yield* fs.writeFileString(
          driver,
          `import json, os, pty, select, signal, sys, time
from pathlib import Path
root = Path(sys.argv[1])
lease = root / "backend/using"
record = root / "backend/owned.json"
owned = []
output = bytearray()
pid, terminal = pty.fork()
if pid == 0:
    os.chdir(root)
    os.execvp("bun", ["bun", "run", "start"])
def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
def drain():
    readable, _, _ = select.select([terminal], [], [], 0.01)
    if readable:
        try:
            output.extend(os.read(terminal, 65536))
        except OSError:
            pass
try:
    deadline = time.monotonic() + 15
    while not record.exists():
        assert time.monotonic() < deadline, output.decode(errors="replace")
        drain()
    owned = json.loads(record.read_text())
    os.write(terminal, b"\\x03")
    while os.waitpid(pid, os.WNOHANG)[0] == 0:
        assert time.monotonic() < deadline, "bun did not stop"
        drain()
    os.close(terminal)
    terminal = None
    deadline = time.monotonic() + 5
    while lease.exists() or any(alive(child) for child in owned):
        assert time.monotonic() < deadline, "terminal hangup interrupted cleanup"
        time.sleep(0.01)
    print("terminal cleanup complete")
finally:
    if terminal is not None:
        os.close(terminal)
    if record.exists():
        owned = json.loads(record.read_text())
    for child in owned:
        try:
            os.kill(child, signal.SIGKILL)
        except ProcessLookupError:
            pass
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass
`
        );
        const outputPath = `${directory}/output.log`;
        yield* runAcceptanceCommand({
          command: "python3",
          args: [driver, directory],
          operation: "Acceptance terminal cleanup",
          stdoutPath: outputPath,
          stderrPath: outputPath,
          reportStderr: true,
        });
        expect(yield* fs.readFileString(outputPath)).toContain(
          "terminal cleanup complete"
        );
      }).pipe(Effect.provide(nodeServicesLayer)),
    30_000
  );
});
