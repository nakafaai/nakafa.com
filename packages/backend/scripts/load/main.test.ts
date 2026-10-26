import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { Effect, FileSystem } from "effect";

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<unknown, unknown> | undefined;
  return {
    command: vi.fn(),
    getEntry: () => entry,
    runMain: vi.fn((program: Effect.Effect<unknown, unknown>) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));
vi.mock("@repo/backend/scripts/load/command", () => ({
  runLoadCommand: mocks.command,
}));

describe("the load test command", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.live(
    "loads through Bun and refuses a command without its report file",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "load-native-test-",
        });
        const outputPath = `${directory}/output.log`;
        const error = yield* runAcceptanceCommand({
          args: [fileURLToPath(new URL("./main.ts", import.meta.url))],
          command: "bun",
          cwd: fileURLToPath(new URL("../..", import.meta.url)),
          env: {},
          operation: "Native load test",
          reportStderr: true,
          stderrPath: outputPath,
          stdoutPath: outputPath,
        }).pipe(Effect.flip);
        expect(error.message).toContain("Native load test failed");
        expect(yield* fs.readFileString(outputPath)).toContain(
          "Usage: acceptance load <report-file> [students] [minutes]"
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    60_000
  );

  it.live("runs the command from the repository root with its arguments", () =>
    Effect.gen(function* () {
      mocks.command.mockReturnValue(Effect.succeed("ran"));
      const argv = process.argv;
      process.argv = ["bun", "main.ts", "report.json", "300"];
      yield* Effect.promise(() => import("@repo/backend/scripts/load/main"));
      const entry = mocks.getEntry();
      expect(entry).toBeDefined();
      expect(yield* entry ?? Effect.void).toBe("ran");
      process.argv = argv;
      const [root, args] = mocks.command.mock.calls[0] ?? [];
      expect(root).toBe(
        fileURLToPath(new URL("../../../..", import.meta.url)).replace(
          /\/$/u,
          ""
        )
      );
      expect(args).toEqual(["report.json", "300"]);
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});
