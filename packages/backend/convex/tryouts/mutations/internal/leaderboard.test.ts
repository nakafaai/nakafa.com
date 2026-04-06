import { internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/mutations/internal/leaderboard", () => {
  it("stores leaderboard entries without persisting a legacy irtScore field", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "leaderboard-write",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "2026-reporting-leaderboard-write"
      );
      const { tryoutAttemptId } = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "2026-reporting-leaderboard-write",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return {
        tryoutAttemptId,
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      };
    });

    await t.mutation(
      internal.tryouts.mutations.internal.leaderboard.updateLeaderboard,
      {
        tryoutAttemptId: state.tryoutAttemptId,
      }
    );

    const leaderboardEntry = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutLeaderboardEntries")
        .withIndex("by_tryoutId_and_userId", (q) =>
          q.eq("tryoutId", state.tryoutId).eq("userId", state.userId)
        )
        .unique();
    });

    expect(leaderboardEntry).not.toBeNull();
    expect(leaderboardEntry?.theta).toBe(0);

    if (!leaderboardEntry) {
      return;
    }

    expect("irtScore" in leaderboardEntry).toBe(false);
  });
});
