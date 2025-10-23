import { v } from "convex/values";
import { query } from "../_generated/server";
import tables from "./schema";

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
