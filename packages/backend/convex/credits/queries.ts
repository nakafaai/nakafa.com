import { internalQuery } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { userPlanValidator } from "@repo/backend/convex/users/schema";
import { v } from "convex/values";

/**
 * Get users who need their credits reset.
 * Internal query used by workflow.
 * Uses cursor-based pagination for scalability.
 * Filters by plan tier (free, pro) to only reset users in that tier.
 */
export const getUsersNeedingReset = internalQuery({
  args: {
    plan: userPlanValidator,
    resetTimestamp: v.number(),
    cursor: v.optional(vv.id("users")),
    batchSize: v.number(),
  },
  returns: v.object({
    users: v.array(
      v.object({
        _id: vv.id("users"),
        credits: v.optional(v.number()),
      })
    ),
    continueCursor: v.optional(vv.id("users")),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Query users by plan whose credits haven't been reset since resetTimestamp
    let query = ctx.db
      .query("users")
      .withIndex("plan", (idx) =>
        idx.eq("plan", args.plan).lt("creditsResetAt", args.resetTimestamp)
      );

    // Apply cursor pagination if provided
    const cursor = args.cursor;
    if (cursor) {
      query = query.filter((f) => f.gt(f.field("_id"), cursor));
    }

    const users = await query.take(args.batchSize);

    // Determine if there are more users to process
    const isDone = users.length < args.batchSize;
    const continueCursor = isDone ? undefined : users.at(-1)?._id;

    return {
      users: users.map((user) => ({
        _id: user._id,
        credits: user.credits,
      })),
      continueCursor,
      isDone,
    };
  },
});
