import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  cardMode,
  seedCard,
} from "@repo/backend/scripts/content/acceptance/card";
import { CardFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, FileSystem, Schema } from "effect";

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

/** A temporary folder for the files a mode writes. */
const folder = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "acceptance-mode-test-" });
});

const ANSWER = { code: "ABCDE-FGHJK", loginName: "siswa.uji" };

describe("acceptance card", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds through identity/seed:card and answers what it returned",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble({ "identity/seed:card": ANSWER });

        const seeded = yield* seedCard("acc-1234abcd").pipe(
          Effect.provide(backend.layer)
        );

        expect(seeded).toEqual(ANSWER);
        expect(backend.argsOf("identity/seed:card")).toEqual({
          slug: "acc-1234abcd",
        });
      })
  );

  it.effect("writes what the mode seeded to the file it names, mode 600", () =>
    Effect.gen(function* () {
      const root = yield* folder;
      const output = `${root}/mode.json`;
      mocks.layer.mockReturnValue(
        localConvexDouble({ "identity/seed:card": ANSWER }).layer
      );

      yield* cardMode.run(root, ["acc-1234abcd", output, "ignored"]);

      const fs = yield* FileSystem.FileSystem;
      expect(
        yield* fs
          .readFileString(output)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(CardFixture))
            )
          )
      ).toEqual(ANSWER);
      expect((yield* fs.stat(output)).mode % 0o1000).toBe(0o600);
      expect(mocks.layer).toHaveBeenCalledWith(root);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the mode without its arguments", () =>
    Effect.gen(function* () {
      expect(yield* cardMode.run("/root", []).pipe(Effect.flip)).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance card <school-slug> <card-file>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
