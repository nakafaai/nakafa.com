import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  createSubscriptionRecord,
  updateSubscriptionRecord,
} from "@repo/backend/convex/subscriptions/records/impl";
import { subscriptionRecordArgs } from "@repo/backend/convex/subscriptions/records/spec";
import { v } from "convex/values";

/**
 * Create a new subscription record.
 * Internal function - called by Polar webhooks only.
 * Idempotent - safe to call multiple times with same subscription.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 */
export const createSubscription = internalMutation({
  args: subscriptionRecordArgs,
  returns: vv.id("subscriptions"),
  handler: async (ctx, args) =>
    await runConvexProgram(createSubscriptionRecord(ctx, args.subscription)),
});

/**
 * Update an existing subscription record.
 * Internal function - called by Polar webhooks only.
 * Creates subscription if not found (handles out-of-order webhooks).
 * @see https://docs.convex.dev/understanding/best-practices/
 */
export const updateSubscription = internalMutation({
  args: subscriptionRecordArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    await runConvexProgram(updateSubscriptionRecord(ctx, args.subscription)),
});
