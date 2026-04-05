import { internalQuery } from "@repo/backend/convex/_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const tryoutAccessCampaignIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  overdueActiveCampaignCount: v.number(),
  overduePendingCompetitionCount: v.number(),
  overdueScheduledCampaignCount: v.number(),
  stuckFinalizingCompetitionCount: v.number(),
});

const tryoutAccessGrantIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  overdueActiveGrantCount: v.number(),
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
    let stuckFinalizingCompetitionCount = 0;

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
        campaign.endsAt <= args.nowMs
      ) {
        if (campaign.resultsStatus === "pending") {
          overduePendingCompetitionCount += 1;
        }

        if (campaign.resultsStatus === "finalizing") {
          stuckFinalizingCompetitionCount += 1;
        }
      }
    }

    return {
      continueCursor: campaigns.continueCursor,
      isDone: campaigns.isDone,
      overdueActiveCampaignCount,
      overduePendingCompetitionCount,
      overdueScheduledCampaignCount,
      stuckFinalizingCompetitionCount,
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
