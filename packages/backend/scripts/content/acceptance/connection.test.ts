import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import {
  connectionMode,
  createAcceptanceConnection,
} from "@repo/backend/scripts/content/acceptance/connection";
import { Array as Arr, Effect, Exit, FileSystem, MutableList } from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn(), read: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));
vi.mock(
  "@repo/backend/scripts/content/acceptance/local",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/local")
    >()),
    readLocalRuntime: mocks.read,
  })
);

type CommandSpec = Parameters<typeof runAcceptanceCommand>[0];

describe("acceptance connection", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds the connection the mode names through the seed function",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-connection-test-",
        });
        mocks.read.mockReturnValue(
          Effect.succeed({ backend: `${root}/backend` })
        );
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(spec.stdoutPath, "null");
          })
        );

        yield* connectionMode.run(root, ["acc-1234abcd", "reconnect"]);

        const [spec] = MutableList.toArray(specs);
        expect(Arr.drop(spec?.args ?? [], 1)).toEqual([
          "run",
          "connectors/seed:connection",
          '{"slug":"acc-1234abcd","status":"reconnect"}',
        ]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("seeds no connection when no local runtime is running", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceConnection("/root", "acc-1234abcd", "active")
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
