import { query } from "@repo/backend/convex/_generated/server";
import {
  getOptionalAppUser,
  requireAuth,
} from "@repo/backend/convex/lib/helpers/auth";
import {
  getTryoutAccessEventByCode,
  getTryoutAccessUnavailableReason,
  hasTryoutAccess,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const tryoutAccessUnavailableReasonValidator = literals(
  "invalid-code",
  "disabled",
  "not-started",
  "ended"
);

const eventPageStateValidator = v.union(
  v.object({
    kind: v.literal("unavailable"),
    name: v.union(v.string(), v.null()),
    product: v.union(tryoutProductValidator, v.null()),
    reason: tryoutAccessUnavailableReasonValidator,
  }),
  v.object({
    kind: v.literal("sign-in"),
    grantDurationDays: v.number(),
    name: v.string(),
    product: tryoutProductValidator,
  }),
  v.object({
    kind: v.literal("ready"),
    grantDurationDays: v.number(),
    name: v.string(),
    product: tryoutProductValidator,
  }),
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

/** Returns the current user-facing state for one event access link page. */
export const getEventPageState = query({
  args: {
    code: v.string(),
  },
  returns: eventPageStateValidator,
  handler: async (ctx, args) => {
    const eventAccess = await getTryoutAccessEventByCode(ctx.db, args.code);

    if (!eventAccess) {
      return {
        kind: "unavailable" as const,
        name: null,
        product: null,
        reason: "invalid-code" as const,
      };
    }

    const user = await getOptionalAppUser(ctx);

    if (user) {
      const existingGrant = await ctx.db
        .query("tryoutAccessGrants")
        .withIndex("by_userId_and_campaignId", (q) =>
          q
            .eq("userId", user.appUser._id)
            .eq("campaignId", eventAccess.campaign._id)
        )
        .unique();

      if (existingGrant) {
        if (existingGrant.status === "active") {
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
    }

    const unavailableReason = getTryoutAccessUnavailableReason(eventAccess);

    if (unavailableReason) {
      return {
        kind: "unavailable" as const,
        name: eventAccess.campaign.name,
        product: eventAccess.campaign.product,
        reason: unavailableReason,
      };
    }

    if (!user) {
      return {
        kind: "sign-in" as const,
        grantDurationDays: eventAccess.campaign.grantDurationDays,
        name: eventAccess.campaign.name,
        product: eventAccess.campaign.product,
      };
    }

    return {
      kind: "ready" as const,
      grantDurationDays: eventAccess.campaign.grantDurationDays,
      name: eventAccess.campaign.name,
      product: eventAccess.campaign.product,
    };
  },
});

/** Returns whether the authenticated user can start one tryout product right now. */
export const getTryoutAccessState = query({
  args: {
    product: tryoutProductValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);

    return hasTryoutAccess(ctx.db, {
      product: args.product,
      userId: appUser._id,
    });
  },
});
