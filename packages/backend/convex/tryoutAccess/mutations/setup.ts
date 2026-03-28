import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { normalizeTryoutAccessCode } from "@repo/backend/convex/tryoutAccess/helpers/access";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { ConvexError, v } from "convex/values";

const tryoutAccessCampaignInputValidator = v.object({
  slug: v.string(),
  name: v.string(),
  product: tryoutProductValidator,
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

    const campaignPatch = {
      enabled: args.campaign.enabled,
      endsAt: args.campaign.endsAt,
      grantDurationDays: args.campaign.grantDurationDays,
      name: args.campaign.name,
      product: args.campaign.product,
      slug: args.campaign.slug,
      startsAt: args.campaign.startsAt,
    };

    const campaignId = existingCampaign
      ? existingCampaign._id
      : await ctx.db.insert("tryoutAccessCampaigns", campaignPatch);

    if (existingCampaign) {
      await ctx.db.patch("tryoutAccessCampaigns", campaignId, campaignPatch);
    }

    const existingLink = await ctx.db
      .query("tryoutAccessLinks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    const linkPatch = {
      campaignId,
      code,
      enabled: args.link.enabled,
      label: args.link.label,
    };

    const linkId = existingLink
      ? existingLink._id
      : await ctx.db.insert("tryoutAccessLinks", linkPatch);

    if (existingLink) {
      await ctx.db.patch("tryoutAccessLinks", linkId, linkPatch);
    }

    return {
      campaignId,
      code,
      linkId,
    };
  },
});
