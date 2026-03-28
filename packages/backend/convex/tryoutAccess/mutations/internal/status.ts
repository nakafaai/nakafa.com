import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getTryoutAccessCampaignRedeemStatus,
  getTryoutAccessGrantStatus,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { v } from "convex/values";

const TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE = 100;

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

/** Marks one event grant as expired once its access window ends. */
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

    const status = getTryoutAccessGrantStatus(grant.endsAt, Date.now());

    if (grant.status === status) {
      return null;
    }

    await ctx.db.patch("tryoutAccessGrants", grant._id, {
      status,
    });

    return null;
  },
});

/** Repairs overdue campaign and grant statuses in bounded batches. */
export const sweepStates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const campaigns = await ctx.db.query("tryoutAccessCampaigns").collect();
    const grants = await ctx.db.query("tryoutAccessGrants").collect();
    let updatedCampaignCount = 0;

    for (const campaign of campaigns) {
      const redeemStatus = getTryoutAccessCampaignRedeemStatus(campaign, now);

      if (campaign.redeemStatus === redeemStatus) {
        continue;
      }

      await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
        redeemStatus,
      });
      updatedCampaignCount += 1;

      if (updatedCampaignCount >= TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE) {
        break;
      }
    }

    let updatedGrantCount = 0;

    for (const grant of grants) {
      const status = getTryoutAccessGrantStatus(grant.endsAt, now);

      if (grant.status === status) {
        continue;
      }

      await ctx.db.patch("tryoutAccessGrants", grant._id, {
        status,
      });
      updatedGrantCount += 1;

      if (updatedGrantCount >= TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE) {
        break;
      }
    }

    if (
      updatedCampaignCount < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
      updatedGrantCount < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE
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
