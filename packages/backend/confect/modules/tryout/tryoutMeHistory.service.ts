import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexQueryCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/confect/modules/tryout/tryoutFinalizeSnapshot.service";
import { loadLatestUserTryoutAttempt } from "@repo/backend/confect/modules/tryout/tryoutMeContext.service";
import { getTryoutReportScore } from "@repo/backend/confect/modules/tryout/tryoutReporting.service";
import { getTryoutPublicResultStatus } from "@repo/backend/confect/modules/tryout/tryoutResultStatus.service";
import { getAll } from "convex-helpers/server/relationships";
import { Effect } from "effect";

const MAX_TRYOUT_HISTORY_PAGE_SIZE = 25;

interface PaginationOpts {
  readonly cursor: string | null;
  readonly endCursor?: string | null;
  readonly id?: number;
  readonly maximumBytesRead?: number;
  readonly maximumRowsRead?: number;
  readonly numItems: number;
}

/** Loads a bounded raw history page for one user and tryout. */
const loadRawUserTryoutAttemptHistoryPage = Effect.fn(
  "tryouts.me.loadRawUserTryoutAttemptHistoryPage"
)(function* (
  ctx: ConvexQueryCtx,
  args: {
    readonly paginationOpts: PaginationOpts;
    readonly tryout: Doc<"tryouts">;
    readonly userId: Id<"users">;
  }
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutId_and_startedAt", (query) =>
        query.eq("userId", args.userId).eq("tryoutId", args.tryout._id)
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(
          args.paginationOpts.numItems,
          MAX_TRYOUT_HISTORY_PAGE_SIZE
        ),
      })
  );
});

/** Loads access campaigns referenced by history rows. */
const loadTryoutAccessCampaignsById = Effect.fn(
  "tryouts.me.loadTryoutAccessCampaignsById"
)(function* (ctx: ConvexQueryCtx, attempts: readonly Doc<"tryoutAttempts">[]) {
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

  const campaigns = yield* Effect.promise(() =>
    getAll(ctx.db, "tryoutAccessCampaigns", Array.from(campaignIds))
  );

  return new Map(
    campaigns.flatMap((campaign) =>
      campaign ? [[campaign._id, campaign] as const] : []
    )
  );
});

/** Builds one public tryout history row. */
const buildTryoutAttemptHistoryRow = Effect.fn(
  "tryouts.me.buildTryoutAttemptHistoryRow"
)(function* (
  ctx: ConvexQueryCtx,
  args: {
    readonly attempt: Doc<"tryoutAttempts">;
    readonly campaignsById: ReadonlyMap<
      Id<"tryoutAccessCampaigns">,
      Doc<"tryoutAccessCampaigns">
    >;
    readonly isLatest: boolean;
    readonly tryout: Doc<"tryouts">;
  }
) {
  const endedAttemptHasUntouchedParts =
    args.attempt.status !== "in-progress" &&
    args.attempt.completedPartIndices.length <
      args.attempt.partSetSnapshots.length;
  const finalizedSnapshot = endedAttemptHasUntouchedParts
    ? yield* buildFinalizedTryoutSnapshot(ctx.db, {
        scaleVersionId: args.attempt.scaleVersionId,
        tryout: args.tryout,
        tryoutAttempt: args.attempt,
      })
    : null;

  return {
    attemptId: args.attempt._id,
    attemptNumber: args.attempt.attemptNumber,
    completedAt: args.attempt.completedAt,
    countsForCompetition: args.attempt.countsForCompetition ?? false,
    expiresAt: args.attempt.expiresAt,
    irtScore: finalizedSnapshot
      ? finalizedSnapshot.irtScore
      : getTryoutReportScore(args.tryout.product, args.attempt.theta),
    isLatest: args.isLatest,
    publicResultStatus: getTryoutPublicResultStatus({
      accessCampaign: args.attempt.accessCampaignId
        ? (args.campaignsById.get(args.attempt.accessCampaignId) ?? null)
        : null,
      tryoutAttempt: args.attempt,
    }),
    scoreStatus: args.attempt.scoreStatus,
    startedAt: args.attempt.startedAt,
    status: args.attempt.status,
    totalCorrect: finalizedSnapshot
      ? finalizedSnapshot.totalCorrect
      : args.attempt.totalCorrect,
    totalQuestions: finalizedSnapshot
      ? finalizedSnapshot.totalQuestions
      : args.attempt.totalQuestions,
  };
});

/** Converts raw history attempts into public rows. */
const buildTryoutAttemptHistoryRows = Effect.fn(
  "tryouts.me.buildTryoutAttemptHistoryRows"
)(function* (
  ctx: ConvexQueryCtx,
  args: {
    readonly attempts: readonly Doc<"tryoutAttempts">[];
    readonly latestAttemptId: Id<"tryoutAttempts">;
    readonly tryout: Doc<"tryouts">;
  }
) {
  if (args.attempts.length === 0) {
    return [];
  }

  const campaignsById = yield* loadTryoutAccessCampaignsById(
    ctx,
    args.attempts
  );

  return yield* Effect.all(
    args.attempts.map((attempt) =>
      buildTryoutAttemptHistoryRow(ctx, {
        attempt,
        campaignsById,
        isLatest: attempt._id === args.latestAttemptId,
        tryout: args.tryout,
      })
    )
  );
});

/** Loads a public tryout history page for one user. */
export const loadUserTryoutAttemptHistoryPage = Effect.fn(
  "tryouts.me.loadUserTryoutAttemptHistoryPage"
)(function* (
  ctx: ConvexQueryCtx,
  args: {
    readonly paginationOpts: PaginationOpts;
    readonly tryout: Doc<"tryouts">;
    readonly userId: Id<"users">;
  }
) {
  const latestAttempt = yield* loadLatestUserTryoutAttempt(ctx, {
    tryoutId: args.tryout._id,
    userId: args.userId,
  });
  const rawHistoryPage = yield* loadRawUserTryoutAttemptHistoryPage(ctx, args);

  if (rawHistoryPage.page.length === 0) {
    return { ...rawHistoryPage, page: [] };
  }

  const latestAttemptId = latestAttempt?._id ?? rawHistoryPage.page[0]._id;
  const page = yield* buildTryoutAttemptHistoryRows(ctx, {
    attempts: rawHistoryPage.page,
    latestAttemptId,
    tryout: args.tryout,
  });

  return { ...rawHistoryPage, page };
});
