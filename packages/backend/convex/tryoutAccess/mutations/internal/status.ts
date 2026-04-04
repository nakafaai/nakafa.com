import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getTryoutAccessCampaignRedeemStatus,
  syncTryoutAccessGrantStatus,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { v } from "convex/values";

const TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE = 100;

/**
 * Claim one ended competition campaign for background result finalization.
 *
 * Moving the row to `finalizing` before enqueuing the worker prevents later
 * sweep batches from selecting and scheduling the same campaign again.
 */
async function enqueueCompetitionCampaignFinalizationIfNeeded(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  campaign: Doc<"tryoutAccessCampaigns"> | null,
  now: number
) {
  if (
    !campaign ||
    campaign.campaignKind !== "competition" ||
    campaign.resultsStatus !== "pending" ||
    campaign.endsAt > now
  ) {
    return;
  }

  await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
    resultsStatus: "finalizing",
  });
  await ctx.scheduler.runAfter(
    0,
    internal.tryoutAccess.mutations.internal.competition
      .finalizeCompetitionCampaignResults,
    {
      campaignId: campaign._id,
    }
  );
}

/** Synchronizes one campaign redeem status from its stored time window. */
export const syncCampaignRedeemStatus = internalMutation({
  args: {
    campaignId: vv.id("tryoutAccessCampaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get("tryoutAccessCampaigns", args.campaignId);

    if (!campaign) {
      return null;
    }

    const redeemStatus = getTryoutAccessCampaignRedeemStatus(
      campaign,
      Date.now()
    );

    if (campaign.redeemStatus === redeemStatus) {
      return null;
    }

    await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
      redeemStatus,
    });

    return null;
  },
});

/** Marks one event grant and its product grants as expired once access ends. */
export const expireGrant = internalMutation({
  args: {
    grantId: vv.id("tryoutAccessGrants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const grant = await ctx.db.get("tryoutAccessGrants", args.grantId);

    if (!grant) {
      return null;
    }

    await syncTryoutAccessGrantStatus(ctx.db, grant, Date.now());
    return null;
  },
});

/**
 * Claims one ended competition campaign and queues its result finalizer once.
 */
export const enqueueCompetitionCampaignFinalization = internalMutation({
  args: {
    campaignId: vv.id("tryoutAccessCampaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get("tryoutAccessCampaigns", args.campaignId);

    await enqueueCompetitionCampaignFinalizationIfNeeded(
      ctx,
      campaign,
      Date.now()
    );

    return null;
  },
});

/** Re-sync all stored grants for one campaign after ops changes its rules. */
export const syncCampaignGrantStatuses = internalMutation({
  args: {
    campaignId: vv.id("tryoutAccessCampaigns"),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tryoutAccessGrants")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE,
      });
    const now = Date.now();

    for (const grant of page.page) {
      await syncTryoutAccessGrantStatus(ctx.db, grant, now);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.tryoutAccess.mutations.internal.status
          .syncCampaignGrantStatuses,
        {
          campaignId: args.campaignId,
          cursor: page.continueCursor,
        }
      );
    }

    return null;
  },
});

/** Repairs overdue campaign and grant statuses in bounded batches. */
export const sweepStates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const scheduledCampaigns = await ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_redeemStatus_and_startsAt", (q) =>
        q.eq("redeemStatus", "scheduled").lt("startsAt", now + 1)
      )
      .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE);
    const activeCampaigns = await ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_redeemStatus_and_endsAt", (q) =>
        q.eq("redeemStatus", "active").lt("endsAt", now + 1)
      )
      .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE);
    const overdueGrants = await ctx.db
      .query("tryoutAccessGrants")
      .withIndex("by_status_and_endsAt", (q) =>
        q.eq("status", "active").lt("endsAt", now + 1)
      )
      .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE);
    const pendingCompetitions = await ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_campaignKind_and_resultsStatus_and_endsAt", (q) =>
        q
          .eq("campaignKind", "competition")
          .eq("resultsStatus", "pending")
          .lt("endsAt", now + 1)
      )
      .take(TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE);

    for (const campaign of scheduledCampaigns) {
      const redeemStatus = getTryoutAccessCampaignRedeemStatus(campaign, now);

      if (campaign.redeemStatus === redeemStatus) {
        continue;
      }

      await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
        redeemStatus,
      });
    }

    for (const campaign of activeCampaigns) {
      const redeemStatus = getTryoutAccessCampaignRedeemStatus(campaign, now);

      if (campaign.redeemStatus === redeemStatus) {
        continue;
      }

      await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
        redeemStatus,
      });
    }

    for (const grant of overdueGrants) {
      await syncTryoutAccessGrantStatus(ctx.db, grant, now);
    }

    for (const competition of pendingCompetitions) {
      await enqueueCompetitionCampaignFinalizationIfNeeded(
        ctx,
        competition,
        now
      );
    }

    if (
      scheduledCampaigns.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
      activeCampaigns.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
      overdueGrants.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
      pendingCompetitions.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE
    ) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.tryoutAccess.mutations.internal.status.sweepStates,
      {}
    );
    return null;
  },
});
