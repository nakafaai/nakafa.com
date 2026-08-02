import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress";
import { insertTryoutAttempt } from "@repo/backend/test/tryout-runtime";
import { insertTryoutSet, TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const SIGNED_SET_IDENTITY = tryoutCatalogIdentity({
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "set",
  locale: "id",
  setKey: "set-1",
  trackKey: "2027",
});
type ProgressInput = Parameters<typeof writeTryoutSetProgress>[1];
type ProgressScoreMismatch = Pick<
  ProgressInput,
  "publishedScore" | "status"
> & {
  readonly message: string;
};

/** Inserts one attempt carrying both ownership identities during cutover. */
async function seedDualIdentityAttempt(ctx: MutationCtx, suffix: string) {
  const user = await seedAuthenticatedUser(ctx, {
    now: TRYOUT_TEST_NOW,
    suffix,
  });
  const tryoutSetId = await insertTryoutSet(ctx);
  const attemptId = await insertTryoutAttempt(ctx, {
    scoringStrategy: "raw",
    sectionSnapshots: [],
    tryoutSetId,
    userId: user.userId,
  });
  await ctx.db.patch(attemptId, {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    setIdentity: SIGNED_SET_IDENTITY,
    setKey: "set-1",
    trackKey: "2027",
  });
  const attempt = await ctx.db.get(attemptId);

  if (!attempt) {
    throw new Error("Expected a dual-identity attempt fixture.");
  }

  return { attempt, tryoutSetId, userId: user.userId };
}

/** Verifies that one invalid progress score pair fails through the typed seam. */
async function expectProgressScoreMismatch(scenario: ProgressScoreMismatch) {
  const t = createConvexTestWithBetterAuth();

  await expect(
    t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: `tryout-progress-score-${scenario.status}`,
      });
      const tryoutSetId = await insertTryoutSet(ctx);
      const attemptId = await insertTryoutAttempt(ctx, {
        scoringStrategy: "raw",
        sectionSnapshots: [],
        status: scenario.status,
        tryoutSetId,
        userId: user.userId,
      });
      const attempt = await ctx.db.get(attemptId);

      if (!attempt) {
        throw new Error("Expected progress score fixtures.");
      }

      await Effect.runPromise(
        writeTryoutSetProgress(ctx, {
          attempt,
          publishedScore: scenario.publishedScore,
          status: scenario.status,
          updatedAt: TRYOUT_TEST_NOW,
        })
      );
    })
  ).rejects.toThrow(scenario.message);
}

describe("tryouts/progress", () => {
  it("keeps only the latest attempt and maps every workflow rank", async () => {
    const t = createConvexTestWithBetterAuth();

    const progress = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "tryout-progress",
      });
      const tryoutSetId = await insertTryoutSet(ctx);

      const firstAttemptId = await insertTryoutAttempt(ctx, {
        scoringStrategy: "raw",
        sectionSnapshots: [],
        tryoutSetId,
        userId: user.userId,
      });
      const firstAttempt = await ctx.db.get(firstAttemptId);

      if (!firstAttempt) {
        throw new Error("Expected first attempt fixture.");
      }

      await Effect.runPromise(
        writeTryoutSetProgress(ctx, {
          attempt: firstAttempt,
          publishedScore: null,
          status: "in-progress",
          updatedAt: TRYOUT_TEST_NOW,
        })
      );
      await Effect.runPromise(
        writeTryoutSetProgress(ctx, {
          attempt: firstAttempt,
          publishedScore: 75,
          status: "completed",
          updatedAt: TRYOUT_TEST_NOW + 1,
        })
      );

      const latestAttemptId = await insertTryoutAttempt(ctx, {
        scoringStrategy: "raw",
        sectionSnapshots: [],
        status: "expired",
        tryoutSetId,
        userId: user.userId,
      });
      await ctx.db.patch(latestAttemptId, { attemptNumber: 2 });
      const latestAttempt = await ctx.db.get(latestAttemptId);

      if (!latestAttempt) {
        throw new Error("Expected latest attempt fixture.");
      }

      await Effect.runPromise(
        writeTryoutSetProgress(ctx, {
          attempt: latestAttempt,
          publishedScore: 50,
          status: "expired",
          updatedAt: TRYOUT_TEST_NOW + 2,
        })
      );
      await Effect.runPromise(
        writeTryoutSetProgress(ctx, {
          attempt: firstAttempt,
          publishedScore: null,
          status: "in-progress",
          updatedAt: TRYOUT_TEST_NOW + 3,
        })
      );

      return await ctx.db
        .query("tryoutSetProgress")
        .withIndex("by_userId_and_tryoutSetId", (q) =>
          q.eq("userId", user.userId).eq("tryoutSetId", tryoutSetId)
        )
        .unique();
    });

    expect(progress).toMatchObject({
      attemptNumber: 2,
      publishedScore: 50,
      status: "expired",
      statusRank: 3,
    });
  });

  it("rejects active progress that exposes a score", async () => {
    await expectProgressScoreMismatch({
      message: "Active try-out progress cannot expose a score.",
      publishedScore: 80,
      status: "in-progress",
    });
  });

  it("rejects terminal progress without a score", async () => {
    await expectProgressScoreMismatch({
      message: "Terminal try-out progress requires a score.",
      publishedScore: null,
      status: "completed",
    });
  });

  it.each(Object.freeze(["filesystem", "signed"]))(
    "reconciles one %s progress row with both attempt identities",
    async (existingIdentity) => {
      const t = createConvexTestWithBetterAuth();

      const progress = await t.mutation(async (ctx) => {
        const fixture = await seedDualIdentityAttempt(
          ctx,
          `tryout-progress-${existingIdentity}`
        );
        const identity =
          existingIdentity === "filesystem"
            ? { tryoutSetId: fixture.tryoutSetId }
            : { setIdentity: SIGNED_SET_IDENTITY };
        await ctx.db.insert("tryoutSetProgress", {
          attemptNumber: 1,
          countryKey: "indonesia",
          examKey: "snbt",
          ...identity,
          latestAttemptId: fixture.attempt._id,
          locale: "id",
          publishedScore: null,
          setKey: "set-1",
          status: "in-progress",
          statusRank: 1,
          trackKey: "2027",
          updatedAt: TRYOUT_TEST_NOW,
          userId: fixture.userId,
        });

        await Effect.runPromise(
          writeTryoutSetProgress(ctx, {
            attempt: fixture.attempt,
            publishedScore: null,
            status: "in-progress",
            updatedAt: TRYOUT_TEST_NOW + 1,
          })
        );

        return await ctx.db
          .query("tryoutSetProgress")
          .withIndex("by_userId_and_setIdentity", (query) =>
            query
              .eq("userId", fixture.userId)
              .eq("setIdentity", SIGNED_SET_IDENTITY)
          )
          .unique();
      });

      expect(progress).toMatchObject({
        setIdentity: SIGNED_SET_IDENTITY,
        tryoutSetId: expect.any(String),
      });
    }
  );

  it("rejects progress rows split across signed and filesystem identities", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedDualIdentityAttempt(
          ctx,
          "tryout-progress-conflict"
        );
        const values = Object.freeze({
          attemptNumber: 1,
          countryKey: "indonesia",
          examKey: "snbt",
          latestAttemptId: fixture.attempt._id,
          locale: "id",
          publishedScore: null,
          setKey: "set-1",
          status: "in-progress",
          statusRank: 1,
          trackKey: "2027",
          updatedAt: TRYOUT_TEST_NOW,
          userId: fixture.userId,
        });
        await ctx.db.insert("tryoutSetProgress", {
          ...values,
          tryoutSetId: fixture.tryoutSetId,
        });
        await ctx.db.insert("tryoutSetProgress", {
          ...values,
          setIdentity: SIGNED_SET_IDENTITY,
        });

        await Effect.runPromise(
          writeTryoutSetProgress(ctx, {
            attempt: fixture.attempt,
            publishedScore: null,
            status: "in-progress",
            updatedAt: TRYOUT_TEST_NOW + 1,
          })
        );
      })
    ).rejects.toThrow("Try-out progress has conflicting set identities.");
  });
});
