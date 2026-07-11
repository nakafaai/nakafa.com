import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress";
import { insertTryoutSet, TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { describe, expect, it } from "vitest";

describe("tryouts/progress", () => {
  it("keeps only the latest attempt and maps every workflow rank", async () => {
    const t = createConvexTestWithBetterAuth();

    const progress = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "tryout-progress",
      });
      const tryoutSetId = await insertTryoutSet(ctx);
      const set = await ctx.db.get(tryoutSetId);

      if (!set) {
        throw new Error("Expected try-out set fixture.");
      }

      const firstAttemptId = await ctx.db.insert("tryoutAttempts", {
        attemptNumber: 1,
        completedAt: null,
        completedSectionKeys: [],
        endReason: null,
        expiresAt: TRYOUT_TEST_NOW + 1000,
        lastActivityAt: TRYOUT_TEST_NOW,
        scoreStatus: "provisional",
        scoringStrategy: "raw",
        sectionSnapshots: [],
        startedAt: TRYOUT_TEST_NOW,
        status: "in-progress",
        totalCorrect: 0,
        totalQuestions: 0,
        tryoutSetId,
        userId: user.userId,
      });
      const firstAttempt = await ctx.db.get(firstAttemptId);

      if (!firstAttempt) {
        throw new Error("Expected first attempt fixture.");
      }

      await writeTryoutSetProgress(ctx, {
        attempt: firstAttempt,
        set,
        status: "in-progress",
        updatedAt: TRYOUT_TEST_NOW,
      });
      await writeTryoutSetProgress(ctx, {
        attempt: firstAttempt,
        set,
        status: "completed",
        updatedAt: TRYOUT_TEST_NOW + 1,
      });

      const latestAttemptId = await ctx.db.insert("tryoutAttempts", {
        attemptNumber: 2,
        completedAt: null,
        completedSectionKeys: [],
        endReason: null,
        expiresAt: TRYOUT_TEST_NOW + 2000,
        lastActivityAt: TRYOUT_TEST_NOW + 2,
        scoreStatus: "provisional",
        scoringStrategy: "raw",
        sectionSnapshots: [],
        startedAt: TRYOUT_TEST_NOW + 2,
        status: "expired",
        totalCorrect: 0,
        totalQuestions: 0,
        tryoutSetId,
        userId: user.userId,
      });
      const latestAttempt = await ctx.db.get(latestAttemptId);

      if (!latestAttempt) {
        throw new Error("Expected latest attempt fixture.");
      }

      await writeTryoutSetProgress(ctx, {
        attempt: latestAttempt,
        set,
        status: "expired",
        updatedAt: TRYOUT_TEST_NOW + 2,
      });
      await writeTryoutSetProgress(ctx, {
        attempt: firstAttempt,
        set,
        status: "in-progress",
        updatedAt: TRYOUT_TEST_NOW + 3,
      });

      return await ctx.db
        .query("tryoutSetProgress")
        .withIndex("by_userId_and_tryoutSetId", (q) =>
          q.eq("userId", user.userId).eq("tryoutSetId", tryoutSetId)
        )
        .unique();
    });

    expect(progress).toMatchObject({
      attemptNumber: 2,
      status: "expired",
      statusRank: 3,
    });
  });
});
