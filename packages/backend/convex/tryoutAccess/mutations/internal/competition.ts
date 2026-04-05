import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Finalizes one claimed competition campaign once its immutable close time has
 * passed.
 *
 * Competition attempts already store `accessEndsAt` from the campaign close and
 * schedule their own expiry at start, so this mutation only marks the campaign's
 * public results as finalized.
 */
export const finalizeCompetitionCampaignResults = internalMutation({
  args: {
    campaignId: vv.id("tryoutAccessCampaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get("tryoutAccessCampaigns", args.campaignId);

    if (
      !campaign ||
      campaign.campaignKind !== "competition" ||
      campaign.resultsStatus !== "finalizing"
    ) {
      return null;
    }

    const now = Date.now();

    if (campaign.endsAt > now) {
      return null;
    }

    await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
      resultsFinalizedAt: now,
      resultsStatus: "finalized",
    });

    return null;
  },
});
