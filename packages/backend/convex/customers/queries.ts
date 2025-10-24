import { v } from "convex/values";
import { query } from "../_generated/server";
import tables from "./schema";

/**
 * Get customer record by user ID.
 * Returns null if customer doesn't exist.
 */
export const getCustomerByUserId = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(tables.customers.validator, v.null()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();

    return customer;
  },
});
