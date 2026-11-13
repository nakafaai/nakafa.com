import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  profileMode,
  seedProfile,
} from "@repo/backend/scripts/content/acceptance/profile";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, FileSystem, Layer } from "effect";

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

const PROFILE = "acceptance/accounts:profile";
const IMAGE = "https://example.test/ayu.png";

describe("acceptance profile", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect("writes only the fields a test names, for the learner of an account id", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble();
      yield* seedProfile("user-1", { image: IMAGE }).pipe(
        Effect.provide(Layer.merge(backend.layer, nodePlatform))
      );
      yield* seedProfile("user-1", { name: "Ayu" }).pipe(
        Effect.provide(Layer.merge(backend.layer, nodePlatform))
      );
      expect(backend.calls()).toMatchObject([
        { call: { args: { image: IMAGE, userId: "user-1" }, path: PROFILE } },
        { call: { args: { name: "Ayu", userId: "user-1" }, path: PROFILE } },
      ]);
    })
  );

  it.effect(
    "writes the profile in the file the mode names, in the running runtime",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-profile-test-",
        });
        const backend = localConvexDouble();
        mocks.layer.mockReturnValue(backend.layer);
        yield* fs.writeFileString(
          `${root}/profile.json`,
          `{"image":"${IMAGE}","name":"Ayu"}`
        );
        yield* profileMode.run(root, ["user-1", `${root}/profile.json`]);
        expect(backend.argsOf(PROFILE)).toEqual({
          image: IMAGE,
          name: "Ayu",
          userId: "user-1",
        });
        expect(mocks.layer).toHaveBeenCalledWith(root);
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the profile mode without its profile file", () =>
    Effect.gen(function* () {
      expect(
        yield* profileMode.run("/root", ["user-1"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance profile <user-id> <profile-json-file>",
      });
    }).pipe(Effect.provide(nodePlatform))
  );
});
