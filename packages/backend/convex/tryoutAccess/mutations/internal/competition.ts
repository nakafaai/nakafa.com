import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { syncTryoutAttemptExpiry } from "@repo/backend/convex/tryouts/helpers/expiry";
import { v } from "convex/values";

const COMPETITION_FINALIZATION_BATCH_SIZE = 100;

/**
 * Finalize one competition campaign once its shared close time has passed.
 *
 * Competition attempts already use `expiresAt = min(tryoutWindow, campaignEnd)`.
 * This repair mutation only catches any rows whose scheduled expiry has not been
 * processed yet, then marks the campaign results as finalized.
 */
export const finalizeCompetitionCampaignResults = internalMutation({
  args: {
    campaignId: vv.id("tryoutAccessCampaigns"),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get("tryoutAccessCampaigns", args.campaignId);

    if (
      !campaign ||
      campaign.campaignKind !== "competition" ||
      campaign.resultsStatus === "finalized"
    ) {
      return null;
    }

    const now = Date.now();

    if (campaign.endsAt > now) {
      return null;
    }

    const page = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_accessCampaignId_and_startedAt", (q) =>
        q.eq("accessCampaignId", args.campaignId)
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: COMPETITION_FINALIZATION_BATCH_SIZE,
      });

    for (const tryoutAttempt of page.page) {
      if (tryoutAttempt.status !== "in-progress") {
        continue;
      }

      await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.tryoutAccess.mutations.internal.competition
          .finalizeCompetitionCampaignResults,
        {
          campaignId: args.campaignId,
          cursor: page.continueCursor,
        }
      );

      return null;
    }

    await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
      resultsFinalizedAt: now,
      resultsStatus: "finalized",
    });

    return null;
  },
});
