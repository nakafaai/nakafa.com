import { afterEach, describe, expect, it } from "@effect/vitest";
import { SessionCookies } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  ownerMode,
  seedOwner,
} from "@repo/backend/scripts/content/acceptance/owner";
import { ownerAddress } from "@repo/backend/scripts/content/acceptance/school";
import {
  ACCOUNT_SEED,
  localConvexDouble,
  PASSWORD_SIGN_IN,
  SESSION_COOKIES,
  SIGN_IN_ANSWERS,
} from "@repo/backend/test/acceptance";
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

/** Reads the session cookies that a mode wrote. */
const readCookies = Effect.fn(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(path)
    .pipe(
      Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(SessionCookies)))
    );
});

describe("acceptance owner", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "signs the account of the member's address in and claims the school for it",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble(SIGN_IN_ANSWERS);

        const cookies = yield* seedOwner("acc-1").pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );

        expect(backend.paths()).toEqual([
          ACCOUNT_SEED,
          PASSWORD_SIGN_IN,
          "tenancy/claims:run",
        ]);
        expect(backend.argsOf(ACCOUNT_SEED)).toMatchObject({
          email: ownerAddress("acc-1"),
        });
        expect(backend.argsOf("tenancy/claims:run")).toEqual({
          cursor: null,
          userId: "user-1",
        });
        expect(cookies).toEqual(SESSION_COOKIES);
      })
  );

  it.effect("claims nothing when the account cannot sign in", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble(SIGN_IN_ANSWERS, [PASSWORD_SIGN_IN]);

      const error = yield* seedOwner("acc-1").pipe(
        Effect.provide(Layer.merge(backend.layer, nodePlatform)),
        Effect.flip
      );

      expect(error).toMatchObject({ _tag: "AcceptanceRuntimeError" });
      expect(backend.paths()).not.toContain("tenancy/claims:run");
    })
  );

  it.effect("writes the member's cookies to the file the mode names", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-member-test-",
      });
      mocks.layer.mockReturnValue(localConvexDouble(SIGN_IN_ANSWERS).layer);

      yield* ownerMode.run(root, ["acc-1", `${root}/cookie.json`, "ignored"]);

      expect(yield* readCookies(`${root}/cookie.json`)).toEqual(
        SESSION_COOKIES
      );
      expect(mocks.layer).toHaveBeenCalledWith(root);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the mode without its school and cookie file", () =>
    Effect.gen(function* () {
      expect(
        yield* ownerMode.run("/root", ["acc-1"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance owner <school-slug> <cookie-file>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
