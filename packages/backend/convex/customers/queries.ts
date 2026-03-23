import { components } from "@repo/backend/convex/_generated/api";
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
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();

    return customer;
  },
});

/** Resolve the app user for a Polar customer webhook payload. */
export const getUserIdByPolarCustomer = internalQuery({
  args: {
    email: v.string(),
    externalId: v.optional(v.string()),
  },
  returns: nullable(vv.id("users")),
  handler: async (ctx, args) => {
    const externalId = args.externalId;

    if (externalId) {
      const userByExternalId = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", externalId))
        .unique();

      if (userByExternalId) {
        return userByExternalId._id;
      }
    }

    const userByEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();

    if (userByEmail) {
      return userByEmail._id;
    }

    const authUser = await ctx.runQuery(
      components.betterAuth.queries.getUserByEmail,
      {
        email: args.email,
      }
    );

    if (!authUser) {
      return null;
    }

    const userByAuthId = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", authUser._id))
      .unique();

    return userByAuthId?._id ?? null;
  },
});
