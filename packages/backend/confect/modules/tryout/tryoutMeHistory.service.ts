import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { TryoutAccessCampaigns } from "@repo/backend/confect/modules/tryout/access.tables";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/confect/modules/tryout/tryoutFinalizeSnapshot.service";
import { loadLatestUserTryoutAttempt } from "@repo/backend/confect/modules/tryout/tryoutMeContext.service";
import { getTryoutReportScore } from "@repo/backend/confect/modules/tryout/tryoutReporting.service";
import { getTryoutPublicResultStatus } from "@repo/backend/confect/modules/tryout/tryoutResultStatus.service";
import type {
  TryoutAttempts,
  Tryouts,
} from "@repo/backend/confect/modules/tryout/tryouts.tables";
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
)(function* (args: {
  readonly paginationOpts: PaginationOpts;
  readonly tryout: typeof Tryouts.Doc.Type;
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("tryoutAttempts")
    .index(
      "by_userId_and_tryoutId_and_startedAt",
      (query) =>
        query.eq("userId", args.userId).eq("tryoutId", args.tryout._id),
      "desc"
    )
    .paginate({
      ...args.paginationOpts,
      numItems: Math.min(
        args.paginationOpts.numItems,
        MAX_TRYOUT_HISTORY_PAGE_SIZE
      ),
    });
});

/** Loads access campaigns referenced by history rows. */
const loadTryoutAccessCampaignsById = Effect.fn(
  "tryouts.me.loadTryoutAccessCampaignsById"
)(function* (attempts: readonly (typeof TryoutAttempts.Doc.Type)[]) {
  const reader = yield* DatabaseReader;
  const campaignIds = new Set<Id<"tryoutAccessCampaigns">>();

  for (const attempt of attempts) {
    if (!attempt.accessCampaignId) {
      continue;
    }

    campaignIds.add(attempt.accessCampaignId);
  }

  if (campaignIds.size === 0) {
    return new Map<
      Id<"tryoutAccessCampaigns">,
      typeof TryoutAccessCampaigns.Doc.Type
    >();
  }

  const campaigns = yield* Effect.forEach(
    Array.from(campaignIds),
    (campaignId) =>
      reader
        .table("tryoutAccessCampaigns")
        .get(campaignId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)))
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
)(function* (args: {
  readonly attempt: typeof TryoutAttempts.Doc.Type;
  readonly campaignsById: ReadonlyMap<
    Id<"tryoutAccessCampaigns">,
    typeof TryoutAccessCampaigns.Doc.Type
  >;
  readonly isLatest: boolean;
  readonly tryout: typeof Tryouts.Doc.Type;
}) {
  const endedAttemptHasUntouchedParts =
    args.attempt.status !== "in-progress" &&
    args.attempt.completedPartIndices.length <
      args.attempt.partSetSnapshots.length;
  const finalizedSnapshot = endedAttemptHasUntouchedParts
    ? yield* buildFinalizedTryoutSnapshot({
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
)(function* (args: {
  readonly attempts: readonly (typeof TryoutAttempts.Doc.Type)[];
  readonly latestAttemptId: Id<"tryoutAttempts">;
  readonly tryout: typeof Tryouts.Doc.Type;
}) {
  if (args.attempts.length === 0) {
    return [];
  }

  const campaignsById = yield* loadTryoutAccessCampaignsById(args.attempts);

  return yield* Effect.all(
    args.attempts.map((attempt) =>
      buildTryoutAttemptHistoryRow({
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
)(function* (args: {
  readonly paginationOpts: PaginationOpts;
  readonly tryout: typeof Tryouts.Doc.Type;
  readonly userId: Id<"users">;
}) {
  const latestAttempt = yield* loadLatestUserTryoutAttempt({
    tryoutId: args.tryout._id,
    userId: args.userId,
  });
  const rawHistoryPage = yield* loadRawUserTryoutAttemptHistoryPage(args);

  if (rawHistoryPage.page.length === 0) {
    return { ...rawHistoryPage, page: [] };
  }

  const latestAttemptId = latestAttempt?._id ?? rawHistoryPage.page[0]._id;
  const page = yield* buildTryoutAttemptHistoryRows({
    attempts: rawHistoryPage.page,
    latestAttemptId,
    tryout: args.tryout,
  });

  return { ...rawHistoryPage, page };
});
