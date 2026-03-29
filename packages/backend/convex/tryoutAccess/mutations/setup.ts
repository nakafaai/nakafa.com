import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getTryoutAccessCampaignRedeemStatus,
  normalizeTryoutAccessCode,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { ConvexError, v } from "convex/values";

const tryoutAccessCampaignInputValidator = v.object({
  slug: v.string(),
  name: v.string(),
  products: v.array(tryoutProductValidator),
  enabled: v.boolean(),
  startsAt: v.number(),
  endsAt: v.number(),
  grantDurationDays: v.number(),
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

    if (args.campaign.grantDurationDays <= 0) {
      throw new ConvexError({
        code: "INVALID_GRANT_DURATION",
        message: "Event access grant duration must be greater than zero.",
      });
    }

    if (args.campaign.products.length === 0) {
      throw new ConvexError({
        code: "INVALID_EVENT_PRODUCTS",
        message:
          "Event access campaign must include at least one tryout product.",
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
      enabled: args.campaign.enabled,
      endsAt: args.campaign.endsAt,
      grantDurationDays: args.campaign.grantDurationDays,
      name: args.campaign.name,
      products: args.campaign.products,
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

    return {
      campaignId,
      code,
      linkId: existingLink._id,
    };
  },
});
