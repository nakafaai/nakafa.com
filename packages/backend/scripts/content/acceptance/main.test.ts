import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import type {
  prepareAcceptance,
  runAcceptance,
} from "@repo/backend/scripts/content/acceptance/build";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import type { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import type { importAcceptanceRows } from "@repo/backend/scripts/content/acceptance/import";
import type { createAcceptanceInvite } from "@repo/backend/scripts/content/acceptance/invite";
import type { createAcceptanceLearner } from "@repo/backend/scripts/content/acceptance/learner";
import type { cleanLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import type { createAcceptanceOwner } from "@repo/backend/scripts/content/acceptance/owner";
import type { updateAcceptanceProfile } from "@repo/backend/scripts/content/acceptance/profile";
import type { createAcceptanceSchool } from "@repo/backend/scripts/content/acceptance/school";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, FileSystem, Schema } from "effect";

/** What the CLI can fail with: each operation's failures, the usage error, and the path lookup's. */
type EntryError =
  | Effect.Error<ReturnType<typeof prepareAcceptance>>
  | Effect.Error<ReturnType<typeof runAcceptance>>
  | Effect.Error<ReturnType<typeof cleanLocalRuntime>>
  | Effect.Error<ReturnType<typeof createAcceptanceLearner>>
  | Effect.Error<ReturnType<typeof createAcceptanceSchool>>
  | Effect.Error<ReturnType<typeof createAcceptanceOwner>>
  | Effect.Error<ReturnType<typeof createAcceptanceInvite>>
  | Effect.Error<ReturnType<typeof importAcceptanceRows>>
  | Effect.Error<ReturnType<typeof updateAcceptanceProfile>>
  | ReturnType<typeof acceptanceRuntimeError>
  | Effect.Error<ReturnType<FileSystem.FileSystem["realPath"]>>;

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<void, EntryError> | undefined;
  return {
    prepare: vi.fn(),
    run: vi.fn(),
    clean: vi.fn(),
    learner: vi.fn(),
    school: vi.fn(),
    owner: vi.fn(),
    invite: vi.fn(),
    teacher: vi.fn(),
    profile: vi.fn(),
    rows: vi.fn(),
    sitting: vi.fn(),
    getEntry: () => entry,
    runMain: vi.fn((program: Effect.Effect<void, EntryError>) => {
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
vi.mock("@repo/backend/scripts/content/acceptance/learner", () => ({
  createAcceptanceLearner: mocks.learner,
}));
vi.mock("@repo/backend/scripts/content/acceptance/school", () => ({
  createAcceptanceSchool: mocks.school,
}));
vi.mock("@repo/backend/scripts/content/acceptance/owner", () => ({
  createAcceptanceOwner: mocks.owner,
}));
vi.mock("@repo/backend/scripts/content/acceptance/invite", () => ({
  createAcceptanceInvite: mocks.invite,
}));
vi.mock("@repo/backend/scripts/content/acceptance/sitting", () => ({
  createAcceptanceSitting: mocks.sitting,
}));
vi.mock("@repo/backend/scripts/content/acceptance/teacher", () => ({
  createAcceptanceTeacher: mocks.teacher,
}));
vi.mock("@repo/backend/scripts/content/acceptance/import", () => ({
  importAcceptanceRows: mocks.rows,
}));
vi.mock("@repo/backend/scripts/content/acceptance/profile", () => ({
  updateAcceptanceProfile: mocks.profile,
}));

const originalArgv = process.argv;
const execute = Effect.fn("AcceptanceCliTest.execute")(function* (
  mode?: string,
  args: readonly string[] = ["--filter=www"]
) {
  process.argv =
    mode === undefined
      ? ["node", "acceptance"]
      : ["node", "acceptance", mode, ...args];
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
    for (const mock of [
      mocks.prepare,
      mocks.run,
      mocks.clean,
      mocks.learner,
      mocks.school,
      mocks.owner,
      mocks.invite,
      mocks.teacher,
      mocks.profile,
      mocks.rows,
      mocks.sitting,
    ]) {
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
          "AcceptanceRuntimeError: Usage: acceptance <prepare|build|start|clean|learner <cookie-file>|school <school-file>|owner <school-slug> <cookie-file>|teacher <school-slug> <cookie-file>|class-teacher <school-slug> <cookie-file>|invite <school-slug> <learner-address> <cookie-file>|sitting <school-slug> <learner-email> <sitting-file> [crowd]|import <table> <rows-file>|profile <auth-user-id> <profile-json-file>>"
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
          encodeJsonText({
            private: true,
            packageManager: manifest.packageManager,
            scripts: { start: "pnpm --dir backend acceptance start" },
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
import { withTerminal } from ${encodeJsonText(new URL("./process.ts", import.meta.url).href)};
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

  for (const mode of ["prepare", "build", "start", "clean", "learner"]) {
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
          if (mode === "learner") {
            expect(mocks.learner).toHaveBeenCalledWith(
              expect.any(String),
              "--filter=www"
            );
          }
          expect(
            mocks.prepare.mock.calls.length +
              mocks.run.mock.calls.length +
              mocks.clean.mock.calls.length +
              mocks.learner.mock.calls.length +
              mocks.school.mock.calls.length +
              mocks.owner.mock.calls.length +
              mocks.invite.mock.calls.length +
              mocks.sitting.mock.calls.length +
              mocks.profile.mock.calls.length +
              mocks.rows.mock.calls.length
          ).toBe(1);
        })
    );
  }

  it.live("imports the rows file of the table it names", () =>
    Effect.gen(function* () {
      yield* execute("import", ["chats", "/rows/chats.jsonl"]);

      expect(mocks.rows).toHaveBeenCalledOnce();
      expect(mocks.rows).toHaveBeenCalledWith(
        expect.any(String),
        "chats",
        "/rows/chats.jsonl"
      );
      expect(mocks.learner).not.toHaveBeenCalled();
    })
  );

  it.live("opens a school into the file that the school mode names", () =>
    Effect.gen(function* () {
      yield* execute("school", ["/out/school.json"]);

      expect(mocks.school).toHaveBeenCalledExactlyOnceWith(
        expect.any(String),
        "/out/school.json"
      );
      expect(mocks.learner).not.toHaveBeenCalled();
    })
  );

  it.live(
    "signs the Owner of the school it names in, into the file it names",
    () =>
      Effect.gen(function* () {
        yield* execute("owner", ["acc-1a2b3c4d", "/out/owner.json"]);

        expect(mocks.owner).toHaveBeenCalledExactlyOnceWith(
          expect.any(String),
          "acc-1a2b3c4d",
          "/out/owner.json"
        );
        expect(mocks.school).not.toHaveBeenCalled();
      })
  );

  it.live(
    "seeds the sitting of the school and learner it names, into the file it names",
    () =>
      Effect.gen(function* () {
        yield* execute("sitting", [
          "acc-1a2b3c4d",
          "learner@acceptance.example.test",
          "/out/sitting.json",
        ]);

        expect(mocks.sitting).toHaveBeenCalledExactlyOnceWith(
          expect.any(String),
          "acc-1a2b3c4d",
          "learner@acceptance.example.test",
          "/out/sitting.json",
          undefined
        );
        expect(mocks.school).not.toHaveBeenCalled();
      })
  );

  it.live(
    "signs the Teacher of the school it names in, into the file it names",
    () =>
      Effect.gen(function* () {
        yield* execute("teacher", ["acc-1a2b3c4d", "/out/teacher.json"]);

        expect(mocks.teacher).toHaveBeenCalledExactlyOnceWith(
          expect.any(String),
          "acc-1a2b3c4d",
          "/out/teacher.json"
        );
        expect(mocks.owner).not.toHaveBeenCalled();
      })
  );

  it.live("updates the profile of the account and the file it names", () =>
    Effect.gen(function* () {
      yield* execute("profile", ["user-1", "/rows/profile.json"]);

      expect(mocks.profile).toHaveBeenCalledOnce();
      expect(mocks.profile).toHaveBeenCalledWith(
        expect.any(String),
        "user-1",
        "/rows/profile.json"
      );
      expect(mocks.learner).not.toHaveBeenCalled();
      expect(mocks.rows).not.toHaveBeenCalled();
    })
  );

  it.live(
    "invites the learner the invite mode names into the cookie file the mode names",
    () =>
      Effect.gen(function* () {
        yield* execute("invite", [
          "acc-1a2b3c4d",
          "learner@acceptance.example.test",
          "/out/invite.json",
        ]);

        expect(mocks.invite).toHaveBeenCalledExactlyOnceWith(
          expect.any(String),
          "acc-1a2b3c4d",
          "learner@acceptance.example.test",
          "/out/invite.json"
        );
        expect(mocks.owner).not.toHaveBeenCalled();
      })
  );

  const rejected: readonly (readonly [string | undefined, string[]])[] = [
    [undefined, []],
    ["unsupported", []],
    ["learner", []],
    ["school", []],
    ["owner", ["acc-1a2b3c4d"]],
    ["invite", ["acc-1a2b3c4d"]],
    ["invite", ["acc-1a2b3c4d", "learner@acceptance.example.test"]],
    ["teacher", ["acc-1a2b3c4d"]],
    ["sitting", ["acc-1a2b3c4d", "learner@acceptance.example.test"]],
    ["import", []],
    ["import", ["chats"]],
    ["profile", []],
    ["profile", ["user-1"]],
  ];
  for (const [mode, args] of rejected) {
    it.live(
      `rejects ${mode} with ${args.length} arguments before any acceptance operation`,
      () =>
        Effect.gen(function* () {
          expect(yield* execute(mode, args).pipe(Effect.flip)).toMatchObject({
            _tag: "AcceptanceRuntimeError",
            message: expect.stringContaining("Usage: acceptance"),
          });
          expect(mocks.prepare).not.toHaveBeenCalled();
          expect(mocks.run).not.toHaveBeenCalled();
          expect(mocks.clean).not.toHaveBeenCalled();
          expect(mocks.learner).not.toHaveBeenCalled();
          expect(mocks.school).not.toHaveBeenCalled();
          expect(mocks.owner).not.toHaveBeenCalled();
          expect(mocks.teacher).not.toHaveBeenCalled();
          expect(mocks.profile).not.toHaveBeenCalled();
          expect(mocks.rows).not.toHaveBeenCalled();
        })
    );
  }
});
