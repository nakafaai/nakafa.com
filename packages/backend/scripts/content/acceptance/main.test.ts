import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { Effect, FileSystem } from "effect";

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
