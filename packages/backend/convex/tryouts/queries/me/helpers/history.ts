import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { getTryoutPublicResultStatus } from "@repo/backend/convex/tryouts/helpers/publicResultStatus";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { getAll } from "convex-helpers/server/relationships";

const MAX_TRYOUT_HISTORY_PAGE_SIZE = 25;

/**
 * Load one bounded newest-first history page for the selected tryout.
 */
export async function loadUserTryoutAttemptHistoryPage(
  ctx: QueryCtx,
  {
    paginationOpts,
    tryout,
    userId,
  }: {
    paginationOpts: {
      cursor: string | null;
      numItems: number;
    };
    tryout: Doc<"tryouts">;
    userId: Id<"users">;
  }
) {
  const attempts = await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
      q.eq("userId", userId).eq("tryoutId", tryout._id)
    )
    .order("desc")
    .paginate({
      ...paginationOpts,
      numItems: Math.min(paginationOpts.numItems, MAX_TRYOUT_HISTORY_PAGE_SIZE),
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
          attempt.completedPartIndices.length < attempt.partSetSnapshots.length;
        const finalizedSnapshot = endedAttemptHasUntouchedParts
          ? await buildFinalizedTryoutSnapshot(ctx.db, {
              scaleVersionId: attempt.scaleVersionId,
              tryout,
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
            : getTryoutReportScore(tryout.product, attempt.theta),
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
}
