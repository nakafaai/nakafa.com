import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { Effect, FileSystem, Schema } from "effect";

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<unknown, unknown> | undefined;
  return {
    prepare: vi.fn(),
    run: vi.fn(),
    clean: vi.fn(),
    getEntry: () => entry,
    runMain: vi.fn((program: Effect.Effect<unknown, unknown>) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));
vi.mock("@repo/backend/scripts/content/acceptance/build", () => ({
  prepareAcceptance: mocks.prepare,
  runAcceptance: mocks.run,
}));
vi.mock("@repo/backend/scripts/content/acceptance/local", () => ({
  cleanLocalRuntime: mocks.clean,
}));

const originalArgv = process.argv;
const execute = Effect.fn("AcceptanceCliTest.execute")(function* (
  mode?: string
) {
  process.argv =
    mode === undefined
      ? ["node", "acceptance"]
      : ["node", "acceptance", mode, "--filter=www"];
  yield* Effect.promise(
    () => import("@repo/backend/scripts/content/acceptance/main")
  );
  const entry = mocks.getEntry();
  if (entry === undefined) {
    return yield* Effect.die("CLI did not install its Effect entrypoint");
  }
  return yield* entry;
});

describe("isolated acceptance CLI", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const mock of [mocks.prepare, mocks.run, mocks.clean]) {
      mock.mockReturnValue(Effect.void);
    }
  });
  afterEach(() => {
    process.argv = originalArgv;
    vi.resetAllMocks();
  });

  it.live(
    "loads the real CLI through native Node before validating its mode",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-native-cli-test-",
        });
        const outputPath = `${directory}/output.log`;
        yield* runAcceptanceCommand({
          args: [
            fileURLToPath(new URL("./main.ts", import.meta.url)),
            "unsupported",
          ],
          command: process.execPath,
          operation: "Native acceptance CLI",
          stdoutPath: outputPath,
          stderrPath: outputPath,
        }).pipe(Effect.flip);
        expect(yield* fs.readFileString(outputPath)).toContain(
          "AcceptanceRuntimeError: Usage: acceptance <prepare|build|start|clean>"
        );
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "finishes scoped cleanup after Ctrl-C closes the pnpm terminal",
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
          JSON.stringify({
            private: true,
            packageManager: manifest.packageManager,
            scripts: { start: "pnpm --dir backend acceptance start" },
          })
        );
        yield* fs.writeFileString(
          `${directory}/backend/package.json`,
          JSON.stringify({
            private: true,
            scripts: { acceptance: "node entry.mjs" },
          })
        );
        yield* fs.writeFileString(
          `${directory}/backend/entry.mjs`,
          `import { Effect, FileSystem } from ${JSON.stringify(import.meta.resolve("effect"))};
import { ChildProcess } from ${JSON.stringify(import.meta.resolve("effect/unstable/process"))};
import { runMain } from ${JSON.stringify(import.meta.resolve("@effect/platform-node/NodeRuntime"))};
import { layer } from ${JSON.stringify(import.meta.resolve("@effect/platform-node/NodeServices"))};
import { withTerminal } from ${JSON.stringify(new URL("./process.ts", import.meta.url).href)};
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
    os.execvp("pnpm", ["pnpm", "start"])
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
        assert time.monotonic() < deadline, "pnpm did not stop"
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

  for (const mode of ["prepare", "build", "start", "clean"]) {
    it.live(
      `runs ${mode} at the repository root with exact forwarded arguments`,
      () =>
        Effect.gen(function* () {
          yield* execute(mode);
          if (mode === "prepare") {
            expect(mocks.prepare).toHaveBeenCalledWith(expect.any(String));
          }
          if (mode === "build" || mode === "start") {
            expect(mocks.run).toHaveBeenCalledWith(expect.any(String), mode, [
              "--filter=www",
            ]);
          }
          if (mode === "clean") {
            expect(mocks.clean).toHaveBeenCalledOnce();
          }
          expect(
            mocks.prepare.mock.calls.length +
              mocks.run.mock.calls.length +
              mocks.clean.mock.calls.length
          ).toBe(1);
        })
    );
  }
  for (const mode of [undefined, "unsupported"]) {
    it.live(`rejects ${mode} before any acceptance operation`, () =>
      Effect.gen(function* () {
        expect(yield* execute(mode).pipe(Effect.flip)).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining("Usage: acceptance"),
        });
        expect(mocks.prepare).not.toHaveBeenCalled();
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.clean).not.toHaveBeenCalled();
      })
    );
  }
});
