import { internal } from "@repo/backend/convex/_generated/api";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  getTryoutAccessCampaignRedeemStatus,
  getTryoutAccessEventByCode,
  getTryoutAccessGrantEndsAt,
  getTryoutAccessGrantStatus,
  isTryoutAccessGrantActive,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { ConvexError, v } from "convex/values";

const redeemEventAccessResultValidator = v.union(
  v.object({
    kind: v.literal("active"),
    endsAt: v.number(),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("used"),
    endsAt: v.number(),
    name: v.string(),
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
      throw new ConvexError({
        code: "EVENT_NOT_FOUND",
        message: "Event access link not found.",
      });
    }

    if (eventAccess.campaign.products.length === 0) {
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
      if (isTryoutAccessGrantActive(existingGrant, now)) {
        return {
          kind: "active" as const,
          endsAt: existingGrant.endsAt,
          name: eventAccess.campaign.name,
        };
      }

      return {
        kind: "used" as const,
        endsAt: existingGrant.endsAt,
        name: eventAccess.campaign.name,
      };
    }

    if (!(eventAccess.link.enabled && eventAccess.campaign.enabled)) {
      throw new ConvexError({
        code: "EVENT_DISABLED",
        message: "Event access is currently disabled.",
      });
    }

    const campaignRedeemStatus = getTryoutAccessCampaignRedeemStatus(
      eventAccess.campaign,
      now
    );

    if (campaignRedeemStatus === "scheduled") {
      throw new ConvexError({
        code: "EVENT_NOT_STARTED",
        message: "Event access is not available yet.",
      });
    }

    if (campaignRedeemStatus === "ended") {
      throw new ConvexError({
        code: "EVENT_ENDED",
        message: "Event access has ended.",
      });
    }

    const endsAt = getTryoutAccessGrantEndsAt(
      now,
      eventAccess.campaign.grantDurationDays
    );

    if (eventAccess.campaign.redeemStatus !== campaignRedeemStatus) {
      await ctx.db.patch("tryoutAccessCampaigns", eventAccess.campaign._id, {
        redeemStatus: campaignRedeemStatus,
      });
    }

    const grantId = await ctx.db.insert("tryoutAccessGrants", {
      campaignId: eventAccess.campaign._id,
      linkId: eventAccess.link._id,
      userId: appUser._id,
      products: eventAccess.campaign.products,
      redeemedAt: now,
      endsAt,
      status: getTryoutAccessGrantStatus(endsAt, now),
    });

    await ctx.scheduler.runAfter(
      endsAt - now,
      internal.tryoutAccess.mutations.internal.status.expireGrant,
      {
        grantId,
      }
    );

    return {
      kind: "active" as const,
      endsAt,
      name: eventAccess.campaign.name,
    };
  },
});
