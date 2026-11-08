import { afterEach, describe, expect, it } from "@effect/vitest";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  operatorMode,
  seedOperator,
} from "@repo/backend/scripts/content/acceptance/operator";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, FileSystem, Layer, Schema } from "effect";

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

/** What the local backend answers: a new account `user-1` whose app user is `app-1`. */
const ANSWERS = {
  "adapter:create": { _creationTime: 1, _id: "user-1" },
  "tenancy/seed:user": "app-1",
};

describe("synthetic acceptance operator", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "grants a new learner operator access before it answers its cookie",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble(ANSWERS);

        const cookie = yield* seedOperator().pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );

        expect(backend.argsOf("tenancy/seed:user")).toEqual({
          authId: "user-1",
        });
        expect(backend.argsOf("operators/staff:grant")).toEqual({
          userId: "app-1",
        });
        expect(cookie.name).toBe("better-auth.session_token");
      })
  );

  it.effect("grants nothing when the account has no app user", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble(ANSWERS, ["tenancy/seed:user"]);

      const error = yield* seedOperator().pipe(
        Effect.provide(Layer.merge(backend.layer, nodePlatform)),
        Effect.flip
      );

      expect(error._tag).toBe("AcceptanceRuntimeError");
      expect(backend.paths()).not.toContain("operators/staff:grant");
    })
  );

  it.effect("writes the operator's cookie to the file the mode names", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-operator-test-",
      });
      mocks.layer.mockReturnValue(localConvexDouble(ANSWERS).layer);

      yield* operatorMode.run(root, [`${root}/cookie.json`]);

      const cookie = yield* fs
        .readFileString(`${root}/cookie.json`)
        .pipe(
          Effect.flatMap(
            Schema.decodeEffect(Schema.fromJsonString(SessionCookie))
          )
        );
      expect(cookie.name).toBe("better-auth.session_token");
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the operator mode without its cookie file", () =>
    Effect.gen(function* () {
      expect(
        yield* operatorMode.run("/root", []).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance operator <cookie-file>",
      });
    }).pipe(Effect.provide(nodePlatform))
  );
});
