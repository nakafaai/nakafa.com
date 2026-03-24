import { internalQuery } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Get customer record by user ID.
 * Internal function - called from actions only.
 * Returns null if customer doesn't exist.
 */
export const getCustomerByUserId = internalQuery({
  args: {
    userId: vv.id("users"),
  },
  returns: nullable(vv.doc("customers")),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return customer;
  },
});

/** Resolve the app user for a Polar customer webhook payload. */
export const getUserIdByPolarCustomer = internalQuery({
  args: {
    externalId: v.optional(v.string()),
    metadataUserId: v.optional(v.string()),
  },
  returns: nullable(vv.id("users")),
  handler: async (ctx, args) => {
    if (args.metadataUserId) {
      const metadataUserId = ctx.db.normalizeId("users", args.metadataUserId);

      if (metadataUserId) {
        const userByMetadataId = await ctx.db.get("users", metadataUserId);

        if (userByMetadataId) {
          return userByMetadataId._id;
        }
      }
    }

    const externalId = args.externalId;

    if (!externalId) {
      return null;
    }

    const userByExternalId = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", externalId))
      .unique();

    if (userByExternalId) {
      return userByExternalId._id;
    }

    return null;
  },
});
