import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getTryoutAccessCampaignRedeemStatus,
  normalizeTryoutAccessCode,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { tryoutAccessCampaignKindValidator } from "@repo/backend/convex/tryoutAccess/schema";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { ConvexError, v } from "convex/values";

const tryoutAccessCampaignInputValidator = v.object({
  slug: v.string(),
  name: v.string(),
  products: v.array(tryoutProductValidator),
  campaignKind: tryoutAccessCampaignKindValidator,
  enabled: v.boolean(),
  startsAt: v.number(),
  endsAt: v.number(),
  grantDurationDays: v.optional(v.number()),
});

const tryoutAccessLinkInputValidator = v.object({
  code: v.string(),
  label: v.string(),
  enabled: v.boolean(),
});

/** Upserts one event access campaign and one redeem link for ops setup. */
export const upsertCampaignAndLink = internalMutation({
  args: {
    campaign: tryoutAccessCampaignInputValidator,
    link: tryoutAccessLinkInputValidator,
  },
  returns: v.object({
    campaignId: vv.id("tryoutAccessCampaigns"),
    code: v.string(),
    linkId: vv.id("tryoutAccessLinks"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.campaign.endsAt <= args.campaign.startsAt) {
      throw new ConvexError({
        code: "INVALID_CAMPAIGN_WINDOW",
        message: "Event access campaign end must be after its start.",
      });
    }

    if (
      args.campaign.campaignKind === "competition" &&
      args.campaign.grantDurationDays !== undefined
    ) {
      throw new ConvexError({
        code: "INVALID_GRANT_DURATION",
        message: "Competition campaigns cannot define grantDurationDays.",
      });
    }

    if (
      args.campaign.campaignKind === "access-pass" &&
      (!args.campaign.grantDurationDays || args.campaign.grantDurationDays <= 0)
    ) {
      throw new ConvexError({
        code: "INVALID_GRANT_DURATION",
        message: "Access-pass campaigns must define a positive grant duration.",
      });
    }

    if (args.campaign.products.length === 0) {
      throw new ConvexError({
        code: "INVALID_EVENT_PRODUCTS",
        message:
          "Event access campaign must include at least one tryout product.",
      });
    }

    const uniqueProducts = Array.from(new Set(args.campaign.products));

    if (uniqueProducts.length !== args.campaign.products.length) {
      throw new ConvexError({
        code: "DUPLICATE_EVENT_PRODUCTS",
        message: "Event access campaign products must be unique.",
      });
    }

    const code = normalizeTryoutAccessCode(args.link.code);

    if (code.length === 0) {
      throw new ConvexError({
        code: "INVALID_EVENT_CODE",
        message: "Event access code cannot be empty.",
      });
    }

    const existingCampaign = await ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_slug", (q) => q.eq("slug", args.campaign.slug))
      .unique();
    const existingLink = await ctx.db
      .query("tryoutAccessLinks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    const nextCampaign = {
      campaignKind: args.campaign.campaignKind,
      enabled: args.campaign.enabled,
      endsAt: args.campaign.endsAt,
      grantDurationDays: args.campaign.grantDurationDays,
      name: args.campaign.name,
      products: uniqueProducts,
      resultsFinalizedAt:
        existingCampaign &&
        existingCampaign.campaignKind === args.campaign.campaignKind &&
        existingCampaign.endsAt === args.campaign.endsAt
          ? existingCampaign.resultsFinalizedAt
          : null,
      resultsStatus:
        existingCampaign &&
        existingCampaign.campaignKind === args.campaign.campaignKind &&
        existingCampaign.endsAt === args.campaign.endsAt
          ? existingCampaign.resultsStatus
          : "pending",
      redeemStatus: getTryoutAccessCampaignRedeemStatus(args.campaign, now),
      slug: args.campaign.slug,
      startsAt: args.campaign.startsAt,
    };

    if (!(existingCampaign || existingLink)) {
      const campaignId = await ctx.db.insert(
        "tryoutAccessCampaigns",
        nextCampaign
      );
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code,
        enabled: args.link.enabled,
        label: args.link.label,
      });

      if (args.campaign.startsAt > now) {
        await ctx.scheduler.runAfter(
          args.campaign.startsAt - now,
          internal.tryoutAccess.mutations.internal.status
            .syncCampaignRedeemStatus,
          {
            campaignId,
          }
        );
      }

      if (args.campaign.endsAt > now) {
        await ctx.scheduler.runAfter(
          args.campaign.endsAt - now,
          internal.tryoutAccess.mutations.internal.status
            .syncCampaignRedeemStatus,
          {
            campaignId,
          }
        );
      }

      await ctx.scheduler.runAfter(
        0,
        internal.tryoutAccess.mutations.internal.status
          .syncCampaignGrantStatuses,
        {
          campaignId,
        }
      );

      if (args.campaign.campaignKind === "competition") {
        await ctx.scheduler.runAfter(
          0,
          internal.tryoutAccess.mutations.internal.competition
            .syncCompetitionAttemptWindows,
          {
            campaignId,
          }
        );
        await ctx.scheduler.runAfter(
          Math.max(0, args.campaign.endsAt - now),
          internal.tryoutAccess.mutations.internal.competition
            .finalizeCompetitionCampaignResults,
          {
            campaignId,
          }
        );
      }

      return {
        campaignId,
        code,
        linkId,
      };
    }

    if (!(existingCampaign && existingLink)) {
      throw new ConvexError({
        code: "EVENT_SETUP_CONFLICT",
        message: "Event access slug and code must reference the same record.",
      });
    }

    if (existingLink.campaignId !== existingCampaign._id) {
      throw new ConvexError({
        code: "EVENT_SETUP_CONFLICT",
        message: "Event access slug and code point to different campaigns.",
      });
    }

    if (existingCampaign.campaignKind !== args.campaign.campaignKind) {
      throw new ConvexError({
        code: "CAMPAIGN_KIND_IMMUTABLE",
        message:
          "Campaign kind cannot change after the campaign has been created.",
      });
    }

    const campaignId = existingCampaign._id;

    await ctx.db.patch("tryoutAccessCampaigns", campaignId, nextCampaign);
    await ctx.db.patch("tryoutAccessLinks", existingLink._id, {
      campaignId,
      code,
      enabled: args.link.enabled,
      label: args.link.label,
    });

    if (args.campaign.startsAt > now) {
      await ctx.scheduler.runAfter(
        args.campaign.startsAt - now,
        internal.tryoutAccess.mutations.internal.status
          .syncCampaignRedeemStatus,
        {
          campaignId,
        }
      );
    }

    if (args.campaign.endsAt > now) {
      await ctx.scheduler.runAfter(
        args.campaign.endsAt - now,
        internal.tryoutAccess.mutations.internal.status
          .syncCampaignRedeemStatus,
        {
          campaignId,
        }
      );
    }

    await ctx.scheduler.runAfter(
      0,
      internal.tryoutAccess.mutations.internal.status.syncCampaignGrantStatuses,
      {
        campaignId,
      }
    );

    if (args.campaign.campaignKind === "competition") {
      await ctx.scheduler.runAfter(
        0,
        internal.tryoutAccess.mutations.internal.competition
          .syncCompetitionAttemptWindows,
        {
          campaignId,
        }
      );
      await ctx.scheduler.runAfter(
        Math.max(0, args.campaign.endsAt - now),
        internal.tryoutAccess.mutations.internal.competition
          .finalizeCompetitionCampaignResults,
        {
          campaignId,
        }
      );
    }

    return {
      campaignId,
      code,
      linkId: existingLink._id,
    };
  },
});
