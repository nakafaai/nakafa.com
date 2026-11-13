import { afterEach, describe, expect, it } from "@effect/vitest";
import { LocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { SessionCookies } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  learnerMode,
  seedLearner,
} from "@repo/backend/scripts/content/acceptance/learner";
import {
  ACCOUNT_SEED,
  localConvexDouble,
  PASSWORD_SIGN_IN,
  SESSION_COOKIES,
  SIGN_IN_ANSWERS,
} from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, FileSystem, Layer, MutableList, Schema } from "effect";

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

describe("acceptance learner", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds a new learner and answers the cookies of the session Convex Auth made",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble(SIGN_IN_ANSWERS);
        const cookies = yield* seedLearner().pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );
        expect(cookies).toEqual(SESSION_COOKIES);
        expect(backend.paths()).toEqual([ACCOUNT_SEED, PASSWORD_SIGN_IN]);
      })
  );

  it.live(
    "seeds the learner again after the local backend timed out, and only then",
    () =>
      Effect.gen(function* () {
        const calls = MutableList.make<string>();
        const timingOut = LocalConvex.of({
          importRows: () => Effect.void,
          run: (operation, call) =>
            Effect.suspend(() => {
              MutableList.append(calls, call.path);
              return MutableList.toArray(calls).length === 1
                ? Effect.fail(
                    acceptanceRuntimeError(
                      `${operation} failed: Function execution timed out (maximum duration: 5s)`
                    )
                  )
                : Effect.succeed(
                    call.path === ACCOUNT_SEED ? SIGN_IN_ANSWERS[ACCOUNT_SEED] : SIGN_IN_ANSWERS[PASSWORD_SIGN_IN]
                  );
            }),
        });
        yield* seedLearner().pipe(
          Effect.provide(
            Layer.merge(Layer.succeed(LocalConvex, timingOut), nodePlatform)
          )
        );
        expect(MutableList.toArray(calls)).toEqual([ACCOUNT_SEED, ACCOUNT_SEED, PASSWORD_SIGN_IN]);
      })
  );

  it.effect("does not seed the learner again after any other failure", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble({}, [ACCOUNT_SEED]);
      const error = yield* seedLearner().pipe(
        Effect.provide(Layer.merge(backend.layer, nodePlatform)),
        Effect.flip
      );
      expect(error).toMatchObject({ _tag: "AcceptanceRuntimeError" });
      expect(backend.paths()).toEqual([ACCOUNT_SEED]);
    })
  );

  it.effect(
    "writes the cookies of a new learner to the file the mode names, mode 600",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-learner-test-",
        });
        mocks.layer.mockReturnValue(localConvexDouble(SIGN_IN_ANSWERS).layer);
        yield* learnerMode.run(root, [`${root}/cookies.json`]);
        const written = yield* fs
          .readFileString(`${root}/cookies.json`)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(SessionCookies))
            )
          );
        expect(written).toEqual(SESSION_COOKIES);
        expect((yield* fs.stat(`${root}/cookies.json`)).mode % 0o1000).toBe(
          0o600
        );
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the learner mode without its cookie file", () =>
    Effect.gen(function* () {
      expect(
        yield* learnerMode.run("/root", []).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance learner <cookie-file>",
      });
    }).pipe(Effect.provide(nodePlatform))
  );
});
