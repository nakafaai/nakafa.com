import { afterEach, describe, expect, it } from "@effect/vitest";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  seedTeacher,
  teacherAddress,
  teacherMode,
} from "@repo/backend/scripts/content/acceptance/teacher";

import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Array as Arr, Effect, FileSystem, Layer, Schema } from "effect";

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

/** What the local backend answers a member's sign-in: a new account `user-1` whose app user is `app-user-1`. */
const SIGN_IN = {
  "adapter:create": { _creationTime: 1, _id: "user-1" },
  "tenancy/seed:user": "app-user-1",
};

/** Reads the session cookie that a mode wrote. */
const readCookie = Effect.fn(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(path)
    .pipe(
      Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(SessionCookie)))
    );
});

describe("acceptance teacher", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "signs a new account of the member's address in and claims the school for its app user",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble(SIGN_IN);

        const cookie = yield* seedTeacher("acc-1").pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );

        expect(backend.argsOf("tenancy/seed:teacher")).toEqual({
          email: teacherAddress("acc-1"),
          locale: "id",
          name: "Acceptance Teacher",
          slug: "acc-1",
        });
        expect(backend.paths()).toEqual([
          "tenancy/seed:teacher",
          "adapter:findOne",
          "adapter:create",
          "adapter:create",
          "auth/lifecycle:onCreate",
          "tenancy/seed:user",
          "tenancy/claims:run",
        ]);
        expect(backend.argsOf("adapter:findOne")).toMatchObject({
          where: [{ field: "email", value: teacherAddress("acc-1") }],
        });
        expect(backend.argsOf("tenancy/seed:user")).toEqual({
          authId: "user-1",
        });
        expect(backend.argsOf("tenancy/claims:run")).toEqual({
          cursor: null,
          userId: "app-user-1",
        });
        expect(cookie.name).toBe("better-auth.session_token");
      })
  );

  it.effect(
    "signs the account that already holds the address in again, with a new session and no second account",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble({
          ...SIGN_IN,
          "adapter:findOne": { _id: "user-1" },
        });

        yield* seedTeacher("acc-1").pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );

        expect(
          Arr.filter(backend.paths(), (path) => path === "adapter:create")
        ).toHaveLength(1);
        expect(backend.argsOf("adapter:create")).toMatchObject({
          input: { data: { userId: "user-1" }, model: "session" },
        });
      })
  );

  it.effect("claims nothing when the new account has no app user", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble(SIGN_IN, ["tenancy/seed:user"]);

      const error = yield* seedTeacher("acc-1").pipe(
        Effect.provide(Layer.merge(backend.layer, nodePlatform)),
        Effect.flip
      );

      expect(error._tag).toBe("AcceptanceRuntimeError");
      expect(backend.paths()).not.toContain("tenancy/claims:run");
    })
  );

  it.effect("writes the member's cookie to the file the mode names", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-member-test-",
      });
      mocks.layer.mockReturnValue(localConvexDouble(SIGN_IN).layer);

      yield* teacherMode.run(root, ["acc-1", `${root}/cookie.json`, "ignored"]);

      expect((yield* readCookie(`${root}/cookie.json`)).name).toBe(
        "better-auth.session_token"
      );
      expect(mocks.layer).toHaveBeenCalledWith(root);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the mode without its school and cookie file", () =>
    Effect.gen(function* () {
      expect(
        yield* teacherMode.run("/root", ["acc-1"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance teacher <school-slug> <cookie-file>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
