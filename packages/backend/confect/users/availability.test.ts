import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { inspectUsername } from "@repo/backend/confect/users/availability";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Effect, Result } from "effect";

/** Seeds one account that holds `username`, and returns its id. */
const seedHolder = Effect.fn("test.seedHolder")(function* (username: string) {
  const ctx = yield* MutationCtx;
  return yield* Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `auth-${username}`,
      credits: 100,
      creditsResetAt: 0,
      email: `${username}@example.com`,
      mascot: MASCOT_CODE,
      name: username,
      plan: "free",
      username,
    })
  );
});

describe("users/availability", () => {
  it.effect("answers the stored username when no account holds it", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          yield* seedHolder("someone");
          expect(yield* inspectUsername("  NabilFatih ")).toEqual(
            Result.succeed("nabilfatih")
          );
        })
      );
    })
  );

  it.effect("refuses a username that another account holds in any case", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const holderId = yield* seedHolder("nabilfatih");
          const stranger = yield* seedHolder("stranger");
          expect(yield* inspectUsername("NabilFatih")).toEqual(
            Result.fail("taken")
          );
          expect(yield* inspectUsername("nabilfatih", stranger)).toEqual(
            Result.fail("taken")
          );
          expect(yield* inspectUsername("nabilfatih", holderId)).toEqual(
            Result.succeed("nabilfatih")
          );
        })
      );
    })
  );

  it.effect("refuses a reserved name that no account holds", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          expect(yield* inspectUsername("Admin")).toEqual(
            Result.fail("notAllowed")
          );
          expect(yield* inspectUsername("pricing")).toEqual(
            Result.fail("notAllowed")
          );
        })
      );
    })
  );

  it.effect("refuses a text that is no username without reading accounts", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const query = vi.spyOn(ctx.db, "query");
          expect(yield* inspectUsername("1abc")).toEqual(
            Result.fail("letterFirst")
          );
          expect(yield* inspectUsername("ab")).toEqual(Result.fail("tooShort"));
          expect(query).not.toHaveBeenCalled();
        })
      );
    })
  );
});
