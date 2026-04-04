import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { syncTryoutAttemptExpiry } from "@repo/backend/convex/tryouts/helpers/expiry";
import { upsertUserTryoutLatestAttempt } from "@repo/backend/convex/tryouts/helpers/latest";
import { tryoutProductPolicies } from "@repo/backend/convex/tryouts/products";
import { ConvexError, v } from "convex/values";

const COMPETITION_ATTEMPT_BATCH_SIZE = 100;

/**
 * Re-sync active competition attempts after ops changes a campaign end time.
 *
 * Competition attempts always inherit the current campaign close timestamp, so
 * extending or shortening the campaign must update both `accessEndsAt` and the
 * derived tryout `expiresAt` window.
 */
export const syncCompetitionAttemptWindows = internalMutation({
  args: {
    campaignId: vv.id("tryoutAccessCampaigns"),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get("tryoutAccessCampaigns", args.campaignId);

    if (!campaign || campaign.campaignKind !== "competition") {
      return null;
    }

    const now = Date.now();
    const page = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_accessCampaignId_and_startedAt", (q) =>
        q.eq("accessCampaignId", args.campaignId)
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: COMPETITION_ATTEMPT_BATCH_SIZE,
      });

    for (const tryoutAttempt of page.page) {
      if (tryoutAttempt.status !== "in-progress") {
        continue;
      }

      const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

      if (!tryout) {
        throw new ConvexError({
          code: "TRYOUT_NOT_FOUND",
          message: "Tryout not found.",
        });
      }

      const attemptWindowEndsAt =
        tryoutAttempt.startedAt +
        tryoutProductPolicies[tryout.product].attemptWindowMs;
      const expiresAt = Math.min(attemptWindowEndsAt, campaign.endsAt);

      if (
        tryoutAttempt.accessEndsAt === campaign.endsAt &&
        tryoutAttempt.expiresAt === expiresAt
      ) {
        continue;
      }

      await ctx.db.patch("tryoutAttempts", tryoutAttempt._id, {
        accessEndsAt: campaign.endsAt,
        expiresAt,
      });
      await upsertUserTryoutLatestAttempt(ctx, {
        attempt: {
          _id: tryoutAttempt._id,
          expiresAt,
          status: tryoutAttempt.status,
          tryoutId: tryoutAttempt.tryoutId,
          userId: tryoutAttempt.userId,
        },
        tryout,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        Math.max(0, expiresAt - now),
        internal.tryouts.mutations.internal.expiry.expireTryoutAttemptInternal,
        {
          tryoutAttemptId: tryoutAttempt._id,
          expiresAtMs: expiresAt,
        }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.tryoutAccess.mutations.internal.competition
          .syncCompetitionAttemptWindows,
        {
          campaignId: args.campaignId,
          cursor: page.continueCursor,
        }
      );
    }

    return null;
  },
});

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
    const isContinuation = args.cursor !== undefined;

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

    if (!isContinuation && campaign.resultsStatus === "pending") {
      await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
        resultsStatus: "finalizing",
      });
    }

    if (isContinuation && campaign.resultsStatus !== "finalizing") {
      return null;
    }

    const page = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_accessCampaignId_and_startedAt", (q) =>
        q.eq("accessCampaignId", args.campaignId)
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: COMPETITION_ATTEMPT_BATCH_SIZE,
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
