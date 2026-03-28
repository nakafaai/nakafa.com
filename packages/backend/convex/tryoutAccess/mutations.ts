import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  getTryoutAccessEventByCode,
  getTryoutAccessGrantEndsAt,
  getTryoutAccessUnavailableReason,
  isTryoutAccessGrantActive,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { ConvexError, v } from "convex/values";

const redeemEventAccessResultValidator = v.union(
  v.object({
    kind: v.literal("active"),
    endsAt: v.number(),
    name: v.string(),
    product: tryoutProductValidator,
  }),
  v.object({
    kind: v.literal("used"),
    endsAt: v.number(),
    name: v.string(),
    product: tryoutProductValidator,
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
          product: eventAccess.campaign.product,
        };
      }

      return {
        kind: "used" as const,
        endsAt: existingGrant.endsAt,
        name: eventAccess.campaign.name,
        product: eventAccess.campaign.product,
      };
    }

    const unavailableReason = getTryoutAccessUnavailableReason(
      eventAccess,
      now
    );

    if (unavailableReason === "disabled") {
      throw new ConvexError({
        code: "EVENT_DISABLED",
        message: "Event access is currently disabled.",
      });
    }

    if (unavailableReason === "not-started") {
      throw new ConvexError({
        code: "EVENT_NOT_STARTED",
        message: "Event access is not available yet.",
      });
    }

    if (unavailableReason === "ended") {
      throw new ConvexError({
        code: "EVENT_ENDED",
        message: "Event access has ended.",
      });
    }

    const endsAt = getTryoutAccessGrantEndsAt(
      now,
      eventAccess.campaign.grantDurationDays
    );

    await ctx.db.insert("tryoutAccessGrants", {
      campaignId: eventAccess.campaign._id,
      linkId: eventAccess.link._id,
      userId: appUser._id,
      product: eventAccess.campaign.product,
      redeemedAt: now,
      endsAt,
    });

    return {
      kind: "active" as const,
      endsAt,
      name: eventAccess.campaign.name,
      product: eventAccess.campaign.product,
    };
  },
});
