import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  polarCustomerWebhookTargetValidator,
  resolvePolarCustomerWebhookTarget,
} from "@repo/backend/convex/customers/polar/target";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
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
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return customer;
  },
});

/** Get customer record by Polar customer ID. */
export const getCustomerByPolarId = internalQuery({
  args: {
    polarCustomerId: v.string(),
  },
  returns: nullable(vv.doc("customers")),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_polarId", (q) => q.eq("id", args.polarCustomerId))
      .unique();

    return customer;
  },
});

/** Loads the durable Polar cleanup checkpoint for one deleted app user. */
export const getCustomerDeletionCheckpoint = internalQuery({
  args: {
    userId: vv.id("users"),
  },
  returns: nullable(v.string()),
  handler: async (ctx, args) => {
    const tombstone = await ctx.db
      .query("customerDeletionTombstones")
      .withIndex("by_cleanupUserId", (query) =>
        query.eq("cleanupUserId", args.userId)
      )
      .unique();

    return tombstone?.polarCustomerId ?? null;
  },
});

/** Returns whether a Polar customer currently owns an active subscription. */
export const hasActiveSubscriptionByCustomerId = internalQuery({
  args: {
    customerId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_customerId_and_status", (q) =>
        q.eq("customerId", args.customerId).eq("status", "active")
      )
      .first();

    return subscription !== null;
  },
});

/** Resolve whether a Polar customer webhook belongs to an active app user. */
export const resolveWebhookTarget = internalQuery({
  args: {
    externalId: v.optional(v.string()),
    metadataUserId: v.optional(v.string()),
    polarCustomerId: v.string(),
  },
  returns: polarCustomerWebhookTargetValidator,
  handler: (ctx, args) =>
    runConvexProgram(resolvePolarCustomerWebhookTarget(ctx, args)),
});
