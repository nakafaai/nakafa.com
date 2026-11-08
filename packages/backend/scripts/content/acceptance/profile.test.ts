import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  profileMode,
  seedProfile,
  updateLearnerProfile,
} from "@repo/backend/scripts/content/acceptance/profile";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, FileSystem } from "effect";
import { TestClock } from "effect/testing";

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

const BEFORE = {
  _id: "user-1",
  email: "learner@acceptance.invalid",
  emailVerified: true,
  name: "Acceptance Learner",
};
const AFTER = { ...BEFORE, image: "https://example.test/a.png", name: "Ayu" };
const ANSWERS = {
  "adapter:findOne": BEFORE,
  "adapter:updateOne": AFTER,
};

describe("acceptance profile", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "writes the fields the test names, then runs the app's update trigger with the row before and after",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(1_800_000_000_000);
        const backend = localConvexDouble(ANSWERS);

        yield* updateLearnerProfile(backend.run, "user-1", { name: "Ayu" });

        expect(backend.paths()).toEqual([
          "adapter:findOne",
          "adapter:updateOne",
          "auth/lifecycle:onUpdate",
        ]);
        expect(backend.argsOf("adapter:updateOne")).toEqual({
          input: {
            model: "user",
            update: { name: "Ayu", updatedAt: 1_800_000_000_000 },
            where: [{ field: "_id", operator: "eq", value: "user-1" }],
          },
        });
        expect(backend.argsOf("auth/lifecycle:onUpdate")).toEqual({
          model: "user",
          newDoc: AFTER,
          oldDoc: BEFORE,
        });
      })
  );

  it.effect("writes nothing when no account has the auth id", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble({});

      const error = yield* updateLearnerProfile(backend.run, "nobody", {
        name: "Ayu",
      }).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "No learner account has the auth id nobody.",
      });
      expect(backend.paths()).toEqual(["adapter:findOne"]);
    })
  );

  it.effect("writes the profile of a learner in the running runtime", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble(ANSWERS);

      yield* seedProfile("user-1", { image: AFTER.image }).pipe(
        Effect.provide(backend.layer)
      );

      expect(backend.argsOf("adapter:updateOne")).toMatchObject({
        input: { update: { image: AFTER.image } },
      });
    })
  );

  it.effect(
    "writes the profile in the file the mode names for the auth id it names",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-profile-test-",
        });
        yield* fs.writeFileString(`${root}/profile.json`, '{"name":"Ayu"}');
        const backend = localConvexDouble(ANSWERS);
        mocks.layer.mockReturnValue(backend.layer);

        yield* profileMode.run(root, [
          "user-1",
          `${root}/profile.json`,
          "extra",
        ]);

        expect(backend.argsOf("adapter:updateOne")).toMatchObject({
          input: { update: { name: "Ayu" } },
        });
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the profile mode without its profile file", () =>
    Effect.gen(function* () {
      expect(
        yield* profileMode.run("/root", ["user-1"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance profile <auth-user-id> <profile-json-file>",
      });
    }).pipe(Effect.provide(nodePlatform))
  );
});
