import { afterEach, describe, expect, it } from "@effect/vitest";
import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import { LocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  learnerMode,
  seedLearner,
  sessionCookieOf,
} from "@repo/backend/scripts/content/acceptance/learner";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { makeSignature } from "better-auth/crypto";
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
vi.mock("better-auth/crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("better-auth/crypto")>();
  return { ...original, makeSignature: vi.fn(original.makeSignature) };
});

/** What Better Auth's adapter answers for a created row. */
const CREATED = { _creationTime: 1, _id: "user-1" };
const CREATE = "adapter:create";
const LEARNER_EMAIL = /^learner-[0-9a-f]{16}@acceptance\.invalid$/u;

/** The session token a cookie carries, and whether Better Auth's signature over it holds. */
const verify = Effect.fn(function* (cookie: typeof SessionCookie.Type) {
  const [token = "", signature = ""] = decodeURIComponent(cookie.value).split(
    "."
  );
  const expected = yield* Effect.promise(() =>
    makeSignature(token, LOCAL_AUTH_SECRET)
  );
  return { signed: signature === expected, token };
});

describe("acceptance learner", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "creates a new learner, its session and its profile, and answers a cookie Better Auth reads",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble({ [CREATE]: CREATED });

        const cookie = yield* seedLearner().pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );

        expect(backend.paths()).toEqual([
          CREATE,
          CREATE,
          "auth/lifecycle:onCreate",
        ]);
        const [account, session] = backend.calls();
        expect(account?.call).toMatchObject({
          args: {
            input: {
              data: { email: expect.stringMatching(LEARNER_EMAIL) },
              model: "user",
            },
          },
          component: "betterAuth",
        });
        const { signed, token } = yield* verify(cookie);
        expect(cookie.name).toBe("better-auth.session_token");
        expect(signed).toBe(true);
        expect(session?.call.args).toMatchObject({
          input: { data: { token, userId: "user-1" }, model: "session" },
        });
        expect(session?.sensitiveValues).toEqual([token]);
      })
  );

  it.effect("fails when the session cannot be signed", () =>
    Effect.gen(function* () {
      vi.mocked(makeSignature).mockRejectedValueOnce(new Error("no key"));

      expect(yield* sessionCookieOf("token").pipe(Effect.flip)).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "The session cookie could not be signed.",
      });
    })
  );

  it.live(
    "creates the learner again after the local backend timed out, and only then",
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
                : Effect.succeed(call.path === CREATE ? CREATED : null);
            }),
        });

        yield* seedLearner().pipe(
          Effect.provide(
            Layer.merge(Layer.succeed(LocalConvex, timingOut), nodePlatform)
          )
        );

        expect(MutableList.toArray(calls)).toEqual([
          CREATE,
          CREATE,
          CREATE,
          "auth/lifecycle:onCreate",
        ]);
      })
  );

  it.effect("does not create the learner again after any other failure", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble({}, [CREATE]);

      const error = yield* seedLearner().pipe(
        Effect.provide(Layer.merge(backend.layer, nodePlatform)),
        Effect.flip
      );

      expect(error._tag).toBe("AcceptanceRuntimeError");
      expect(backend.paths()).toEqual([CREATE]);
    })
  );

  it.effect(
    "writes the cookie of a new learner to the file the mode names, mode 600",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-learner-test-",
        });
        mocks.layer.mockReturnValue(
          localConvexDouble({ [CREATE]: CREATED }).layer
        );

        yield* learnerMode.run(root, [`${root}/cookie.json`]);

        const cookie = yield* fs
          .readFileString(`${root}/cookie.json`)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(SessionCookie))
            )
          );
        expect((yield* verify(cookie)).signed).toBe(true);
        expect((yield* fs.stat(`${root}/cookie.json`)).mode % 0o1000).toBe(
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
