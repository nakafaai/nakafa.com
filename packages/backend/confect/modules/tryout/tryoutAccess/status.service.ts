import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { TryoutAccessCampaigns } from "@repo/backend/confect/modules/tryout/access.tables";
import { syncTryoutAccessGrantStatus } from "@repo/backend/confect/modules/tryout/tryoutAccessEntitlements.service";
import { getTryoutAccessCampaignRedeemStatus } from "@repo/backend/confect/modules/tryout/tryoutAccessShared.service";
import { Clock, Duration, Effect } from "effect";

const TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE = 100;
type TryoutAccessCampaign = typeof TryoutAccessCampaigns.Doc.Type;

/** Finalizes a competition campaign once its event window has ended. */
export const finalizeCompetitionCampaignResultsIfNeeded = Effect.fn(
  "tryoutAccess.finalizeCompetitionCampaignResultsIfNeeded"
)(function* (campaign: TryoutAccessCampaign | null, now: number) {
  const writer = yield* DatabaseWriter;

  if (
    !campaign ||
    campaign.campaignKind !== "competition" ||
    campaign.resultsStatus !== "pending" ||
    campaign.endsAt > now
  ) {
    return null;
  }

  yield* writer.table("tryoutAccessCampaigns").patch(campaign._id, {
    resultsFinalizedAt: now,
    resultsStatus: "finalized",
  });
});

/** Internal mutation wrapper for competition finalization. */
export const finalizeCompetitionCampaignResults = Effect.fn(
  "tryoutAccess.finalizeCompetitionCampaignResults"
)(function* (args: { readonly campaignId: Id<"tryoutAccessCampaigns"> }) {
  const reader = yield* DatabaseReader;
  const now = yield* Clock.currentTimeMillis;
  const campaign = yield* reader
    .table("tryoutAccessCampaigns")
    .get(args.campaignId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  yield* finalizeCompetitionCampaignResultsIfNeeded(campaign, now);
  return null;
});

/** Synchronizes one campaign redeem status. */
export const syncCampaignRedeemStatus = Effect.fn(
  "tryoutAccess.syncCampaignRedeemStatus"
)(function* (args: { readonly campaignId: Id<"tryoutAccessCampaigns"> }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const campaign = yield* reader
    .table("tryoutAccessCampaigns")
    .get(args.campaignId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!campaign) {
    return null;
  }

  const redeemStatus = getTryoutAccessCampaignRedeemStatus(campaign, now);

  if (campaign.redeemStatus === redeemStatus) {
    return null;
  }

  yield* writer.table("tryoutAccessCampaigns").patch(campaign._id, {
    redeemStatus,
  });
  return null;
});

/** Expires one grant and mirrors entitlement rows. */
export const expireGrant = Effect.fn("tryoutAccess.expireGrant")(
  function* (args: { readonly grantId: Id<"tryoutAccessGrants"> }) {
    const reader = yield* DatabaseReader;
    const now = yield* Clock.currentTimeMillis;
    const grant = yield* reader
      .table("tryoutAccessGrants")
      .get(args.grantId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!grant) {
      return null;
    }

    yield* syncTryoutAccessGrantStatus(grant, now);
    return null;
  }
);

/** Sweeps overdue campaign, grant, entitlement, and competition states. */
export const sweepStates = Effect.fn("tryoutAccess.sweepStates")(function* () {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const now = yield* Clock.currentTimeMillis;
  const scheduledCampaigns = yield* reader
    .table("tryoutAccessCampaigns")
    .index("by_redeemStatus_and_startsAt", (query) =>
      query.eq("redeemStatus", "scheduled").lt("startsAt", now + 1)
    )
    .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE);
  const activeCampaigns = yield* reader
    .table("tryoutAccessCampaigns")
    .index("by_redeemStatus_and_endsAt", (query) =>
      query.eq("redeemStatus", "active").lt("endsAt", now + 1)
    )
    .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE);
  const overdueGrants = yield* reader
    .table("tryoutAccessGrants")
    .index("by_status_and_endsAt", (query) =>
      query.eq("status", "active").lt("endsAt", now + 1)
    )
    .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE);
  const pendingCompetitions = yield* reader
    .table("tryoutAccessCampaigns")
    .index("by_campaignKind_and_resultsStatus_and_endsAt", (query) =>
      query
        .eq("campaignKind", "competition")
        .eq("resultsStatus", "pending")
        .lt("endsAt", now + 1)
    )
    .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE);

  for (const campaign of [...scheduledCampaigns, ...activeCampaigns]) {
    const redeemStatus = getTryoutAccessCampaignRedeemStatus(campaign, now);

    if (campaign.redeemStatus === redeemStatus) {
      continue;
    }

    yield* writer.table("tryoutAccessCampaigns").patch(campaign._id, {
      redeemStatus,
    });
  }

  for (const grant of overdueGrants) {
    yield* syncTryoutAccessGrantStatus(grant, now);
  }

  for (const competition of pendingCompetitions) {
    yield* finalizeCompetitionCampaignResultsIfNeeded(competition, now);
  }

  if (
    scheduledCampaigns.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
    activeCampaigns.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
    overdueGrants.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
    pendingCompetitions.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE
  ) {
    return null;
  }

  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.tryoutAccess.mutations.internalFunctions.status.sweepStates,
    {}
  );

  return null;
});
