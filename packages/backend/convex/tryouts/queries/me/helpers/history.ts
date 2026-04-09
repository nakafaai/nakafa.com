import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { getTryoutPublicResultStatus } from "@repo/backend/convex/tryouts/helpers/publicResultStatus";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { loadLatestUserTryoutAttempt } from "@repo/backend/convex/tryouts/queries/me/helpers/context";
import { getAll } from "convex-helpers/server/relationships";

const MAX_TRYOUT_HISTORY_PAGE_SIZE = 25;

/**
 * Load one bounded raw newest-first history page for one tryout.
 */
async function loadRawUserTryoutAttemptHistoryPage(
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
  return await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
      q.eq("userId", userId).eq("tryoutId", tryout._id)
    )
    .order("desc")
    .paginate({
      ...paginationOpts,
      numItems: Math.min(paginationOpts.numItems, MAX_TRYOUT_HISTORY_PAGE_SIZE),
    });
}

/**
 * Load the access campaigns referenced by one history page.
 */
async function loadTryoutAccessCampaignsById(
  ctx: QueryCtx,
  attempts: Doc<"tryoutAttempts">[]
) {
  const campaignIds = new Set<Id<"tryoutAccessCampaigns">>();

  for (const attempt of attempts) {
    if (!attempt.accessCampaignId) {
      continue;
    }

    campaignIds.add(attempt.accessCampaignId);
  }

  if (campaignIds.size === 0) {
    return new Map<Id<"tryoutAccessCampaigns">, Doc<"tryoutAccessCampaigns">>();
  }

  const campaigns = await getAll(
    ctx.db,
    "tryoutAccessCampaigns",
    Array.from(campaignIds)
  );

  return new Map(
    campaigns.flatMap((campaign) =>
      campaign ? [[campaign._id, campaign]] : []
    )
  );
}

/** Build one public history row for the tryout history picker. */
async function buildTryoutAttemptHistoryRow(
  ctx: QueryCtx,
  {
    attempt,
    campaignsById,
    isLatest,
    tryout,
  }: {
    attempt: Doc<"tryoutAttempts">;
    campaignsById: Map<
      Id<"tryoutAccessCampaigns">,
      Doc<"tryoutAccessCampaigns">
    >;
    isLatest: boolean;
    tryout: Doc<"tryouts">;
  }
) {
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
    attemptNumber: attempt.attemptNumber,
    completedAt: attempt.completedAt,
    countsForCompetition: attempt.countsForCompetition ?? false,
    expiresAt: attempt.expiresAt,
    irtScore: finalizedSnapshot
      ? finalizedSnapshot.irtScore
      : getTryoutReportScore(tryout.product, attempt.theta),
    isLatest,
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
}

/** Build public history rows for one raw newest-first history page. */
async function buildTryoutAttemptHistoryRows(
  ctx: QueryCtx,
  {
    attempts,
    latestAttemptId,
    tryout,
  }: {
    attempts: Doc<"tryoutAttempts">[];
    latestAttemptId: Id<"tryoutAttempts">;
    tryout: Doc<"tryouts">;
  }
) {
  if (attempts.length === 0) {
    return [];
  }

  const campaignsById = await loadTryoutAccessCampaignsById(ctx, attempts);

  return await Promise.all(
    attempts.map((attempt) =>
      buildTryoutAttemptHistoryRow(ctx, {
        attempt,
        campaignsById,
        isLatest: attempt._id === latestAttemptId,
        tryout,
      })
    )
  );
}

/** Load one stable newest-first history page for one tryout. */
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
  const [latestAttempt, rawHistoryPage] = await Promise.all([
    loadLatestUserTryoutAttempt(ctx, {
      tryoutId: tryout._id,
      userId,
    }),
    loadRawUserTryoutAttemptHistoryPage(ctx, {
      paginationOpts,
      tryout,
      userId,
    }),
  ]);
  if (rawHistoryPage.page.length === 0) {
    return {
      ...rawHistoryPage,
      page: [],
    };
  }

  const latestAttemptId = latestAttempt?._id ?? rawHistoryPage.page[0]._id;

  return {
    ...rawHistoryPage,
    page: await buildTryoutAttemptHistoryRows(ctx, {
      attempts: rawHistoryPage.page,
      latestAttemptId,
      tryout,
    }),
  };
}
