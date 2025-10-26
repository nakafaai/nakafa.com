import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Get customer record by user ID.
 * Returns null if customer doesn't exist.
 */
export const getCustomerByUserId = query({
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
