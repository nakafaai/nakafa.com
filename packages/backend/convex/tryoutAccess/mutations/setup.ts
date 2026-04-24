import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { normalizeTryoutAccessCode } from "@repo/backend/convex/tryoutAccess/helpers/codes";
import {
  buildTryoutAccessCampaignDocument,
  buildTryoutAccessLinkDocument,
  hasCampaignTransitionChange,
  hasStoredCampaignChange,
  hasStoredLinkChange,
} from "@repo/backend/convex/tryoutAccess/helpers/setup/documents";
import {
  assertCampaignCanBeUpdated,
  assertNoOverlappingCompetitionCampaign,
  assertValidCampaignInput,
} from "@repo/backend/convex/tryoutAccess/helpers/setup/policy";
import {
  getUniqueCampaignProducts,
  syncTryoutAccessCampaignProducts,
} from "@repo/backend/convex/tryoutAccess/helpers/setup/products";
import { scheduleCampaignStateTransitions } from "@repo/backend/convex/tryoutAccess/helpers/setup/schedule";
import {
  assertValidTryoutAccessCode,
  tryoutAccessCampaignInputValidator,
  tryoutAccessLinkInputValidator,
} from "@repo/backend/convex/tryoutAccess/helpers/setup/validators";
import { ConvexError, v } from "convex/values";

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
    const uniqueTargetProducts = getUniqueCampaignProducts(
      args.campaign.targetProducts
    );

    assertValidCampaignInput(args.campaign, uniqueTargetProducts);

    const code = normalizeTryoutAccessCode(args.link.code);
    assertValidTryoutAccessCode(code);

    const existingCampaign = await ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_slug", (q) => q.eq("slug", args.campaign.slug))
      .unique();
    const existingLink = await ctx.db
      .query("tryoutAccessLinks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    const existingProducts = existingCampaign
      ? await ctx.db
          .query("tryoutAccessCampaignProducts")
          .withIndex("by_campaignId", (q) =>
            q.eq("campaignId", existingCampaign._id)
          )
          .collect()
      : [];
    const nextCampaign = buildTryoutAccessCampaignDocument({
      campaign: args.campaign,
      existingCampaign,
      now,
    });

    if (args.campaign.campaignKind === "competition") {
      await assertNoOverlappingCompetitionCampaign(ctx, {
        endsAt: args.campaign.endsAt,
        existingCampaignId: existingCampaign?._id,
        targetProducts: uniqueTargetProducts,
        startsAt: args.campaign.startsAt,
      });
    }

    if (existingCampaign || existingLink) {
      if (!(existingCampaign && existingLink)) {
        throw new ConvexError({
          code: "EVENT_SETUP_CONFLICT",
          message: "Event access slug and code must reference the same record.",
        });
      }

      assertCampaignCanBeUpdated({
        campaignKind: args.campaign.campaignKind,
        existingCampaign,
        existingProducts: existingProducts.map((row) => row.product),
        existingLink,
        nextCampaign,
        nextTargetProducts: uniqueTargetProducts,
      });

      const nextLink = buildTryoutAccessLinkDocument({
        code,
        existingCampaign,
        link: args.link,
      });
      const shouldScheduleTransitions = hasCampaignTransitionChange({
        existingCampaign,
        nextCampaign: args.campaign,
      });

      if (hasStoredCampaignChange(existingCampaign, nextCampaign)) {
        await ctx.db.replace(
          "tryoutAccessCampaigns",
          existingCampaign._id,
          nextCampaign
        );
      }

      if (hasStoredLinkChange({ code, existingLink, nextLink })) {
        await ctx.db.patch("tryoutAccessLinks", existingLink._id, nextLink);
      }

      await syncTryoutAccessCampaignProducts(ctx, {
        campaignId: existingCampaign._id,
        campaignKind: args.campaign.campaignKind,
        endsAt: args.campaign.endsAt,
        targetProducts: uniqueTargetProducts,
        startsAt: args.campaign.startsAt,
      });

      if (shouldScheduleTransitions) {
        await scheduleCampaignStateTransitions(ctx, {
          campaign: args.campaign,
          campaignId: existingCampaign._id,
          now,
        });
      }

      return {
        campaignId: existingCampaign._id,
        code,
        linkId: existingLink._id,
      };
    }

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

    await syncTryoutAccessCampaignProducts(ctx, {
      campaignId,
      campaignKind: args.campaign.campaignKind,
      endsAt: args.campaign.endsAt,
      targetProducts: uniqueTargetProducts,
      startsAt: args.campaign.startsAt,
    });

    await scheduleCampaignStateTransitions(ctx, {
      campaign: args.campaign,
      campaignId,
      now,
    });

    return {
      campaignId,
      code,
      linkId,
    };
  },
});
