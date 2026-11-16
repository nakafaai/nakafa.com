import { afterEach, describe, expect, it } from "@effect/vitest";
import { SessionCookies } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  operatorMode,
  seedOperator,
} from "@repo/backend/scripts/content/acceptance/operator";
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

describe("synthetic acceptance operator", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "grants a new learner operator access before it answers its cookies",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble(SIGN_IN_ANSWERS);
        const cookies = yield* seedOperator().pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );
        expect(backend.paths()).toEqual([
          ACCOUNT_SEED,
          PASSWORD_SIGN_IN,
          "operators/staff:grant",
        ]);
        expect(backend.argsOf("operators/staff:grant")).toEqual({
          userId: "user-1",
        });
        expect(cookies).toEqual(SESSION_COOKIES);
      })
  );

  it.effect("grants nothing when the account cannot sign in", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble(SIGN_IN_ANSWERS, [PASSWORD_SIGN_IN]);
      const error = yield* seedOperator().pipe(
        Effect.provide(Layer.merge(backend.layer, nodePlatform)),
        Effect.flip
      );
      expect(error).toMatchObject({ _tag: "AcceptanceRuntimeError" });
      expect(backend.paths()).not.toContain("operators/staff:grant");
    })
  );

  it.effect("writes the operator's cookies to the file the mode names", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-operator-test-",
      });
      mocks.layer.mockReturnValue(localConvexDouble(SIGN_IN_ANSWERS).layer);
      yield* operatorMode.run(root, [`${root}/cookies.json`]);
      const cookies = yield* fs
        .readFileString(`${root}/cookies.json`)
        .pipe(
          Effect.flatMap(
            Schema.decodeEffect(Schema.fromJsonString(SessionCookies))
          )
        );
      expect(cookies).toEqual(SESSION_COOKIES);
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
