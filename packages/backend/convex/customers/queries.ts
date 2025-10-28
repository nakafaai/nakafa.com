import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Get customer record by user ID.
 * Internal function - called from actions only.
 * Returns null if customer doesn't exist.
 */
export const getCustomerByUserId = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();

    return customer;
  },
});
