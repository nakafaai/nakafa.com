import { api, internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/leaderboard", () => {
  it("derives leaderboard scores from theta instead of the stored leaderboard snapshot", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "leaderboard-reporting",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "2026-reporting-leaderboard"
      );
      const { tryoutAttemptId } = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "2026-reporting-leaderboard",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return {
        tryoutAttemptId,
        tryoutId: tryout.tryoutId,
      };
    });

    await t.mutation(
      internal.tryouts.mutations.internal.leaderboard.updateLeaderboard,
      {
        tryoutAttemptId: state.tryoutAttemptId,
      }
    );

    const result = await t.query(
      api.tryouts.queries.leaderboard.getTryoutLeaderboard,
      {
        tryoutId: state.tryoutId,
        limit: 10,
      }
    );

    expect(result).toEqual([
      expect.objectContaining({
        irtScore: 500,
        rank: 1,
        rawScore: 0,
        theta: 0,
      }),
    ]);
  });
});
