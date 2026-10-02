import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedResponseFixture } from "@repo/backend/test/tryout/response";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Effect, Option } from "effect";

type FlagFixture = Effect.Success<ReturnType<typeof seedResponseFixture>>;

const readRuntime = Effect.fn("test.tryout.flag.readRuntime")(
  (fixture: FlagFixture) =>
    Effect.promise(() =>
      fixture.client.query(api.tryouts.queries.runtime.getSectionAttemptState, {
        attemptId: fixture.attemptId,
        locale: "id",
        sectionKey: TRYOUT_SECTION_KEY,
      })
    )
);

describe("tryouts/flag/read", () => {
  it.effect("reports each placement's flag in the live section runtime", () =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000))
      );
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "flag-runtime");
      const before = yield* readRuntime(seeded);
      expect(before?.runtime?.questions).toEqual([
        expect.objectContaining({
          flagged: false,
          placementId: seeded.placementId,
        }),
      ]);
      yield* Effect.promise(() =>
        seeded.client.mutation(api.tryouts.mutations.flags.set, {
          flagged: true,
          placementId: seeded.placementId,
        })
      );
      const after = yield* readRuntime(seeded);
      expect(after?.runtime?.questions).toEqual([
        expect.objectContaining({
          flagged: true,
          placementId: seeded.placementId,
        }),
      ]);
    })
  );
  it.effect.each([
    {
      code: "TRYOUT_FLAG_COUNT_EXCEEDED",
      corrupt: async (ctx: MutationCtx, fixture: FlagFixture) => {
        const section = await ctx.db.get(fixture.sectionAttemptId);
        for (let row = 0; row <= (section?.totalQuestions ?? 0); row += 1) {
          await ctx.db.insert("tryoutFlags", {
            flaggedAt: row,
            placementId: fixture.placementId,
            tryoutAttemptId: fixture.attemptId,
            tryoutSectionAttemptId: fixture.sectionAttemptId,
          });
        }
      },
      scenario: "flag-count",
    },
    {
      code: "TRYOUT_FLAG_LINK_MISMATCH",
      corrupt: async (ctx: MutationCtx, fixture: FlagFixture) => {
        const attempt = await ctx.db.get(fixture.attemptId);
        if (!attempt) {
          throw new Error("Expected one attempt.");
        }
        const { _creationTime, _id, ...values } = attempt;
        await ctx.db.insert("tryoutFlags", {
          flaggedAt: 1,
          placementId: fixture.placementId,
          tryoutAttemptId: await ctx.db.insert("tryoutAttempts", values),
          tryoutSectionAttemptId: fixture.sectionAttemptId,
        });
      },
      scenario: "flag-link",
    },
  ])("rejects a corrupt $scenario on read", ({ code, corrupt, scenario }) =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, scenario);
      yield* Effect.promise(() => t.mutation((ctx) => corrupt(ctx, seeded)));
      const rejected = yield* readRuntime(seeded).pipe(
        Effect.as(null),
        Effect.catchDefect(Effect.succeed)
      );
      expect(Ref.isConvexError(rejected)).toBe(true);
      const decoded = Ref.isConvexError(rejected)
        ? Ref.decodeErrorOption(
            refs.public.tryouts.queries.runtime.getSectionAttemptState,
            rejected.data
          )
        : Option.none();
      expect(
        Option.map(decoded, (error) => ({ code: error.code, tag: error._tag }))
      ).toEqual(Option.some({ code, tag: "TryoutResponseIntegrityError" }));
    })
  );
});
