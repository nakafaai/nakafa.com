import { v } from "convex/values";
import { mutation } from "../_generated/server";
import tables from "./schema";

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
      throw new Error(`Subscription already exists: ${args.subscription.id}`);
    }
    const subscriptionId = await ctx.db.insert("subscriptions", {
      ...args.subscription,
      metadata: args.subscription.metadata,
    });
    return subscriptionId;
  },
});

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
      throw new Error(`Subscription not found: ${args.subscription.id}`);
    }
    await ctx.db.patch(existingSubscription._id, {
      ...args.subscription,
      metadata: args.subscription.metadata,
    });
  },
});
