import { internalQuery } from "@repo/backend/convex/_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const tryoutAccessCampaignIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  overdueActiveCampaignCount: v.number(),
  overduePendingCompetitionCount: v.number(),
  overdueScheduledCampaignCount: v.number(),
});

const tryoutAccessGrantIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  overdueActiveGrantCount: v.number(),
});

const tryoutAccessEntitlementIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  overdueEntitlementCount: v.number(),
});

/**
 * Returns integrity totals for one bounded page of access campaigns.
 *
 * Operator scripts aggregate these page summaries client-side so verification
 * stays bounded as the campaign table grows.
 */
export const getTryoutAccessCampaignIntegrity = internalQuery({
  args: {
    nowMs: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: tryoutAccessCampaignIntegrityPageResultValidator,
  handler: async (ctx, args) => {
    const campaigns = await ctx.db
      .query("tryoutAccessCampaigns")
      .paginate(args.paginationOpts);
    let overdueActiveCampaignCount = 0;
    let overduePendingCompetitionCount = 0;
    let overdueScheduledCampaignCount = 0;

    for (const campaign of campaigns.page) {
      if (
        campaign.redeemStatus === "scheduled" &&
        campaign.startsAt <= args.nowMs
      ) {
        overdueScheduledCampaignCount += 1;
      }

      if (campaign.redeemStatus === "active" && campaign.endsAt <= args.nowMs) {
        overdueActiveCampaignCount += 1;
      }

      if (
        campaign.campaignKind === "competition" &&
        campaign.endsAt <= args.nowMs &&
        campaign.resultsStatus === "pending"
      ) {
        overduePendingCompetitionCount += 1;
      }
    }

    return {
      continueCursor: campaigns.continueCursor,
      isDone: campaigns.isDone,
      overdueActiveCampaignCount,
      overduePendingCompetitionCount,
      overdueScheduledCampaignCount,
    };
  },
});

/**
 * Returns integrity totals for one bounded page of access grants.
 *
 * Operator scripts aggregate these page summaries client-side so verification
 * stays bounded as the grant table grows.
 */
export const getTryoutAccessGrantIntegrity = internalQuery({
  args: {
    nowMs: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: tryoutAccessGrantIntegrityPageResultValidator,
  handler: async (ctx, args) => {
    const grants = await ctx.db
      .query("tryoutAccessGrants")
      .paginate(args.paginationOpts);
    let overdueActiveGrantCount = 0;

    for (const grant of grants.page) {
      if (grant.status === "active" && grant.endsAt <= args.nowMs) {
        overdueActiveGrantCount += 1;
      }
    }

    return {
      continueCursor: grants.continueCursor,
      isDone: grants.isDone,
      overdueActiveGrantCount,
    };
  },
});

/**
 * Returns integrity totals for one bounded page of access entitlements.
 *
 * Projection rows should only exist while access is active, so overdue rows are
 * direct evidence that time-based state drifted away from the materialized
 * access model.
 */
export const getTryoutAccessEntitlementIntegrity = internalQuery({
  args: {
    nowMs: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: tryoutAccessEntitlementIntegrityPageResultValidator,
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("userTryoutEntitlements")
      .paginate(args.paginationOpts);
    let overdueEntitlementCount = 0;

    for (const entitlement of entitlements.page) {
      if (entitlement.endsAt <= args.nowMs) {
        overdueEntitlementCount += 1;
      }
    }

    return {
      continueCursor: entitlements.continueCursor,
      isDone: entitlements.isDone,
      overdueEntitlementCount,
    };
  },
});
