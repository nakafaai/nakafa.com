import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { v } from "convex/values";

export const hasActiveSubscription = query({
  args: {
    productId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);

    const customer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", appUser._id))
      .unique();

    if (!customer) {
      return false;
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("customerId_status", (q) =>
        q.eq("customerId", customer.id).eq("status", "active")
      )
      .first();

    return subscription?.productId === args.productId;
  },
});
