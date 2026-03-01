import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

/**
 * Backfill user plans - Set plan="free" for all users where plan is undefined.
 *
 * STRATEGY FOR PRO USERS:
 * ======================
 * Currently, all users should be "free" since we haven't launched pro subscriptions yet.
 * When a user subscribes to pro in the future:
 * 1. Webhook handler (customers/mutations.ts or subscriptions/mutations.ts) should update user.plan to "pro"
 * 2. When subscription ends/cancels, set user.plan back to "free"
 * 3. Use triggers (convex/triggers/) to automatically sync subscription status to user.plan
 *
 * This backfill is safe because:
 * - No users currently have active pro subscriptions
 * - All existing users are effectively free tier
 * - Future pro users will be handled by subscription webhooks
 */
export const backfillUserPlans = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const BATCH_SIZE = args.batchSize ?? 1000;
    let processed = 0;
    let updated = 0;

    // Query users where plan is undefined
    // Note: We can't use .filter() on undefined in index, so we scan
    const users = await ctx.db.query("users").take(BATCH_SIZE);

    for (const user of users) {
      processed++;

      // Check if plan is undefined
      if (user.plan === undefined) {
        await ctx.db.patch("users", user._id, {
          plan: "free",
        });
        updated++;

        logger.info("Backfilled user plan to free", {
          userId: user._id,
          email: user.email,
        });
      }
    }

    const hasMore = users.length === BATCH_SIZE;
    const nextCursor = hasMore ? users.at(-1)?._id : undefined;

    logger.info("Backfill batch complete", {
      processed,
      updated,
      hasMore,
    });

    return {
      processed,
      updated,
      hasMore,
      nextCursor,
    };
  },
});
