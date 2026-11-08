import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  appendRows,
  importMode,
} from "@repo/backend/scripts/content/acceptance/import";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, FileSystem } from "effect";

const mocks = vi.hoisted(() => ({ layer: vi.fn() }));
vi.mock(
  "@repo/backend/scripts/content/acceptance/convex",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/convex")
    >()),
    localConvexLayer: mocks.layer,
  })
);

describe("acceptance import", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect("appends the rows to the table it names", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble();

      yield* appendRows("chats", [{ type: "study" }]).pipe(
        Effect.provide(backend.layer)
      );

      expect(backend.imports()).toEqual([
        { rows: [{ type: "study" }], table: "chats" },
      ]);
    })
  );

  it.effect(
    "appends every line of the JSON Lines file the mode names, skipping blank lines",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-import-test-",
        });
        yield* fs.writeFileString(
          `${root}/chats.jsonl`,
          '{"type":"study","updatedAt":1}\n\n{"type":"study","updatedAt":2}\n'
        );
        const backend = localConvexDouble();
        mocks.layer.mockReturnValue(backend.layer);

        yield* importMode.run(root, ["chats", `${root}/chats.jsonl`]);

        expect(backend.imports()).toEqual([
          {
            rows: [
              { type: "study", updatedAt: 1 },
              { type: "study", updatedAt: 2 },
            ],
            table: "chats",
          },
        ]);
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the import mode without its rows file", () =>
    Effect.gen(function* () {
      expect(
        yield* importMode.run("/root", ["chats"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance import <table> <rows-file>",
      });
    }).pipe(Effect.provide(nodePlatform))
  );
});
