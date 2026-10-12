import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { importAcceptanceRows } from "@repo/backend/scripts/content/acceptance/import";
import { Effect, FileSystem, MutableList } from "effect";

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

describe("acceptance row import", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "appends a rows file to one table of the local backend and nothing else",
    () =>
      Effect.gen(function* () {
        const specs = MutableList.make<CommandSpec>();
        mocks.read.mockReturnValue(
          Effect.succeed({ backend: "/runtime/backend" })
        );
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            const fs = yield* FileSystem.FileSystem;
            yield* fs.writeFileString(spec.stdoutPath, "Added 2 documents.");
          })
        );

        yield* importAcceptanceRows("/root", "chats", "/rows/chats.jsonl");

        expect(mocks.read).toHaveBeenCalledWith("/root");
        const calls = MutableList.toArray(specs);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.args).toEqual([
          "node_modules/convex/bin/main.js",
          "import",
          "--table",
          "chats",
          "--append",
          "--yes",
          "/rows/chats.jsonl",
        ]);
        expect(calls[0]?.cwd).toBe("/runtime/backend");
        expect(calls[0]?.env?.TMPDIR).toEqual(expect.any(String));
        expect(calls[0]?.env?.CONVEX_AGENT_MODE).toBe("anonymous");
        expect(calls[0]?.env?.CONVEX_DEPLOY_KEY).toBeUndefined();
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("requires a prepared and running local runtime", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.void);

      const error = yield* importAcceptanceRows(
        "/missing",
        "chats",
        "/rows/chats.jsonl"
      ).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("acceptance:prepare"),
      });
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});
