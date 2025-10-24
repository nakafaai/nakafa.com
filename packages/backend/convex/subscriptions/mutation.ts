import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import tables from "./schema";

/**
 * Create a new subscription record.
 * Called by Polar webhooks when subscription is created.
 */
export const createSubscription = mutation({
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

    const subscriptionId = await ctx.db.insert("subscriptions", {
      ...args.subscription,
      metadata: args.subscription.metadata,
    });

    return subscriptionId;
  },
});

/**
 * Update an existing subscription record.
 * Called by Polar webhooks when subscription changes.
 */
export const updateSubscription = mutation({
  args: {
    subscription: tables.subscriptions.validator,
  },
  handler: async (ctx, args) => {
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.subscription.id))
      .unique();

    if (!existingSubscription) {
      throw new ConvexError({
        code: "SUBSCRIPTION_NOT_FOUND",
        message: `Subscription not found: ${args.subscription.id}`,
      });
    }

    await ctx.db.patch(existingSubscription._id, {
      ...args.subscription,
      metadata: args.subscription.metadata,
    });
  },
});
