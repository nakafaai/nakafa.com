import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";

const NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE = 10;

/** Deletes one user's local auth-related rows in bounded batches. */
export const cleanupDeletedUser = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notificationPreferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .take(NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE);

    for (const preference of notificationPreferences) {
      await ctx.db.delete("notificationPreferences", preference._id);
    }

    if (
      notificationPreferences.length ===
      NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.auth.cleanup.cleanupDeletedUser,
        args
      );

      return null;
    }

    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      return null;
    }

    await ctx.db.delete("users", args.userId);
    return null;
  },
});
