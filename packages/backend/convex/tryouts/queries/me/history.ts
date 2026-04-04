import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { getTryoutPublicResultStatus } from "@repo/backend/convex/tryouts/helpers/publicResultStatus";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { loadLatestUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  userTryoutAttemptHistoryResultValidator,
  userTryoutLookupArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const MAX_TRYOUT_HISTORY_ATTEMPTS = 100;

/** Returns every stored attempt summary for one tryout, oldest first numbered. */
export const getUserTryoutAttemptHistory = query({
  args: userTryoutLookupArgs,
  returns: userTryoutAttemptHistoryResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadLatestUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return [];
    }

    const attempts = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
        q.eq("userId", appUser._id).eq("tryoutId", context.tryout._id)
      )
      .order("asc")
      .take(MAX_TRYOUT_HISTORY_ATTEMPTS + 1);

    if (attempts.length > MAX_TRYOUT_HISTORY_ATTEMPTS) {
      throw new ConvexError({
        code: "TOO_MANY_TRYOUT_ATTEMPTS",
        message: "Tryout attempt history exceeded the supported scan limit.",
      });
    }

    const campaigns = await getAll(
      ctx.db,
      "tryoutAccessCampaigns",
      attempts.flatMap((attempt) =>
        attempt.accessCampaignId ? [attempt.accessCampaignId] : []
      )
    );
    const campaignsById = new Map(
      campaigns.flatMap((campaign) =>
        campaign ? [[campaign._id, campaign]] : []
      )
    );

    return await Promise.all(
      attempts.map(async (attempt, index) => {
        const endedAttemptHasUntouchedParts =
          attempt.status !== "in-progress" &&
          attempt.completedPartIndices.length < attempt.partSetSnapshots.length;
        const finalizedSnapshot = endedAttemptHasUntouchedParts
          ? await buildFinalizedTryoutSnapshot(ctx.db, {
              scaleVersionId: attempt.scaleVersionId,
              tryout: context.tryout,
              tryoutAttempt: attempt,
            })
          : null;

        return {
          attemptId: attempt._id,
          attemptNumber: index + 1,
          completedAt: attempt.completedAt,
          countsForCompetition: attempt.countsForCompetition ?? false,
          expiresAt: attempt.expiresAt,
          irtScore: finalizedSnapshot
            ? finalizedSnapshot.irtScore
            : getTryoutReportScore(context.tryout.product, attempt.theta),
          publicResultStatus: getTryoutPublicResultStatus({
            accessCampaign: attempt.accessCampaignId
              ? (campaignsById.get(attempt.accessCampaignId) ?? null)
              : null,
            tryoutAttempt: attempt,
          }),
          scoreStatus: attempt.scoreStatus,
          startedAt: attempt.startedAt,
          status: attempt.status,
          totalCorrect: finalizedSnapshot
            ? finalizedSnapshot.totalCorrect
            : attempt.totalCorrect,
          totalQuestions: finalizedSnapshot
            ? finalizedSnapshot.totalQuestions
            : attempt.totalQuestions,
        };
      })
    );
  },
});
