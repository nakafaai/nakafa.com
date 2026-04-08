import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { getTryoutPublicResultStatus } from "@repo/backend/convex/tryouts/helpers/publicResultStatus";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { loadResolvedUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  userTryoutAttemptHistoryResultValidator,
  userTryoutHistoryArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { getAll } from "convex-helpers/server/relationships";

const MAX_TRYOUT_HISTORY_PAGE_SIZE = 25;

/** Returns one newest-first page of stored attempt summaries for one tryout. */
export const getUserTryoutAttemptHistory = query({
  args: userTryoutHistoryArgs,
  returns: userTryoutAttemptHistoryResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadResolvedUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return {
        continueCursor: "",
        isDone: true,
        page: [],
      };
    }

    const attempts = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
        q.eq("userId", appUser._id).eq("tryoutId", context.tryout._id)
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(
          args.paginationOpts.numItems,
          MAX_TRYOUT_HISTORY_PAGE_SIZE
        ),
      });

    const campaigns = await getAll(
      ctx.db,
      "tryoutAccessCampaigns",
      attempts.page.flatMap((attempt) =>
        attempt.accessCampaignId ? [attempt.accessCampaignId] : []
      )
    );
    const campaignsById = new Map(
      campaigns.flatMap((campaign) =>
        campaign ? [[campaign._id, campaign]] : []
      )
    );

    return {
      ...attempts,
      page: await Promise.all(
        attempts.page.map(async (attempt) => {
          const endedAttemptHasUntouchedParts =
            attempt.status !== "in-progress" &&
            attempt.completedPartIndices.length <
              attempt.partSetSnapshots.length;
          const finalizedSnapshot = endedAttemptHasUntouchedParts
            ? await buildFinalizedTryoutSnapshot(ctx.db, {
                scaleVersionId: attempt.scaleVersionId,
                tryout: context.tryout,
                tryoutAttempt: attempt,
              })
            : null;

          return {
            attemptId: attempt._id,
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
      ),
    };
  },
});
