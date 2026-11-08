import { afterEach, describe, expect, it } from "@effect/vitest";
import { ForumFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  forumMode,
  seedForum,
} from "@repo/backend/scripts/content/acceptance/forum";
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

const ANSWER = {
  channelId: "channel-1",
  classId: "class-1",
  messages: ["Halo", "Apa kabar"],
};

describe("acceptance forum", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds through classroom/forum/seed:history and answers what it returned",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble({
          "classroom/forum/seed:history": ANSWER,
        });

        const seeded = yield* seedForum("acc-1", 2, 1).pipe(
          Effect.provide(backend.layer)
        );

        expect(seeded).toEqual(ANSWER);
        expect(backend.argsOf("classroom/forum/seed:history")).toEqual({
          classSlug: "fisika-x-1",
          count: 2,
          read: 1,
          slug: "acc-1",
        });
      })
  );

  it.effect("writes what the mode seeded to the file it names, mode 600", () =>
    Effect.gen(function* () {
      const root = yield* folder;
      const output = `${root}/mode.json`;
      const backend = localConvexDouble({
        "classroom/forum/seed:history": ANSWER,
      });
      mocks.layer.mockReturnValue(backend.layer);

      yield* forumMode.run(root, [
        "acc-1",
        "2",
        "1",
        output,
        "Siti Nurhaliza Kusumawardhani",
      ]);

      expect(backend.argsOf("classroom/forum/seed:history")).toMatchObject({
        author: "Siti Nurhaliza Kusumawardhani",
        count: 2,
      });

      const fs = yield* FileSystem.FileSystem;
      expect(
        yield* fs
          .readFileString(output)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(ForumFixture))
            )
          )
      ).toEqual(ANSWER);
      expect((yield* fs.stat(output)).mode % 0o1000).toBe(0o600);
      expect(mocks.layer).toHaveBeenCalledWith(root);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the mode without its arguments", () =>
    Effect.gen(function* () {
      expect(yield* forumMode.run("/root", []).pipe(Effect.flip)).toMatchObject(
        {
          _tag: "AcceptanceRuntimeError",
          message:
            "Usage: acceptance forum <school-slug> <count> <read> <forum-file>",
        }
      );
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
