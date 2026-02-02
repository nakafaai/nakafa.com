import { internalQuery } from "@repo/backend/convex/_generated/server";
import { nullable, vv } from "@repo/backend/convex/lib/validators";

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
