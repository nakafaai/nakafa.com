import { query } from "@repo/backend/convex/_generated/server";
import {
  getOptionalAppUser,
  requireAuth,
} from "@repo/backend/convex/lib/helpers/auth";
import {
  getTryoutAccessEventByCode,
  getTryoutAccessGrantByCampaign,
  getTryoutAccessUnavailableReason,
  isTryoutAccessGrantActive,
  resolveTryoutAccessState,
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

const tryoutAccessSourceValidator = v.union(
  v.literal("subscription"),
  v.literal("event"),
  v.null()
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
    name: v.string(),
    product: tryoutProductValidator,
  }),
  v.object({
    kind: v.literal("ready"),
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
    now: v.number(),
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
      const existingGrant = await getTryoutAccessGrantByCampaign(ctx.db, {
        campaignId: eventAccess.campaign._id,
        userId: user.appUser._id,
      });

      if (existingGrant) {
        if (isTryoutAccessGrantActive(existingGrant, args.now)) {
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

    const unavailableReason = getTryoutAccessUnavailableReason(
      eventAccess,
      args.now
    );

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
        name: eventAccess.campaign.name,
        product: eventAccess.campaign.product,
      };
    }

    return {
      kind: "ready" as const,
      name: eventAccess.campaign.name,
      product: eventAccess.campaign.product,
    };
  },
});

/** Returns whether the authenticated user can start one tryout product right now. */
export const getTryoutAccessState = query({
  args: {
    now: v.number(),
    product: tryoutProductValidator,
  },
  returns: v.object({
    canStart: v.boolean(),
    endsAt: v.union(v.number(), v.null()),
    source: tryoutAccessSourceValidator,
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);

    return resolveTryoutAccessState(ctx.db, {
      now: args.now,
      product: args.product,
      userId: appUser._id,
    });
  },
});
