import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import {
  getTryoutAccessEventByCode,
  getTryoutAccessGrantEffectiveEndsAt,
  getTryoutAccessUnavailableReason,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
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
    reason: tryoutAccessUnavailableReasonValidator,
  }),
  v.object({
    kind: v.literal("sign-in"),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("ready"),
    name: v.string(),
  }),
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
        const activeEntitlement = await ctx.db
          .query("userTryoutEntitlements")
          .withIndex("by_accessGrantId", (q) =>
            q.eq("accessGrantId", existingGrant._id)
          )
          .first();
        const effectiveEndsAt = getTryoutAccessGrantEffectiveEndsAt({
          campaign: eventAccess.campaign,
          endsAt: existingGrant.endsAt,
        });

        if (existingGrant.status === "active" && activeEntitlement) {
          return {
            kind: "active" as const,
            endsAt: activeEntitlement.endsAt,
            name: eventAccess.campaign.name,
          };
        }

        return {
          kind: "used" as const,
          endsAt: effectiveEndsAt,
          name: eventAccess.campaign.name,
        };
      }
    }

    const unavailableReason = getTryoutAccessUnavailableReason(eventAccess);

    if (unavailableReason) {
      return {
        kind: "unavailable" as const,
        name: eventAccess.campaign.name,
        reason: unavailableReason,
      };
    }

    if (!user) {
      return {
        kind: "sign-in" as const,
        name: eventAccess.campaign.name,
      };
    }

    return {
      kind: "ready" as const,
      name: eventAccess.campaign.name,
    };
  },
});
