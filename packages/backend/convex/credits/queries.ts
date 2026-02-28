import { internalQuery } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import schema from "@repo/backend/convex/schema";
import { userPlanValidator } from "@repo/backend/convex/users/schema";
import { v } from "convex/values";
import type { IndexKey } from "convex-helpers/server/pagination";
import { getPage } from "convex-helpers/server/pagination";

/**
 * Get users who need their credits reset.
 * Internal query used by workflow.
 * Uses convex-helpers getPage for proper cursor-based pagination.
 * Filters by plan tier (free, pro) to only reset users in that tier.
 */
export const getUsersNeedingReset = internalQuery({
  args: {
    plan: userPlanValidator,
    resetTimestamp: v.number(),
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    users: v.array(
      v.object({
        _id: vv.id("users"),
        credits: v.optional(v.number()),
      })
    ),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Convert string cursor to IndexKey array for getPage
    const startIndexKey: IndexKey | undefined = args.cursor
      ? [args.cursor]
      : undefined;

    // Use getPage from convex-helpers for proper pagination without .filter()
    const result = await getPage(ctx, {
      table: "users",
      index: "plan",
      schema,
      startIndexKey,
      targetMaxRows: args.batchSize,
    });

    // Filter users whose credits haven't been reset since resetTimestamp
    const usersNeedingReset = result.page.filter(
      (user) => (user.creditsResetAt ?? 0) < args.resetTimestamp
    );

    // Build continue cursor from last index key if there are more results
    const lastIndexKey = result.indexKeys.at(-1);
    const continueCursor =
      result.hasMore && lastIndexKey ? String(lastIndexKey[0]) : undefined;

    return {
      users: usersNeedingReset.map((user) => ({
        _id: user._id,
        credits: user.credits,
      })),
      continueCursor,
      isDone: !result.hasMore || usersNeedingReset.length === 0,
    };
  },
});
