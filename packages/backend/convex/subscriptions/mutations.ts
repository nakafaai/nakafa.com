import { internalMutation } from "@repo/backend/convex/_generated/server";
import tables from "@repo/backend/convex/subscriptions/schema";
import { v } from "convex/values";

/**
 * Create a new subscription record.
 * Internal function - called by Polar webhooks only.
 * Idempotent - safe to call multiple times with same subscription.
 */
export const createSubscription = internalMutation({
  args: {
    subscription: tables.subscriptions.validator,
  },
  returns: v.id("subscriptions"),
  handler: async (ctx, args) => {
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.subscription.id))
      .unique();

    if (existingSubscription) {
      return existingSubscription._id;
    }

    return await ctx.db.insert("subscriptions", args.subscription);
  },
});

/**
 * Update an existing subscription record.
 * Internal function - called by Polar webhooks only.
 * Creates subscription if not found (handles out-of-order webhooks).
 */
export const updateSubscription = internalMutation({
  args: {
    subscription: tables.subscriptions.validator,
  },
  handler: async (ctx, args) => {
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.subscription.id))
      .unique();

    if (!existingSubscription) {
      // If not found, create (handles out-of-order webhooks)
      await ctx.db.insert("subscriptions", args.subscription);
      return;
    }

    await ctx.db.patch(
      "subscriptions",
      existingSubscription._id,
      args.subscription
    );
  },
});
