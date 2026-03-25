import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { syncTryoutAttemptAggregates } from "@repo/backend/convex/tryouts/helpers/finalize/aggregates";
import { tryoutLeaderboardWorkpool } from "@repo/backend/convex/tryouts/workpool";
import { v } from "convex/values";

const TRYOUT_SCORE_PROMOTION_BATCH_SIZE = 100;

/** Promote completed provisional tryout scores to one official frozen scale. */
export const promoteProvisionalTryoutScores = internalMutation({
  args: {
    tryoutId: vv.id("tryouts"),
    scaleVersionId: vv.id("irtScaleVersions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scaleVersion = await ctx.db.get(
      "irtScaleVersions",
      args.scaleVersionId
    );

    if (!scaleVersion || scaleVersion.status !== "official") {
      return null;
    }

    const completedAttempts = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_tryoutId_and_scoreStatus_and_status_and_startedAt", (q) =>
        q
          .eq("tryoutId", args.tryoutId)
          .eq("scoreStatus", "provisional")
          .eq("status", "completed")
      )
      .order("asc")
      .take(TRYOUT_SCORE_PROMOTION_BATCH_SIZE);

    const remainingSlots =
      TRYOUT_SCORE_PROMOTION_BATCH_SIZE - completedAttempts.length;
    const expiredAttempts =
      remainingSlots === 0
        ? []
        : await ctx.db
            .query("tryoutAttempts")
            .withIndex(
              "by_tryoutId_and_scoreStatus_and_status_and_startedAt",
              (q) =>
                q
                  .eq("tryoutId", args.tryoutId)
                  .eq("scoreStatus", "provisional")
                  .eq("status", "expired")
            )
            .order("asc")
            .take(remainingSlots);

    const provisionalAttempts = [...completedAttempts, ...expiredAttempts];

    if (provisionalAttempts.length === 0) {
      return null;
    }

    const now = Date.now();

    for (const tryoutAttempt of provisionalAttempts) {
      const finalizedStatus =
        tryoutAttempt.status === "completed" ? "completed" : "expired";

      await syncTryoutAttemptAggregates({
        completedAtMs: tryoutAttempt.completedAt ?? now,
        ctx,
        now,
        scaleVersionId: scaleVersion._id,
        scoreStatus: "official",
        status: finalizedStatus,
        tryoutAttemptId: tryoutAttempt._id,
      });

      if (finalizedStatus !== "completed") {
        continue;
      }

      await tryoutLeaderboardWorkpool.enqueueMutation(
        ctx,
        internal.tryouts.mutations.internal.leaderboard.updateLeaderboard,
        {
          tryoutAttemptId: tryoutAttempt._id,
        }
      );
    }

    if (provisionalAttempts.length < TRYOUT_SCORE_PROMOTION_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.tryouts.mutations.internal.scoring
        .promoteProvisionalTryoutScores,
      args
    );

    return null;
  },
});
