import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/** Finalizes one ended competition campaign if it is still pending. */
export async function finalizeCompetitionCampaignResultsIfNeeded(
  db: Pick<MutationCtx, "db">["db"],
  campaign: Doc<"tryoutAccessCampaigns"> | null,
  now: number
) {
  if (
    !campaign ||
    campaign.campaignKind !== "competition" ||
    campaign.resultsStatus !== "pending"
  ) {
    return;
  }

  if (campaign.endsAt > now) {
    return;
  }

  await db.patch("tryoutAccessCampaigns", campaign._id, {
    resultsFinalizedAt: now,
    resultsStatus: "finalized",
  });
}

/**
 * Finalizes one ended competition campaign once its immutable close time has
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

    await finalizeCompetitionCampaignResultsIfNeeded(
      ctx.db,
      campaign,
      Date.now()
    );

    return null;
  },
});
