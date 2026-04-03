import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { tryoutLeaderboard } from "@repo/backend/convex/tryouts/aggregate";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("tryouts/queries/leaderboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      const leaderboardEntryId = await ctx.db.insert(
        "tryoutLeaderboardEntries",
        {
          tryoutId: tryout.tryoutId,
          userId: identity.userId,
          leaderboardNamespace: "snbt:id:2026",
          theta: 0,
          thetaSE: 1,
          rawScore: 0,
          completedAt: NOW,
          attemptId: await ctx.db.insert("tryoutAttempts", {
            userId: identity.userId,
            tryoutId: tryout.tryoutId,
            scaleVersionId: tryout.scaleVersionId,
            scoreStatus: "official",
            status: "completed",
            partSetSnapshots: [
              {
                partIndex: 0,
                partKey: "quantitative-knowledge",
                questionCount: 20,
                setId: tryout.setId,
              },
            ],
            completedPartIndices: [0],
            totalCorrect: 0,
            totalQuestions: 20,
            theta: 0,
            thetaSE: 1,
            startedAt: NOW,
            expiresAt: NOW + ATTEMPT_WINDOW_MS,
            lastActivityAt: NOW,
            completedAt: NOW,
            endReason: "submitted",
          }),
        }
      );

      return {
        leaderboardEntryId,
        tryoutId: tryout.tryoutId,
      };
    });

    vi.spyOn(tryoutLeaderboard, "paginate").mockResolvedValue({
      page: [{ id: state.leaderboardEntryId }],
    } as never);

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
