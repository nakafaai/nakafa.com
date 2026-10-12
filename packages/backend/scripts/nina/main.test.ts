import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import type { NinaGateError } from "@repo/backend/scripts/nina/error";
import type { Report } from "@repo/backend/scripts/nina/gate";
import { Effect, FileSystem } from "effect";

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<void, NinaGateError> | undefined;
  return {
    getEntry: () => entry,
    gate: vi.fn<() => Effect.Effect<Report>>(),
    runMain: vi.fn((program: Effect.Effect<void, NinaGateError>) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));
vi.mock("@repo/backend/scripts/nina/live", async () => {
  const { Layer } = await import("effect");
  return { DeploymentLive: Layer.empty };
});
vi.mock("@repo/backend/scripts/nina/gate", () => ({
  renderReport: ({ failures, table }: Report) =>
    `${table} with ${failures.length} failures`,
  runGate: mocks.gate,
}));

const originalExitCode = process.exitCode;
const execute = Effect.fn("NinaGateMainTest.execute")(function* () {
  yield* Effect.promise(() => import("@repo/backend/scripts/nina/main"));
  const entry = mocks.getEntry();
  if (entry === undefined) {
    return yield* Effect.die("main did not install its Effect entrypoint");
  }
  return yield* entry;
});

describe("the release gate command", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it.live(
    "loads through tsx and refuses a production deployment before any command",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "nina-gate-native-test-",
        });
        const outputPath = `${directory}/output.log`;

        const error = yield* runAcceptanceCommand({
          args: [
            "--import",
            "tsx",
            fileURLToPath(new URL("./main.ts", import.meta.url)),
          ],
          command: process.execPath,
          cwd: fileURLToPath(new URL("../..", import.meta.url)),
          env: { CONVEX_DEPLOYMENT: "prod:some-name-1" },
          operation: "Native release gate",
          reportStderr: true,
          stderrPath: outputPath,
          stdoutPath: outputPath,
        }).pipe(Effect.flip);

        expect(error.message).toContain(
          "Refusing to run against a deployment that is not a dev deployment"
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    60_000
  );

  it.live("prints the report and exits with 0 when the turn passes", () =>
    Effect.gen(function* () {
      const write = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mocks.gate.mockReturnValue(
        Effect.succeed({ failures: [], table: "the table" })
      );

      yield* execute();

      expect(write).toHaveBeenCalledWith("the table with 0 failures\n");
      expect(process.exitCode).toBe(0);
    })
  );

  it.live("prints the report and exits with 1 when the turn fails", () =>
    Effect.gen(function* () {
      const write = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mocks.gate.mockReturnValue(
        Effect.succeed({ failures: ["no cache read"], table: "the table" })
      );

      yield* execute();

      expect(write).toHaveBeenCalledWith("the table with 1 failures\n");
      expect(process.exitCode).toBe(1);
    })
  );
});
