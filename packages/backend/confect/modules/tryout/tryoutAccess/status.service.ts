import { Ref } from "@confect/core";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { syncTryoutAccessGrantStatus } from "@repo/backend/confect/modules/tryout/tryoutAccessEntitlements.service";
import { getTryoutAccessCampaignRedeemStatus } from "@repo/backend/confect/modules/tryout/tryoutAccessShared.service";
import { Clock, Effect } from "effect";

const TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE = 100;

/** Finalizes a competition campaign once its event window has ended. */
export const finalizeCompetitionCampaignResultsIfNeeded = Effect.fn(
  "tryoutAccess.finalizeCompetitionCampaignResultsIfNeeded"
)(function* (
  db: ConvexMutationCtx["db"],
  campaign: Doc<"tryoutAccessCampaigns"> | null,
  now: number
) {
  if (
    !campaign ||
    campaign.campaignKind !== "competition" ||
    campaign.resultsStatus !== "pending" ||
    campaign.endsAt > now
  ) {
    return null;
  }

  yield* Effect.promise(() =>
    db.patch(campaign._id, {
      resultsFinalizedAt: now,
      resultsStatus: "finalized",
    })
  );
});

/** Internal mutation wrapper for competition finalization. */
export const finalizeCompetitionCampaignResults = Effect.fn(
  "tryoutAccess.finalizeCompetitionCampaignResults"
)(function* (args: { readonly campaignId: Id<"tryoutAccessCampaigns"> }) {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;
  const campaign = yield* Effect.promise(() => ctx.db.get(args.campaignId));
  yield* finalizeCompetitionCampaignResultsIfNeeded(ctx.db, campaign, now);
  return null;
});

/** Synchronizes one campaign redeem status. */
export const syncCampaignRedeemStatus = Effect.fn(
  "tryoutAccess.syncCampaignRedeemStatus"
)(function* (args: { readonly campaignId: Id<"tryoutAccessCampaigns"> }) {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;
  const campaign = yield* Effect.promise(() => ctx.db.get(args.campaignId));

  if (!campaign) {
    return null;
  }

  const redeemStatus = getTryoutAccessCampaignRedeemStatus(campaign, now);

  if (campaign.redeemStatus === redeemStatus) {
    return null;
  }

  yield* Effect.promise(() => ctx.db.patch(campaign._id, { redeemStatus }));
  return null;
});

/** Expires one grant and mirrors entitlement rows. */
export const expireGrant = Effect.fn("tryoutAccess.expireGrant")(
  function* (args: { readonly grantId: Id<"tryoutAccessGrants"> }) {
    const ctx = yield* MutationCtx;
    const now = yield* Clock.currentTimeMillis;
    const grant = yield* Effect.promise(() => ctx.db.get(args.grantId));

    if (!grant) {
      return null;
    }

    yield* syncTryoutAccessGrantStatus(ctx.db, grant, now);
    return null;
  }
);

/** Sweeps overdue campaign, grant, entitlement, and competition states. */
export const sweepStates = Effect.fn("tryoutAccess.sweepStates")(function* () {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;
  const scheduledCampaigns = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_redeemStatus_and_startsAt", (query) =>
        query.eq("redeemStatus", "scheduled").lt("startsAt", now + 1)
      )
      .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE)
  );
  const activeCampaigns = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_redeemStatus_and_endsAt", (query) =>
        query.eq("redeemStatus", "active").lt("endsAt", now + 1)
      )
      .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE)
  );
  const overdueGrants = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAccessGrants")
      .withIndex("by_status_and_endsAt", (query) =>
        query.eq("status", "active").lt("endsAt", now + 1)
      )
      .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE)
  );
  const pendingCompetitions = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_campaignKind_and_resultsStatus_and_endsAt", (query) =>
        query
          .eq("campaignKind", "competition")
          .eq("resultsStatus", "pending")
          .lt("endsAt", now + 1)
      )
      .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE)
  );

  for (const campaign of [...scheduledCampaigns, ...activeCampaigns]) {
    const redeemStatus = getTryoutAccessCampaignRedeemStatus(campaign, now);

    if (campaign.redeemStatus === redeemStatus) {
      continue;
    }

    yield* Effect.promise(() => ctx.db.patch(campaign._id, { redeemStatus }));
  }

  for (const grant of overdueGrants) {
    yield* syncTryoutAccessGrantStatus(ctx.db, grant, now);
  }

  for (const competition of pendingCompetitions) {
    yield* finalizeCompetitionCampaignResultsIfNeeded(ctx.db, competition, now);
  }

  if (
    scheduledCampaigns.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
    activeCampaigns.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
    overdueGrants.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
    pendingCompetitions.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE
  ) {
    return null;
  }

  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      Ref.getFunctionReference(
        refs.internal.tryoutAccess.mutations.internalFunctions.status
          .sweepStates
      ),
      {}
    )
  );

  return null;
});
