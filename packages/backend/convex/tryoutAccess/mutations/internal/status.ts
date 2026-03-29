import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getTryoutAccessCampaignRedeemStatus,
  getTryoutAccessGrantStatus,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { tryoutProducts } from "@repo/backend/convex/tryouts/products";
import { v } from "convex/values";

const TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE = 100;
const MAX_PRODUCT_GRANTS_PER_GRANT = tryoutProducts.length;

async function syncGrantStatus(
  ctx: MutationCtx,
  grant: Pick<Doc<"tryoutAccessGrants">, "_id" | "endsAt" | "status">,
  now: number
) {
  const status = getTryoutAccessGrantStatus(grant.endsAt, now);
  const productGrants = await ctx.db
    .query("tryoutAccessProductGrants")
    .withIndex("by_grantId", (q) => q.eq("grantId", grant._id))
    .take(MAX_PRODUCT_GRANTS_PER_GRANT);

  if (grant.status !== status) {
    await ctx.db.patch("tryoutAccessGrants", grant._id, {
      status,
    });
  }

  for (const productGrant of productGrants) {
    if (productGrant.status === status) {
      continue;
    }

    await ctx.db.patch("tryoutAccessProductGrants", productGrant._id, {
      status,
    });
  }
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

    await syncGrantStatus(ctx, grant, Date.now());
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
      await syncGrantStatus(ctx, grant, now);
    }

    if (
      scheduledCampaigns.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
      activeCampaigns.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE &&
      overdueGrants.length < TRYOUT_ACCESS_STATUS_SWEEP_BATCH_SIZE
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
