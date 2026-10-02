import { Ref } from "@confect/core";
import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { setTryoutFlag } from "@repo/backend/confect/tryouts/flag/write";
import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  authenticate,
  type ConvexTest,
  seedResponseFixture,
} from "@repo/backend/test/tryout/response";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect, Option } from "effect";

type FlagFixture = Effect.Success<ReturnType<typeof seedResponseFixture>>;
type FlagClient = FlagFixture["client"] | ConvexTest;

const setClock = Effect.fn("test.tryout.flag.setClock")((offset: number) =>
  Effect.sync(() => vi.setSystemTime(new Date(TRYOUT_TEST_NOW + offset)))
);
const setFlag = Effect.fn("test.tryout.flag.set")(
  (fixture: FlagFixture, flagged: boolean) =>
    Effect.promise(() =>
      fixture.client.mutation(api.tryouts.mutations.flags.set, {
        flagged,
        placementId: fixture.placementId,
      })
    )
);
const collectFlags = Effect.fn("test.tryout.flag.collect")((t: ConvexTest) =>
  Effect.promise(() => t.query((ctx) => ctx.db.query("tryoutFlags").collect()))
);
const expectFlagFailure = Effect.fn("test.tryout.flag.expectFailure")(
  function* (
    fixture: FlagFixture,
    expected: { readonly code: string; readonly tag: string },
    client: FlagClient = fixture.client
  ) {
    const rejected = yield* Effect.promise(() =>
      client
        .mutation(api.tryouts.mutations.flags.set, {
          flagged: true,
          placementId: fixture.placementId,
        })
        .catch((error: unknown) => error)
    );
    expect(Ref.isConvexError(rejected)).toBe(true);
    const decoded = Ref.isConvexError(rejected)
      ? Ref.decodeErrorOption(
          refs.public.tryouts.mutations.flags.set,
          rejected.data
        )
      : Option.none();
    expect(
      Option.map(decoded, (error) => ({ code: error.code, tag: error._tag }))
    ).toEqual(Option.some(expected));
  }
);
/** Inserts a section attempt owned by a copied attempt, for cross-link rows. */
async function insertForeignSection(ctx: MutationCtx, fixture: FlagFixture) {
  const attempt = await ctx.db.get(fixture.attemptId);
  const section = await ctx.db.get(fixture.sectionAttemptId);
  if (!(attempt && section)) {
    throw new Error("Expected one attempt and section attempt.");
  }
  const { _creationTime, _id, ...attemptValues } = attempt;
  const foreignAttemptId = await ctx.db.insert("tryoutAttempts", attemptValues);
  const {
    _creationTime: sectionTime,
    _id: sectionId,
    ...sectionValues
  } = section;
  return ctx.db.insert("tryoutSectionAttempts", {
    ...sectionValues,
    tryoutAttemptId: foreignAttemptId,
  });
}

describe("tryouts/flag/write", () => {
  it.effect("sets, keeps, and clears one flag idempotently", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "flag-toggle");
      yield* setClock(5000);
      expect(yield* setFlag(seeded, true)).toBeNull();
      const [flag] = yield* collectFlags(t);
      expect(flag).toMatchObject({
        flaggedAt: TRYOUT_TEST_NOW + 5000,
        placementId: seeded.placementId,
        tryoutAttemptId: seeded.attemptId,
        tryoutSectionAttemptId: seeded.sectionAttemptId,
      });
      yield* setClock(6000);
      yield* setFlag(seeded, true);
      expect(yield* collectFlags(t)).toEqual([flag]);
      yield* setFlag(seeded, false);
      expect(yield* collectFlags(t)).toEqual([]);
      expect(yield* setFlag(seeded, false)).toBeNull();
      expect(yield* collectFlags(t)).toEqual([]);
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          section: await ctx.db.get(seeded.sectionAttemptId),
        }))
      );
      expect(state.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
      expect(state.section?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
    })
  );
  it.effect("rejects a signed-out caller and another learner", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "flag-owner");
      const outsider = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: TRYOUT_TEST_NOW,
            suffix: "flag-outsider",
          })
        )
      );
      yield* setClock(5000);
      yield* expectFlagFailure(
        seeded,
        { code: "UNAUTHENTICATED", tag: "SessionRequired" },
        t
      );
      yield* expectFlagFailure(
        seeded,
        { code: "TRYOUT_ATTEMPT_NOT_FOUND", tag: "TryoutAttemptStateError" },
        authenticate(t, outsider)
      );
      expect(yield* collectFlags(t)).toEqual([]);
    })
  );
  it.effect.each([
    {
      code: "TRYOUT_PLACEMENT_NOT_FOUND",
      corrupt: (ctx: MutationCtx, fixture: FlagFixture) =>
        ctx.db.delete(fixture.placementId),
      scenario: "missing-placement",
      tag: "TryoutFlagError",
    },
    {
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      corrupt: (ctx: MutationCtx, fixture: FlagFixture) =>
        ctx.db.patch(fixture.attemptId, { status: "completed" }),
      scenario: "finished-attempt",
      tag: "TryoutAttemptStateError",
    },
    {
      code: "TRYOUT_SECTION_NOT_ACTIVE",
      corrupt: (ctx: MutationCtx, fixture: FlagFixture) =>
        ctx.db.patch(fixture.sectionAttemptId, { status: "completed" }),
      scenario: "finished-section",
      tag: "TryoutAttemptStateError",
    },
    {
      code: "TRYOUT_EXPIRED",
      corrupt: (ctx: MutationCtx, fixture: FlagFixture) =>
        ctx.db.patch(fixture.attemptId, { expiresAt: TRYOUT_TEST_NOW + 1000 }),
      scenario: "expired-attempt",
      tag: "TryoutFlagError",
    },
    {
      code: "TRYOUT_EXPIRED",
      corrupt: (ctx: MutationCtx, fixture: FlagFixture) =>
        ctx.db.patch(fixture.sectionAttemptId, {
          expiresAt: TRYOUT_TEST_NOW + 1000,
        }),
      scenario: "expired-section",
      tag: "TryoutFlagError",
    },
    {
      code: "TRYOUT_RESPONSE_LINK_MISMATCH",
      corrupt: (ctx: MutationCtx, fixture: FlagFixture) =>
        ctx.db.patch(fixture.placementId, {
          sectionIdentity: "corrupt-section-identity",
        }),
      scenario: "placement-outside-snapshot",
      tag: "TryoutResponseIntegrityError",
    },
    {
      code: "TRYOUT_FLAG_PLACEMENT_DUPLICATE",
      corrupt: async (ctx: MutationCtx, fixture: FlagFixture) => {
        for (const flaggedAt of [1, 2]) {
          await ctx.db.insert("tryoutFlags", {
            flaggedAt,
            placementId: fixture.placementId,
            tryoutAttemptId: fixture.attemptId,
            tryoutSectionAttemptId: fixture.sectionAttemptId,
          });
        }
      },
      scenario: "duplicate-flag",
      tag: "TryoutResponseIntegrityError",
    },
    {
      code: "TRYOUT_FLAG_LINK_MISMATCH",
      corrupt: async (ctx: MutationCtx, fixture: FlagFixture) => {
        await ctx.db.insert("tryoutFlags", {
          flaggedAt: 1,
          placementId: fixture.placementId,
          tryoutAttemptId: fixture.attemptId,
          tryoutSectionAttemptId: await insertForeignSection(ctx, fixture),
        });
      },
      scenario: "cross-linked-flag",
      tag: "TryoutResponseIntegrityError",
    },
  ])(
    "rejects a $scenario before writing a flag",
    ({ code, corrupt, scenario, tag }) =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, scenario);
        yield* Effect.promise(() => t.mutation((ctx) => corrupt(ctx, seeded)));
        const before = yield* collectFlags(t);
        yield* setClock(5000);
        yield* expectFlagFailure(seeded, { code, tag });
        expect(yield* collectFlags(t)).toEqual(before);
      })
  );
  it.effect("masks an unexpected attempt lookup failure", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "flag-storage-failure");
      yield* Effect.promise(() =>
        expect(
          t.mutation(async (ctx) => {
            const placement = await ctx.db.get(seeded.placementId);
            if (!placement) {
              throw new Error("Expected one frozen placement.");
            }
            const get = vi.spyOn(ctx.db, "get");
            get.mockResolvedValueOnce(placement);
            get.mockRejectedValueOnce(
              new Error("internal tryoutAttempts storage details")
            );
            return await Effect.runPromiseWith(runtimeServices)(
              setTryoutFlag({
                args: { flagged: true, placementId: seeded.placementId },
                now: TRYOUT_TEST_NOW + 5000,
                userId: seeded.identity.userId,
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            );
          })
        ).rejects.toMatchObject({
          code: "TRYOUT_FLAG_FAILED",
          message: "Unable to flag try-out question.",
        })
      );
    })
  );
});
