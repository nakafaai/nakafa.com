import { internal } from "@repo/backend/convex/_generated/api";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  getTryoutAccessCampaignRedeemStatus,
  getTryoutAccessEventByCode,
  getTryoutAccessGrantEndsAt,
  syncTryoutAccessGrantEntitlements,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { logger } from "@repo/backend/convex/utils/logger";
import { ConvexError, v } from "convex/values";

const redeemEventAccessResultValidator = v.union(
  v.object({
    kind: v.literal("active"),
    endsAt: v.number(),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("already-active"),
    endsAt: v.number(),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("used"),
    endsAt: v.number(),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("disabled"),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("not-started"),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("ended"),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("not-found"),
  })
);

/** Redeems one event access code for the authenticated user. */
export const redeemEventAccess = mutation({
  args: {
    code: v.string(),
  },
  returns: redeemEventAccessResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const now = Date.now();
    const eventAccess = await getTryoutAccessEventByCode(ctx.db, args.code);

    if (!eventAccess) {
      logger.warn("Event access redeem denied because the code was not found", {
        code: args.code,
        userId: appUser._id,
      });

      return { kind: "not-found" as const };
    }

    if (eventAccess.products.length === 0) {
      throw new ConvexError({
        code: "EVENT_PRODUCTS_REQUIRED",
        message: "Event access campaign products cannot be empty.",
      });
    }

    const existingGrant = await ctx.db
      .query("tryoutAccessGrants")
      .withIndex("by_userId_and_campaignId", (q) =>
        q.eq("userId", appUser._id).eq("campaignId", eventAccess.campaign._id)
      )
      .unique();

    if (existingGrant) {
      if (existingGrant.status === "active") {
        logger.info("Event access already active for the current user", {
          campaignId: eventAccess.campaign._id,
          code: args.code,
          grantId: existingGrant._id,
          userId: appUser._id,
        });

        return {
          kind: "already-active" as const,
          endsAt: existingGrant.endsAt,
          name: eventAccess.campaign.name,
        };
      }

      logger.warn(
        "Event access redeem denied because the code was already used",
        {
          campaignId: eventAccess.campaign._id,
          code: args.code,
          grantId: existingGrant._id,
          userId: appUser._id,
        }
      );

      return {
        kind: "used" as const,
        endsAt: existingGrant.endsAt,
        name: eventAccess.campaign.name,
      };
    }

    if (!(eventAccess.link.enabled && eventAccess.campaign.enabled)) {
      logger.warn(
        "Event access redeem denied because the campaign is disabled",
        {
          campaignId: eventAccess.campaign._id,
          code: args.code,
          userId: appUser._id,
        }
      );

      return {
        kind: "disabled" as const,
        name: eventAccess.campaign.name,
      };
    }

    const campaignRedeemStatus = getTryoutAccessCampaignRedeemStatus(
      eventAccess.campaign,
      now
    );

    if (campaignRedeemStatus === "scheduled") {
      logger.warn(
        "Event access redeem denied because the campaign has not started yet",
        {
          campaignId: eventAccess.campaign._id,
          code: args.code,
          userId: appUser._id,
        }
      );

      return {
        kind: "not-started" as const,
        name: eventAccess.campaign.name,
      };
    }

    if (campaignRedeemStatus === "ended") {
      logger.warn("Event access redeem denied because the campaign has ended", {
        campaignId: eventAccess.campaign._id,
        code: args.code,
        userId: appUser._id,
      });

      return {
        kind: "ended" as const,
        name: eventAccess.campaign.name,
      };
    }

    const endsAt = getTryoutAccessGrantEndsAt({
      campaign: eventAccess.campaign,
      redeemedAt: now,
    });
    const grantStatus = "active" as const;

    const grantId = await ctx.db.insert("tryoutAccessGrants", {
      campaignId: eventAccess.campaign._id,
      linkId: eventAccess.link._id,
      userId: appUser._id,
      redeemedAt: now,
      endsAt,
      status: grantStatus,
    });

    if (eventAccess.campaign.firstRedeemedAt == null) {
      await ctx.db.patch("tryoutAccessCampaigns", eventAccess.campaign._id, {
        firstRedeemedAt: now,
      });
    }

    await syncTryoutAccessGrantEntitlements(
      ctx.db,
      {
        _id: grantId,
        campaignId: eventAccess.campaign._id,
        endsAt,
        redeemedAt: now,
        status: grantStatus,
        userId: appUser._id,
      },
      eventAccess.campaign
    );

    await ctx.scheduler.runAfter(
      Math.max(0, endsAt - now),
      internal.tryoutAccess.mutations.internal.status.expireGrant,
      {
        grantId,
      }
    );

    logger.info("Event access redeemed", {
      campaignId: eventAccess.campaign._id,
      code: args.code,
      grantId,
      userId: appUser._id,
    });

    return {
      kind: "active" as const,
      endsAt,
      name: eventAccess.campaign.name,
    };
  },
});
